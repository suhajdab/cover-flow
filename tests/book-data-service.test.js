import test from "node:test";
import assert from "node:assert/strict";
import { BookDataService } from "../public/js/book-data-service.js";

test("preserves chronological order across API pages", async () => {
  const originalFetch = global.fetch;
  const originalSetTimeout = global.setTimeout;
  const originalWindow = global.window;
  const pages = [
    { items: [{ title: "oldest" }, { title: "older" }], title: "Shelf", hasMore: true },
    { items: [{ title: "newer" }, { title: "newest" }], title: "Shelf", hasMore: false }
  ];
  global.fetch = async () => ({
    ok: true,
    json: async () => pages.shift()
  });
  global.setTimeout = callback => {
    callback();
    return 0;
  };
  global.window = { location: { search: "?userId=123&shelf=read" } };

  try {
    const service = new BookDataService();
    const books = await service.initialize();

    assert.deepEqual(
      books.map(book => book.title),
      ["oldest", "older", "newer", "newest"]
    );
  } finally {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
    global.window = originalWindow;
  }
});

test("reports when a lookahead finds books beyond the supported pagination limit", async () => {
  const originalFetch = global.fetch;
  const originalSetTimeout = global.setTimeout;
  const originalWindow = global.window;
  let requestCount = 0;
  global.fetch = async () => {
    requestCount++;
    return {
      ok: true,
      json: async () => ({
        items: [{ title: `Book ${requestCount}` }],
        title: "Shelf",
        hasMore: true
      })
    };
  };
  global.setTimeout = callback => {
    callback();
    return 0;
  };
  global.window = { location: { search: "?userId=123&shelf=read" } };

  try {
    const service = new BookDataService();

    await assert.rejects(
      service.initialize(),
      /more than 2,000 books/
    );
    assert.equal(requestCount, 21);
  } finally {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
    global.window = originalWindow;
  }
});

test("accepts exactly 2,000 books after an empty lookahead page", async () => {
  const originalFetch = global.fetch;
  const originalSetTimeout = global.setTimeout;
  const originalWindow = global.window;
  const pageItems = Array.from({ length: 100 }, (_, index) => ({ title: `Book ${index}` }));
  let requestCount = 0;
  global.fetch = async () => {
    requestCount++;
    return {
      ok: true,
      json: async () => ({
        items: requestCount <= 20 ? pageItems : [],
        title: "Shelf",
        hasMore: requestCount <= 20
      })
    };
  };
  global.setTimeout = callback => {
    callback();
    return 0;
  };
  global.window = { location: { search: "?userId=123&shelf=read" } };

  try {
    const service = new BookDataService();
    const books = await service.initialize();

    assert.equal(books.length, 2000);
    assert.equal(requestCount, 21);
  } finally {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
    global.window = originalWindow;
  }
});

test("destroy aborts an in-flight API request", async () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  global.fetch = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
  global.window = { location: { search: "?userId=123&shelf=read" } };

  try {
    const service = new BookDataService();
    const initialization = service.initialize();

    service.destroy();

    await assert.rejects(initialization, { name: "AbortError" });
  } finally {
    global.fetch = originalFetch;
    global.window = originalWindow;
  }
});