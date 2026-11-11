import test from "node:test";
import assert from "node:assert/strict";
import { GoodreadsDialog } from "../public/js/goodreads-dialog.js";

test("launch URL drops legacy feed keys", () => {
  const originalWindow = global.window;
  global.window = {
    location: { href: "https://example.test/?key=private-key" }
  };

  try {
    const dialog = new GoodreadsDialog();
    dialog.redirectToShelf("123", "read");

    const redirectUrl = new URL(global.window.location.href);
    assert.equal(redirectUrl.searchParams.get("userId"), "123");
    assert.equal(redirectUrl.searchParams.get("shelf"), "read");
    assert.equal(redirectUrl.searchParams.has("key"), false);
  } finally {
    global.window = originalWindow;
  }
});

test("requires a user ID before starting the application", () => {
  const originalWindow = global.window;

  try {
    global.window = { location: { search: "?shelf=read" } };
    assert.equal(GoodreadsDialog.hasValidUserIdParam(), false);

    global.window = { location: { search: "?userId=123" } };
    assert.equal(GoodreadsDialog.hasValidUserIdParam(), true);
  } finally {
    global.window = originalWindow;
  }
});

test("accepts profile links, bookshelf links and legacy feeds", () => {
  const dialog = new GoodreadsDialog();
  for (const [url, shelf] of [
    ["https://www.goodreads.com/user/show/123-reader?shelf=ignored", "read"],
    ["https://goodreads.com/user/show/123/", "read"],
    ["https://www.goodreads.com/review/list/123-reader?shelf=currently-reading", "currently-reading"],
    ["https://www.goodreads.com/review/list/123?tag=read-ai", "read-ai"],
    ["https://www.goodreads.com/review/list_rss/123?key=private-key&shelf=to-read", "to-read"]
  ]) {
    assert.deepEqual(dialog.parseGoodreadsUrl(url), { userId: "123", shelf });
  }
});

test("rejects unrelated links, insecure URLs and malformed shelf names", () => {
  const dialog = new GoodreadsDialog();
  for (const url of [
    "not-a-url",
    "http://www.goodreads.com/user/show/123",
    "https://goodreads.com.example.test/user/show/123",
    "https://www.goodreads.com:1234/user/show/123",
    "https://user@www.goodreads.com/user/show/123",
    "https://www.goodreads.com/book/show/123",
    "https://www.goodreads.com/user/show/1234567890123456",
    "https://www.goodreads.com/review/list/123?shelf=../bad"
  ]) {
    assert.throws(() => dialog.parseGoodreadsUrl(url), /Goodreads|goodreads|Invalid shelf/);
  }
});
