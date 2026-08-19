import test from "node:test";
import assert from "node:assert/strict";
import { ImageLoader } from "../public/js/image-loader.js";

test("settles stalled image requests after the configured timeout", async () => {
  const originalImage = global.Image;
  global.Image = class {
    set src(value) {
      this.currentSrc = value;
    }
  };

  try {
    const loader = new ImageLoader({ imageTimeoutMs: 5 });
    const result = await Promise.race([
      loader.preloadImages([{ image_url: "https://example.test/cover.jpg" }]),
      new Promise(resolve => setTimeout(() => resolve("still-loading"), 50))
    ]);

    assert.notEqual(result, "still-loading");
    assert.deepEqual(result, [null]);
  } finally {
    global.Image = originalImage;
  }
});

test("limits concurrent image requests", async () => {
  const originalImage = global.Image;
  let activeRequests = 0;
  let maximumActiveRequests = 0;

  global.Image = class {
    set src(value) {
      this.currentSrc = value;
      activeRequests++;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      queueMicrotask(() => {
        activeRequests--;
        this.onload();
      });
    }
  };

  try {
    const loader = new ImageLoader({ maxConcurrent: 2 });
    const books = Array.from({ length: 6 }, (_, index) => ({
      image_url: `https://example.test/cover-${index}.jpg`
    }));

    const images = await loader.preloadImages(books);

    assert.equal(images.length, books.length);
    assert.equal(maximumActiveRequests, 2);
  } finally {
    global.Image = originalImage;
  }
});

test("cancels timed-out requests before starting more work", async () => {
  const originalImage = global.Image;
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  let cancelledRequests = 0;

  global.Image = class {
    set src(value) {
      this.currentSrc = value;
      activeRequests++;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
    }

    removeAttribute(name) {
      if (name === "src" && this.currentSrc) {
        this.currentSrc = "";
        activeRequests--;
        cancelledRequests++;
      }
    }
  };

  try {
    const loader = new ImageLoader({ maxConcurrent: 2, imageTimeoutMs: 5 });
    const books = Array.from({ length: 6 }, (_, index) => ({
      image_url: `https://example.test/stalled-${index}.jpg`
    }));

    await loader.preloadImages(books);

    assert.equal(maximumActiveRequests, 2);
    assert.equal(activeRequests, 0);
    assert.equal(cancelledRequests, books.length);
  } finally {
    global.Image = originalImage;
  }
});

test("cancel stops active image loading", async () => {
  const originalImage = global.Image;
  let activeRequests = 0;

  global.Image = class {
    set src(value) {
      this.currentSrc = value;
      activeRequests++;
    }

    removeAttribute(name) {
      if (name === "src" && this.currentSrc) {
        this.currentSrc = "";
        activeRequests--;
      }
    }
  };

  try {
    const loader = new ImageLoader({ maxConcurrent: 2, imageTimeoutMs: 1000 });
    const loading = loader.preloadImages([
      { image_url: "https://example.test/one.jpg" },
      { image_url: "https://example.test/two.jpg" }
    ]);

    loader.cancel();
    await loading;

    assert.equal(activeRequests, 0);
  } finally {
    global.Image = originalImage;
  }
});