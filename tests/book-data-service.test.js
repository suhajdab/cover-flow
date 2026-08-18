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