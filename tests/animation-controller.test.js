import test from "node:test";
import assert from "node:assert/strict";
import { AnimationController } from "../public/js/animation-controller.js";

function createElement() {
  return {
    attributes: {},
    children: [],
    className: "",
    innerHTML: "",
    style: {},
    appendChild(child) {
      if (child.isFragment) {
        this.children.push(...child.children);
      } else {
        this.children.push(child);
      }
      return child;
    },
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
      return {
        ...createElement(),
        attributes: { ...this.attributes },
        className: this.className,
        alt: this.alt,
        draggable: this.draggable,
        loading: this.loading
      };
    }
  };
}

function createCoverFlow() {
  const element = createElement();
  Object.defineProperties(element, {
    firstChild: { get() { return this.children[0] ?? null; } },
    lastChild: { get() { return this.children.at(-1) ?? null; } }
  });
  element.removeChild = child => {
    element.children.splice(element.children.indexOf(child), 1);
  };
  return element;
}

test("slides left and appends the next chronological column on the right", () => {
  const originalDocument = global.document;
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;
  const frames = [];
  global.document = {
    createElement,
    createDocumentFragment() {
      return { ...createElement(), isFragment: true };
    }
  };
  global.requestAnimationFrame = callback => {
    frames.push(callback);
    return frames.length;
  };
  global.cancelAnimationFrame = () => {};

  try {
    const coverFlow = createCoverFlow();
    const initialColumns = Array.from({ length: 3 }, () => ({ div: createElement(), height: 0 }));
    initialColumns.forEach(column => coverFlow.appendChild(column.div));
    const columnLayouts = [2024, 2025, 2026].map(year => ({
      height: 80,
      entries: [{ item: { type: "year-divider", year }, height: 80 }]
    }));
    const controller = new AnimationController(coverFlow);
    coverFlow.style.transform = "translate3d(-75px, 0, 0)";

    controller.start(initialColumns, 200, [], columnLayouts, 1);
    assert.equal(coverFlow.style.transform, "translate3d(0px, 0, 0)");
    frames.shift()(1000);
    frames.shift()(8000);

    assert.match(coverFlow.style.transform, /translate3d\(-10px/);
    assert.equal(coverFlow.children.length, 3);
    assert.equal(coverFlow.children.at(-1).children[0].textContent, 2025);
  } finally {
    global.document = originalDocument;
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  }
});

test("advances through multiple chronological columns in one delayed frame", () => {
  const originalDocument = global.document;
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;
  const frames = [];
  global.document = {
    createElement,
    createDocumentFragment() {
      return { ...createElement(), isFragment: true };
    }
  };
  global.requestAnimationFrame = callback => {
    frames.push(callback);
    return frames.length;
  };
  global.cancelAnimationFrame = () => {};

  try {
    const coverFlow = createCoverFlow();
    const initialColumns = Array.from({ length: 3 }, () => ({ div: createElement(), height: 0 }));
    initialColumns.forEach(column => coverFlow.appendChild(column.div));
    const columnLayouts = [2024, 2025, 2026].map(year => ({
      height: 80,
      entries: [{ item: { type: "year-divider", year }, height: 80 }]
    }));
    const controller = new AnimationController(coverFlow);

    controller.start(initialColumns, 200, [], columnLayouts, 1);
    frames.shift()(1000);
    frames.shift()(47667);

    const residualOffset = Number(coverFlow.style.transform.match(/translate3d\(([-\d.]+)px/)?.[1]);
    assert.ok(Math.abs(residualOffset + 0.01) < 0.0001);
    assert.equal(coverFlow.children.length, 3);
    assert.deepEqual(
      coverFlow.children.map(column => column.children.at(-1)?.textContent),
      [2026, 2024, 2025]
    );
  } finally {
    global.document = originalDocument;
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  }
});

test("adds read_at data to animated book cover images", () => {
  const originalDocument = global.document;
  global.document = {
    createElement,
    createDocumentFragment() {
      return { ...createElement(), isFragment: true };
    }
  };

  try {
    const coverFlow = createCoverFlow();
    const controller = new AnimationController(coverFlow);
    const image = createElement();
    const readAt = "Tue Aug 18 00:00:00 -0700 2026";

    controller.addColumnToRightOptimized({
      entries: [{
        item: {
          type: "book",
          book: { title: "Book", read_at: readAt },
          image,
          index: 0
        },
        height: 100
      }]
    }, []);

    assert.equal(
      coverFlow.children[0].children[0].getAttribute("data-read-at"),
      readAt
    );
  } finally {
    global.document = originalDocument;
  }
});

test("adds an empty read_at attribute to animated covers without a Goodreads read date", () => {
  const originalDocument = global.document;
  global.document = {
    createElement,
    createDocumentFragment() {
      return { ...createElement(), isFragment: true };
    }
  };

  try {
    const coverFlow = createCoverFlow();
    const controller = new AnimationController(coverFlow);
    const image = createElement();

    controller.addColumnToRightOptimized({
      entries: [{
        item: {
          type: "book",
          book: { title: "Book", read_at: "" },
          image,
          index: 0
        },
        height: 100
      }]
    }, []);

    assert.equal(
      coverFlow.children[0].children[0].getAttribute("data-read-at"),
      ""
    );
  } finally {
    global.document = originalDocument;
  }
});
