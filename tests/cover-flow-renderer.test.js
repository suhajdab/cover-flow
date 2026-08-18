import test from "node:test";
import assert from "node:assert/strict";
import {
  createColumnLayout,
  findPreviousColumnStartItemIndex,
  getVisibleRatioInColumn
} from "../public/js/cover-flow-renderer.js";

const getLayoutItemHeight = item => item.height;

test("calculates the visible ratio for a bottom book cover", () => {
  assert.equal(getVisibleRatioInColumn(100, 100, 200), 1);
  assert.equal(getVisibleRatioInColumn(150, 100, 200), 0.5);
  assert.equal(getVisibleRatioInColumn(125, 100, 200), 0.75);
});

test("repeats a bottom book cover at the top of the next column when it is less than 75 percent visible", () => {
  const bookA = { type: "book", id: "a", height: 100 };
  const bookB = { type: "book", id: "b", height: 100 };
  const layout = createColumnLayout(2, [bookA, bookB], 170, 0, getLayoutItemHeight);

  assert.equal(layout.columns[0].entries.at(-1).item, bookB);
  assert.equal(layout.columns[0].entries.at(-1).visibleRatio, 0.7);
  assert.equal(layout.columns[1].entries[0].item, bookB);
  assert.equal(layout.columns[1].entries[0].isRepeat, true);
});

test("does not repeat a bottom book cover that is exactly 75 percent visible", () => {
  const bookA = { type: "book", id: "a", height: 100 };
  const bookB = { type: "book", id: "b", height: 100 };
  const layout = createColumnLayout(2, [bookA, bookB], 175, 0, getLayoutItemHeight);

  assert.equal(layout.columns[0].entries.at(-1).item, bookB);
  assert.equal(layout.columns[0].entries.at(-1).visibleRatio, 0.75);
  assert.equal(layout.columns[1].entries.some(entry => entry.item === bookB && entry.isRepeat), false);
});

test("finds the previous column start for rightward animation prepends", () => {
  const bookItems = Array.from({ length: 8 }, (_, index) => ({
    type: "book",
    id: index,
    height: 100
  }));

  assert.equal(findPreviousColumnStartItemIndex(bookItems, 200, 0, getLayoutItemHeight), 6);
});

test("moves a year divider to the next column when it would be stranded before its book", () => {
  const bookA = { type: "book", id: "a", height: 100 };
  const yearDivider = { type: "year-divider", year: 2026, height: 80 };
  const bookB = { type: "book", id: "b", height: 100 };
  const layout = createColumnLayout(2, [bookA, yearDivider, bookB], 200, 0, getLayoutItemHeight);

  assert.equal(layout.columns[0].entries.some(entry => entry.item === yearDivider), false);
  assert.equal(layout.columns[1].entries[0].item, yearDivider);
  assert.equal(layout.columns[1].entries[1].item, bookB);
});

test("prioritizes a year divider over repeating the previous column bottom book", () => {
  const bookA = { type: "book", id: "a", height: 100 };
  const bookB = { type: "book", id: "b", height: 100 };
  const yearDivider = { type: "year-divider", year: 2026, height: 80 };
  const bookC = { type: "book", id: "c", height: 100 };
  const layout = createColumnLayout(2, [bookA, bookB, yearDivider, bookC], 170, 0, getLayoutItemHeight);

  assert.equal(layout.columns[0].entries.at(-1).item, bookB);
  assert.equal(layout.columns[0].entries.at(-1).visibleRatio, 0.7);
  assert.equal(layout.columns[1].entries[0].item, yearDivider);
  assert.equal(layout.columns[1].entries[1].item, bookC);
  assert.equal(layout.columns[1].entries.some(entry => entry.item === bookB && entry.isRepeat), false);
});

test("prioritizes the wrapped first year divider over repeating the previous column bottom book", () => {
  const yearDivider = { type: "year-divider", year: 2026, height: 80 };
  const latestBook = { type: "book", id: "latest", height: 100 };
  const bookA = { type: "book", id: "a", height: 100 };
  const bookB = { type: "book", id: "b", height: 100 };
  const layout = createColumnLayout(2, [yearDivider, latestBook, bookA, bookB], 170, 2, getLayoutItemHeight);

  assert.equal(layout.columns[0].entries.at(-1).item, bookB);
  assert.equal(layout.columns[0].entries.at(-1).visibleRatio, 0.7);
  assert.equal(layout.columns[1].entries[0].item, yearDivider);
  assert.equal(layout.columns[1].entries[1].item, latestBook);
  assert.equal(layout.columns[1].entries.some(entry => entry.item === bookB && entry.isRepeat), false);
});