import test, { after } from "node:test";
import assert from "node:assert/strict";

const originalDocument = global.document;
const originalWindow = global.window;

function createElement() {
  return {
    classList: { add() {}, remove() {}, contains() { return false; } },
    querySelector() { return null; },
    style: {}
  };
}

global.document = {
  addEventListener() {},
  removeEventListener() {},
  querySelector() { return createElement(); }
};
global.window = {
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 1200,
  innerHeight: 800,
  location: { search: "?userId=123" }
};

const { BookCoverFlowApp } = await import("../public/js/app.js");

after(() => {
  global.document = originalDocument;
  global.window = originalWindow;
});

function configureApp(app) {
  app.bookDataService.getBooks = () => [{ title: "Book", image_url: "cover.jpg" }];
  app.uiManager = {
    handleEmptyState: () => false,
    handleNoUsableImages: () => false,
    setProgressItemState() {},
    updateImageLoadingProgress() {},
    getViewportSize: () => ({ width: 1200, height: 800 }),
    hideCardWithDelay() {},
    showError() {}
  };
}

test("does not render an in-flight build after the app is destroyed", async () => {
  const app = new BookCoverFlowApp();
  configureApp(app);
  let resolveImages;
  let rendered = false;
  let animationStarted = false;
  app.imageLoader.preloadImages = () => new Promise(resolve => {
    resolveImages = resolve;
  });
  app.coverFlowRenderer = {
    cleanup() {},
    renderWall() {
      rendered = true;
      return {};
    }
  };
  app.animationController = {
    stop() {},
    destroy() {},
    start() { animationStarted = true; }
  };

  const build = app.buildWall();
  app.destroy();
  resolveImages([createElement()]);
  await build;

  assert.equal(rendered, false);
  assert.equal(animationStarted, false);
});

test("stops before rendering when no book covers can be loaded", async () => {
  const app = new BookCoverFlowApp();
  configureApp(app);
  let checkedImages = null;
  let rendered = false;
  app.imageLoader.preloadImages = async () => [null];
  app.uiManager.handleNoUsableImages = images => {
    checkedImages = images;
    return true;
  };
  app.coverFlowRenderer = {
    renderWall() {
      rendered = true;
      return {};
    }
  };
  app.animationController = { stop() {}, start() {} };

  await app.buildWall();

  assert.deepEqual(checkedImages, [null]);
  assert.equal(rendered, false);
});

test("ignores service progress and rejection after destruction", async () => {
  const app = new BookCoverFlowApp();
  let progressCallback;
  let rejectInitialization;
  let progressUpdates = 0;
  let shownErrors = 0;
  app.bookDataService = {
    setProgressCallback(callback) {
      progressCallback = callback;
    },
    initialize() {
      return new Promise((resolve, reject) => {
        rejectInitialization = reject;
      });
    },
    destroy() {}
  };
  app.uiManager = {
    initializeProgressList() {},
    updateConnectionProgress() { progressUpdates++; },
    showError() { shownErrors++; },
    destroy() {}
  };
  app.imageLoader = { cancel() {} };

  const initialization = app.initialize();
  app.destroy();
  progressCallback("connect");
  rejectInitialization(new Error("late failure"));
  await initialization;

  assert.equal(progressUpdates, 0);
  assert.equal(shownErrors, 0);
});