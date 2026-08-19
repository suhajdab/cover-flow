import test from "node:test";
import assert from "node:assert/strict";
import { Config } from "../public/js/config.js";

test("builds API requests in ascending date-read order", () => {
  const originalWindow = global.window;
  global.window = {
    location: {
      search: "?userId=123&shelf=read&sort=date_added&order=d&key=test-key"
    }
  };

  try {
    const request = Config.buildApiRequest(2);
    const endpoint = new URL(request.url, "https://example.test");

    assert.equal(endpoint.searchParams.get("userId"), "123");
    assert.equal(endpoint.searchParams.get("shelf"), "read");
    assert.equal(endpoint.searchParams.get("key"), "test-key");
    assert.equal(endpoint.searchParams.get("page"), "2");
    assert.equal(endpoint.searchParams.get("sort"), "date_read");
    assert.equal(endpoint.searchParams.get("order"), "a");
    assert.equal(request.options.method, undefined);
    assert.equal(request.options.body, undefined);
  } finally {
    global.window = originalWindow;
  }
});