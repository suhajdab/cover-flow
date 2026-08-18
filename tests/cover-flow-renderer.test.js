import test from "node:test";
import assert from "node:assert/strict";
import {
  createColumnLayout,
  createFiniteColumnLayouts,
  createTerminalColumnWindow,
  createWrapTransitionLayout,
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

test("plans chronological columns without wrapping past the newest book", () => {
  const year2025 = { type: "year-divider", year: 2025, height: 80 };
  const bookA = { type: "book", id: "a", height: 100 };
  const bookB = { type: "book", id: "b", height: 100 };
  const year2026 = { type: "year-divider", year: 2026, height: 80 };
  const bookC = { type: "book", id: "c", height: 100 };
  const items = [year2025, bookA, bookB, year2026, bookC];
  const columns = createFiniteColumnLayouts(items, 150, getLayoutItemHeight);

  assert.deepEqual(
    columns.map(column => column.entries.map(entry => entry.item.id ?? entry.item.year)),
    [[2025, "a"], ["a", "b"], [2026, "c"]]
  );
  assert.equal(columns[1].entries[0].isRepeat, true);
  assert.equal(columns.at(-1).entries.at(-1).item, bookC);
  assert.equal(createWrapTransitionLayout(columns, items, 150), null);
});

test("repeats a clipped newest book in a separate wrap transition column", () => {
  const oldestBook = { type: "book", id: "oldest", height: 100 };
  const newestBook = { type: "book", id: "newest", height: 100 };
  const items = [oldestBook, newestBook];
  const columns = createFiniteColumnLayouts(
    items,
    150,
    getLayoutItemHeight
  );
  const transition = createWrapTransitionLayout(columns, items, 150);

  assert.equal(columns.length, 1);
  assert.equal(columns[0].entries.at(-1).item, newestBook);
  assert.equal(transition.entries[0].item, newestBook);
  assert.equal(transition.entries[0].isRepeat, true);
});

test("places the newest column in the rightmost visible slot with an oldest wrap buffer", () => {
  const columnLayouts = Array.from({ length: 5 }, (_, index) => ({
    height: 100,
    entries: [{ item: { type: "book", id: index } }]
  }));

  const window = createTerminalColumnWindow(columnLayouts, 3);

  assert.deepEqual(
    window.layouts.map(column => column.entries[0]?.item.id ?? null),
    [2, 3, 4, 0]
  );
  assert.equal(window.nextColumnLayoutIndex, 1);

  const smallWindow = createTerminalColumnWindow(columnLayouts.slice(0, 2), 4);
  assert.deepEqual(
    smallWindow.layouts.map(column => column.entries[0]?.item.id ?? null),
    [null, null, 0, 1, 0]
  );
});

test("uses a clipped-newest transition as the offscreen buffer", () => {
  const oldestBook = { type: "book", id: "oldest", height: 100 };
  const newestBook = { type: "book", id: "newest", height: 100 };
  const items = [oldestBook, newestBook];
  const columns = createFiniteColumnLayouts(items, 150, getLayoutItemHeight);
  const transition = createWrapTransitionLayout(columns, items, 150);
  const window = createTerminalColumnWindow(columns, 3, transition);

  assert.deepEqual(
    window.layouts.map(column => column.entries[0]?.item.id ?? null),
    [null, null, "oldest", "newest"]
  );
  assert.equal(window.layouts.at(-1).entries[0].isRepeat, true);
  assert.deepEqual(window.animationLayouts, [...columns, transition]);
  assert.equal(window.nextColumnLayoutIndex, 0);
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