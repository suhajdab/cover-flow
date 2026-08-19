import { CONFIG } from "./config.js";

/**
 * Adjust Goodreads image URLs to use configured column width
 */
function getSizedImageUrl(url) {
  // Remove any existing sizing (._S..._.) and add _SX{COLUMN_WIDTH}_ before the extension
  const width = CONFIG.COLUMN_WIDTH;
  // Remove all sizing patterns
  let newUrl = url.replace(/\._S[XY]\d+(_S[XY]\d+)*_\./g, ".");
  newUrl = newUrl.replace(/(\.[a-zA-Z0-9]+)$/i, `._SX${width}_$1`);
  return newUrl;
}

/**
 * Service for preloading images with progress tracking
 */
export class ImageLoader {
  constructor({ maxConcurrent = 6, imageTimeoutMs = 15000 } = {}) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.imageTimeoutMs = Math.max(1, imageTimeoutMs);
    this.loadGeneration = 0;
    this.activeCancellations = new Set();
  }

  /**
   * Preload images from books array
   * @param {Array} books - Array of book objects
   * @returns {Promise<Array>} Promise that resolves to array of loaded images
   */
  async preloadImages(books) {
    this.cancel();
    const loadGeneration = this.loadGeneration;
    let loaded = 0;
    let failed = 0;
    let nextIndex = 0;
    const total = books.length;
    const images = Array(total).fill(null);

    if (total === 0) {
      this.onProgress?.(0, 0, 0);
      return images;
    }

    const loadNext = async () => {
      while (nextIndex < total && loadGeneration === this.loadGeneration) {
        const index = nextIndex++;
        const imageUrl = books[index].image_url
          ? getSizedImageUrl(books[index].image_url)
          : "";

        if (imageUrl) {
          images[index] = await this.loadImage(imageUrl);
          if (loadGeneration !== this.loadGeneration) return;

          if (images[index]) {
            loaded++;
          } else {
            failed++;
          }
        } else {
          loaded++;
        }

        this.onProgress?.(loaded, failed, total);
      }
    };

    const workerCount = Math.min(this.maxConcurrent, total);
    await Promise.all(Array.from({ length: workerCount }, loadNext));
    return images;
  }

  /**
   * Load one image with a timeout
   * @param {string} imageUrl - URL of the image to load
   * @returns {Promise<HTMLImageElement|null>} Loaded image or null on failure
   */
  loadImage(imageUrl) {
    return new Promise(resolve => {
      const image = new Image();
      let settled = false;
      let timeoutId;

      const finish = (result, cancelRequest = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.activeCancellations.delete(cancel);
        image.onload = null;
        image.onerror = null;
        if (cancelRequest) {
          image.removeAttribute?.("src");
        }
        resolve(result);
      };
      const cancel = () => finish(null, true);

      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      timeoutId = setTimeout(cancel, this.imageTimeoutMs);
      this.activeCancellations.add(cancel);
      image.src = imageUrl;
    });
  }

  cancel() {
    this.loadGeneration++;
    const cancellations = [...this.activeCancellations];
    cancellations.forEach(cancel => cancel());
  }

  /**
   * Set progress callback
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }
}
