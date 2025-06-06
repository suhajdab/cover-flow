import { CONFIG } from './config.js';

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
  /**
   * Preload images from books array
   * @param {Array} books - Array of book objects
   * @returns {Promise<Array>} Promise that resolves to array of loaded images
   */
  async preloadImages(books) {
    return new Promise((resolve) => {
      let loaded = 0;
      let failed = 0;
      const images = [];
      const total = books.length;

      if (total === 0) {
        this.onProgress?.(0, 0, 0);
        resolve([]);
        return;
      }

      books.forEach((book, idx) => {
        const imgSrc = book.image_url ? getSizedImageUrl(book.image_url) : '';

        if (!imgSrc) {
          loaded++;
          this.onProgress?.(loaded, failed, total);
          images[idx] = null;
          this.checkComplete(loaded, failed, total, images, resolve);
          return;
        }

        const img = new Image();
        img.src = imgSrc;

        img.onload = () => {
          loaded++;
          images[idx] = img;
          this.onProgress?.(loaded, failed, total);
          this.checkComplete(loaded, failed, total, images, resolve);
        };

        img.onerror = () => {
          failed++;
          images[idx] = null;
          this.onProgress?.(loaded, failed, total);
          this.checkComplete(loaded, failed, total, images, resolve);
        };
      });
    });
  }

  /**
   * Check if loading is complete and resolve if so
   * @param {number} loaded - Number of loaded images
   * @param {number} failed - Number of failed images
   * @param {number} total - Total number of images
   * @param {Array} images - Array of image elements
   * @param {Function} resolve - Promise resolve function
   */
  checkComplete(loaded, failed, total, images, resolve) {
    if (loaded + failed === total) {
      resolve(images);
    }
  }

  /**
   * Set progress callback
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }
}
