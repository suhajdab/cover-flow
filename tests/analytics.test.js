import test from "node:test";
import assert from "node:assert/strict";
import { isLocalHostname } from "../public/js/analytics.js";

test("recognizes common local development hostnames", () => {
  for (const hostname of ["localhost", "app.localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]) {
    assert.equal(isLocalHostname(hostname), true, hostname);
  }

  assert.equal(isLocalHostname("cover-flow.vercel.app"), false);
});