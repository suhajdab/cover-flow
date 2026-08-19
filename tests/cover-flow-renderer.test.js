import test from "node:test";
import assert from "node:assert/strict";
import {
  CoverFlowRenderer,
  createContinuousColumnLayoutPlanner,
  createColumnLayout,
  createFiniteColumnLayouts,
  createTerminalColumnWindow,
  createWrapTransitionLayout,
  getVisibleRatioInColumn
} from "../public/js/cover-flow-renderer.js";

const getLayoutItemHeight = item => item.height;

function createImageElement() {
  return {
    attributes: {},
    className: "",
    style: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    cloneNode() {
      const clone = createImageElement();
      clone.attributes = { ...this.attributes };
      clone.className = this.className;
      clone.alt = this.alt;
      clone.draggable = this.draggable;
      clone.loading = this.loading;
      return clone;
    }
  };
}

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

test("continues filling a column across the newest-to-oldest boundary when there is room", () => {
  const oldestBook = { type: "book", id: "oldest", height: 100 };
  const middleBook = { type: "book", id: "middle", height: 100 };
  const newestBook = { type: "book", id: "newest", height: 100 };
  const planner = createContinuousColumnLayoutPlanner(
    [oldestBook, middleBook, newestBook],
    425,
    getLayoutItemHeight
  );
  const layout = planner.createNextColumn();

  assert.deepEqual(
    layout.entries.map(entry => entry.item.id),
    ["oldest", "middle", "newest", "oldest", "middle"]
  );
  assert.equal(layout.entries[3].visibleRatio, 1);
});

test("adds read_at data to initially rendered book cover images", () => {
  const renderer = new CoverFlowRenderer({});
  const readAt = "Tue Aug 18 00:00:00 -0700 2026";
  const cover = renderer.createBookCover({
    type: "book",
    book: { title: "Book", read_at: readAt },
    image: createImageElement(),
    index: 0
  });

  assert.equal(cover.getAttribute("data-read-at"), readAt);
});

test("adds an empty read_at attribute when Goodreads has no read date", () => {
  const renderer = new CoverFlowRenderer({});
  const cover = renderer.createBookCover({
    type: "book",
    book: { title: "Book", read_at: "" },
    image: createImageElement(),
    index: 0
  });

  assert.equal(cover.getAttribute("data-read-at"), "");
});

test("groups books without read_at under an n.a. year divider", () => {
  const renderer = new CoverFlowRenderer({});
  const books = [
    { title: "Oldest Read", read_at: "Tue, 20 Aug 2013 00:00:00 +0000" },
    { title: "Unknown Read", read_at: "" },
    { title: "Another Unknown Read" },
    { title: "Later Read", read_at: "Sat, 19 Oct 2024 00:00:00 +0000" }
  ];
  const images = books.map(() => createImageElement());
  const items = renderer.createBookItemsWithYearDividers(books, images);

  assert.deepEqual(
    items.map(item => item.type === "year-divider" ? item.year : item.book.title),
    [2013, "Oldest Read", "n.a.", "Unknown Read", "Another Unknown Read", 2024, "Later Read"]
  );
});

test("does not add year dividers when every book lacks read_at", () => {
  const renderer = new CoverFlowRenderer({});
  const books = [
    { title: "First To Read", read_at: "" },
    { title: "Second To Read" }
  ];
  const images = books.map(() => createImageElement());
  const items = renderer.createBookItemsWithYearDividers(books, images);

  assert.deepEqual(
    items.map(item => item.type === "year-divider" ? item.year : item.book.title),
    ["First To Read", "Second To Read"]
  );
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

test("repeats only a clipped first book of a year when the year divider fits", () => {
  const bookA = { type: "book", id: "a", height: 100 };
  const yearDivider = { type: "year-divider", year: 2026, height: 80 };
  const bookB = { type: "book", id: "b", height: 100 };
  const planner = createContinuousColumnLayoutPlanner(
    [bookA, yearDivider, bookB],
    220,
    getLayoutItemHeight
  );
  const firstColumn = planner.createNextColumn();
  const secondColumn = planner.createNextColumn();

  assert.deepEqual(
    firstColumn.entries.map(entry => entry.item.id ?? entry.item.year),
    ["a", 2026, "b"]
  );
  assert.equal(firstColumn.entries.at(-1).visibleRatio, 0.4);
  assert.deepEqual(
    secondColumn.entries.slice(0, 1).map(entry => entry.item.id ?? entry.item.year),
    ["b"]
  );
  assert.equal(secondColumn.entries[0].isRepeat, true);
});

test("repeats a clipped year divider at the top of the next column", () => {
  const bookA = { type: "book", id: "a", height: 180 };
  const yearDivider = { type: "year-divider", year: 2026, height: 80 };
  const bookB = { type: "book", id: "b", height: 100 };
  const planner = createContinuousColumnLayoutPlanner(
    [bookA, yearDivider, bookB],
    220,
    getLayoutItemHeight
  );
  const firstColumn = planner.createNextColumn();
  const secondColumn = planner.createNextColumn();

  assert.deepEqual(
    firstColumn.entries.map(entry => entry.item.id ?? entry.item.year),
    ["a", 2026]
  );
  assert.equal(firstColumn.entries.at(-1).visibleRatio, 0.5);
  assert.deepEqual(
    secondColumn.entries.slice(0, 2).map(entry => entry.item.id ?? entry.item.year),
    [2026, "b"]
  );
  assert.equal(secondColumn.entries[0].isRepeat, true);
  assert.equal(secondColumn.entries[1].isRepeat, false);
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