import test from "node:test";
import assert from "node:assert/strict";
import { calculateCenteredStartItemIndex } from "../public/js/cover-flow-renderer.js";

const items = Array.from({ length: 8 }, (_, index) => ({ id: index }));
const itemHeight = () => 100;

test("centers the first feed item by rewinding visible columns", () => {
  const startIndex = calculateCenteredStartItemIndex(items, 200, 2, itemHeight);

  assert.equal(startIndex, 4);
});

test("single-column viewport starts with the first feed item", () => {
  const startIndex = calculateCenteredStartItemIndex(items, 200, 0, itemHeight);

  assert.equal(startIndex, 0);
});

test("rewinding wraps across the end of the item list", () => {
  const startIndex = calculateCenteredStartItemIndex(items, 300, 1, itemHeight);

  assert.equal(startIndex, 5);
});

test("empty item lists start at zero", () => {
  const startIndex = calculateCenteredStartItemIndex([], 200, 2, itemHeight);

  assert.equal(startIndex, 0);
});