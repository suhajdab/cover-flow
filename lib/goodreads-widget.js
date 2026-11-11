import { parse } from "acorn";
import { parseFragment } from "parse5";

const GOODREADS_ORIGIN = "https://www.goodreads.com";
const COVER_ORIGIN = "https://i.gr-assets.com";
const WIDGET_LIMIT = "200";

function* elements(root) {
  const pending = [root];
  while (pending.length) {
    const node = pending.pop();
    if (node.tagName) yield node;
    for (let index = (node.childNodes?.length ?? 0) - 1; index >= 0; index--) {
      pending.push(node.childNodes[index]);
    }
  }
}

function attribute(node, name) {
  return node?.attrs.find(attr => attr.name === name)?.value;
}

function hasClass(node, className) {
  return attribute(node, "class")?.split(/\s+/).includes(className);
}

function textContent(node) {
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes ?? []).map(textContent).join("");
}

function parseWidget(script) {
  const program = parse(script, { ecmaVersion: "latest" });
  const markup = program.body
    .filter(node => node.type === "VariableDeclaration")
    .flatMap(node => node.declarations)
    .find(node => node.id.type === "Identifier" && node.id.name === "widget_code")
    ?.init;

  if (markup?.type !== "Literal" || typeof markup.value !== "string") {
    throw new Error("Goodreads widget markup is missing");
  }

  const document = parseFragment(markup.value);
  const nodes = [...elements(document)];
  const grid = nodes.find(node => hasClass(node, "gr_grid_container"));
  if (!grid) throw new Error("Goodreads widget grid is missing");

  const heading = nodes.find(node => node.tagName === "h2");
  const title = heading ? textContent(heading).trim() : "";
  const entries = new Map();

  for (const node of elements(grid)) {
    if (!hasClass(node, "gr_grid_book_container")) continue;
    const children = [...elements(node)];
    const link = children.find(child => child.tagName === "a");
    const image = children.find(child => child.tagName === "img");
    const review = URL.parse(attribute(link, "href") ?? "", GOODREADS_ORIGIN);
    const reviewId = review?.origin === GOODREADS_ORIGIN
      ? review.pathname.match(/^\/review\/show\/(\d+)\/?$/)?.[1]
      : undefined;
    const cover = URL.parse(attribute(image, "src") ?? "");
    const bookTitle = (attribute(link, "title") || attribute(image, "alt"))?.trim();
    if (!reviewId || !bookTitle || cover?.origin !== COVER_ORIGIN || cover.username || cover.password) {
      continue;
    }

    const bookId = cover.pathname.match(/\/books\/\d+l\/(\d+)[._]/)?.[1];
    entries.set(reviewId, {
      book_id: bookId ? Number(bookId) : null,
      title: bookTitle,
      author_name: "",
      image_url: cover.href,
      read_at: null,
      date_added: null
    });
  }

  return { title, entries };
}

async function fetchWindow(userId, shelf, sort, order) {
  const params = new URLSearchParams({ shelf, sort, order, num_books: WIDGET_LIMIT });
  const response = await fetch(`${GOODREADS_ORIGIN}/review/grid_widget/${userId}?${params}`, {
    signal: AbortSignal.timeout(8000),
    redirect: "error",
    headers: { "User-Agent": "Cover-Flow-App/1.0" }
  });
  if (!response.ok) throw new Error(`Goodreads widget returned ${response.status}`);

  const script = await response.text();
  if (script.length > 512 * 1024) throw new Error("Goodreads widget response is too large");
  return parseWidget(script);
}

export async function loadGoodreadsShelf(userId, shelf) {
  const sort = shelf === "read" ? "date_read" : "date_added";
  const [oldest, newest] = await Promise.allSettled([
    fetchWindow(userId, shelf, sort, "a"),
    fetchWindow(userId, shelf, sort, "d")
  ]);

  const entries = oldest.value?.entries ?? new Map();
  for (const [reviewId, book] of [...(newest.value?.entries ?? [])].reverse()) {
    entries.delete(reviewId);
    entries.set(reviewId, book);
  }

  if (entries.size === 0) {
    const failure = [oldest, newest].find(result => result.status === "rejected");
    if (failure) throw failure.reason;
  }

  return {
    items: [...entries.values()],
    title: newest.value?.title || oldest.value?.title || ""
  };
}
