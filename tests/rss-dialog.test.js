import test from "node:test";
import assert from "node:assert/strict";
import { RSSDialog } from "../public/js/rss-dialog.js";

test("redirect keeps the feed key in the self-contained launch URL", () => {
  const originalWindow = global.window;
  global.window = {
    location: { href: "https://example.test/" }
  };

  try {
    const dialog = new RSSDialog();
    dialog.redirectToShelf("123", "read", "private-key");

    const redirectUrl = new URL(global.window.location.href);
    assert.equal(redirectUrl.searchParams.get("userId"), "123");
    assert.equal(redirectUrl.searchParams.get("shelf"), "read");
    assert.equal(redirectUrl.searchParams.get("key"), "private-key");
  } finally {
    global.window = originalWindow;
  }
});

test("requires a user ID before starting the application", () => {
  const originalWindow = global.window;

  try {
    global.window = { location: { search: "?shelf=read" } };
    assert.equal(RSSDialog.hasValidUserIdParam(), false);

    global.window = { location: { search: "?userId=123" } };
    assert.equal(RSSDialog.hasValidUserIdParam(), true);
  } finally {
    global.window = originalWindow;
  }
});