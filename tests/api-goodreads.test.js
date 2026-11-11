import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/goodreads.js";

function widget(...books) {
  const entries = books.map(([reviewId, title, cover = "https://i.gr-assets.com/images/S/books/123l/55._SX50_.jpg"]) =>
    `<div class="gr_grid_book_container"><a href="/review/show/${reviewId}?utm_medium=api" title="${title}"><img src="${cover}" alt="Short title"></a></div>`
  );
  const markup = `<h2>Reader&#39;s books</h2><div class="gr_grid_container">${entries.join("")}</div>`;
  return new Response(`var widget_code = ${JSON.stringify(markup)}; document.write(widget_code);`);
}

async function request(query = {}, method = "GET") {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; }
  };
  await handler({ method, query: { userId: "123", ...query } }, res);
  return res;
}

test("rejects unsupported methods and invalid query parameters", async t => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Invalid inputs must not trigger a fetch"));
  const post = await request({}, "POST");
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.Allow, "GET");

  for (const [query, message] of [
    [{ userId: undefined }, /Missing required parameter/],
    [{ userId: "abc" }, /Invalid userId/],
    [{ userId: ["123", "456"] }, /Invalid userId/],
    [{ shelf: "../etc/passwd" }, /Invalid shelf/],
    [{ key: "invalid!" }, /Invalid key/],
    [{ page: "0" }, /Invalid page/],
    [{ page: "1junk" }, /Invalid page/],
    [{ page: "22" }, /Invalid page/],
    [{ sort: "invalid-sort!" }, /Invalid sort/],
    [{ order: "invalid" }, /Invalid order/]
  ]) {
    const res = await request(query);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.error, message);
    assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  }
});

test("merges widget windows in ascending order, using the newest window for overlap", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async url => {
    return new URL(url).searchParams.get("order") === "a"
      ? widget(["1", "Oldest"], ["2", "Overlap"], ["2", "Duplicate"], ["3", "Unsafe cover", "https://evil.test/cover.jpg"])
      : widget(["4", "The &quot;Newest&quot; &amp; Best"], ["2", "Overlap"]);
  });

  const res = await request({ key: "private-key", sort: "date_added", order: "d" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.page, 1);
  assert.equal(res.data.hasMore, false);
  assert.equal(res.data.title, "Reader's books");
  assert.deepEqual(res.data.items.map(book => book.title), ["Oldest", "Overlap", 'The "Newest" & Best']);
  assert.deepEqual(res.data.items[2], {
    book_id: 55,
    title: 'The "Newest" & Best',
    author_name: "",
    image_url: "https://i.gr-assets.com/images/S/books/123l/55._SX50_.jpg",
    read_at: null,
    date_added: null
  });
  assert.deepEqual(res.headers, {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  assert.equal(fetch.mock.callCount(), 2);
  for (const [index, order] of ["a", "d"].entries()) {
    const [url, options] = fetch.mock.calls[index].arguments;
    const { origin, pathname, searchParams } = new URL(url);
    assert.equal(origin, "https://www.goodreads.com");
    assert.equal(pathname, "/review/grid_widget/123");
    assert.deepEqual(Object.fromEntries(searchParams), { shelf: "read", sort: "date_read", order, num_books: "200" });
    assert.equal(options.redirect, "error");
  }
});

test("custom shelves use date-added sorting and keep a usable window after an upstream failure", async t => {
  t.mock.method(globalThis, "fetch", async url => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("shelf"), "read-ai");
    assert.equal(params.get("sort"), "date_added");
    return params.get("order") === "a"
      ? new Response("", { status: 503 })
      : widget(["3", "New"], ["2", "Old"]);
  });

  const res = await request({ shelf: "read-ai" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.data.items.map(book => book.title), ["Old", "New"]);
});

test("returns an empty shelf when both widgets have no covers", async t => {
  t.mock.method(globalThis, "fetch", async () => widget());
  const res = await request();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.data, { page: 1, items: [], title: "Reader's books", hasMore: false });
});

test("rejects malformed widget bodies even when Goodreads returns 200", async t => {
  t.mock.method(globalThis, "fetch", async url => new Response(
    new URL(url).searchParams.get("order") === "a"
      ? "<!doctype html><title>Goodreads Sign In</title>"
      : 'var widget_code = "<h2>Missing grid</h2>";'
  ));
  t.mock.method(console, "error", () => {});
  const res = await request();
  assert.equal(res.statusCode, 502);
});

test("reports a timeout when neither widget can be fetched", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("Timed out", "TimeoutError"); });
  const res = await request();
  assert.equal(res.statusCode, 504);
});

test("returns an empty result for a legacy lookahead page without repeating the fetch", async t => {
  const fetch = t.mock.method(globalThis, "fetch");
  const res = await request({ page: "21" });
  assert.deepEqual(res.data, { page: 21, items: [], title: "", hasMore: false });
  assert.equal(fetch.mock.callCount(), 0);
});
