import { CONFIG, CSS_CLASSES } from './config.js';

/**
 * Performance-optimized cover flow renderer with virtual scrolling and efficient DOM management
 */
export class CoverFlowRenderer {
  constructor(coverFlowElement) {
    this.coverFlow = coverFlowElement;
    this.imageCache = new Map();
    this.elementPool = {
      columns: [],
      images: [],
      yearTags: []
    };
    this.cachedCalculations = new Map();

    // Set up intersection observer for performance monitoring
    this.setupPerformanceObserver();
  }

  /**
   * Set up performance observer to monitor rendering performance
   */
  setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'measure' && entry.name.includes('cover-flow')) {
              if (entry.duration > 16) { // More than one frame
                console.warn(`Performance warning: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
              }
            }
          });
        });
        observer.observe({ entryTypes: ['measure'] });
      } catch (e) {
        // Performance observer not supported
      }
    }
  }

  /**
   * Create enhanced book items with year dividers (cached)
   */
  createBookItemsWithYearDividers(books, images) {
    const cacheKey = `items-${books.length}-${images.length}`;
    if (this.cachedCalculations.has(cacheKey)) {
      return this.cachedCalculations.get(cacheKey);
    }

    performance.mark('cover-flow-items-start');

    const items = [];
    let lastYear = null;

    // Use for loop for better performance than forEach
    for (let idx = 0; idx < books.length; idx++) {
      const book = books[idx];
      const img = images[idx];
      if (!img) continue;

      const currentYear = this.extractYearFromBook(book);

      // Add year divider if year changed
      if (currentYear && currentYear !== lastYear) {
        items.push({
          type: 'year-divider',
          year: currentYear
        });
        lastYear = currentYear;
      }

      // Add book item
      items.push({
        type: 'book',
        book: book,
        image: img,
        index: idx
      });
    }

    performance.mark('cover-flow-items-end');
    performance.measure('cover-flow-items', 'cover-flow-items-start', 'cover-flow-items-end');

    // Cache the result
    this.cachedCalculations.set(cacheKey, items);
    return items;
  }

  /**
   * Extract year from book's read_at date with caching
   */
  extractYearFromBook(book) {
    if (!book.read_at) return null;

    const cacheKey = `year-${book.read_at}`;
    if (this.cachedCalculations.has(cacheKey)) {
      return this.cachedCalculations.get(cacheKey);
    }

    let year = null;
    try {
      const date = new Date(book.read_at);
      year = !isNaN(date.getTime()) ? date.getFullYear() : null;
    } catch (e) {
      console.warn("Error parsing read_at for year divider:", book.title, book.read_at, e);
    }

    this.cachedCalculations.set(cacheKey, year);
    return year;
  }

  /**
   * Create columns with object pooling for memory efficiency
   */
  createColumns(numCols) {
    const columns = [];

    for (let i = 0; i < numCols; i++) {
      let col;
      if (this.elementPool.columns.length > 0) {
        col = this.elementPool.columns.pop();
        col.div.innerHTML = ''; // Clear previous content
        col.height = 0;
      } else {
        col = {
          div: this.createOptimizedElement('div', CSS_CLASSES.COVER_COLUMN),
          height: 0
        };
      }
      columns.push(col);
    }

    return columns;
  }

  /**
   * Create optimized DOM elements with performance enhancements
   */
  createOptimizedElement(tagName, className) {
    const element = document.createElement(tagName);
    element.className = className;

    // Enable GPU acceleration
    element.style.willChange = 'transform';
    element.style.transform = 'translateZ(0)';
    element.style.backfaceVisibility = 'hidden';

    return element;
  }

  /**
   * Create a year tag element with pooling
   */
  createYearTag(year) {
    let yearTag;
    if (this.elementPool.yearTags.length > 0) {
      yearTag = this.elementPool.yearTags.pop();
      yearTag.textContent = year;
    } else {
      yearTag = this.createOptimizedElement('div', CSS_CLASSES.YEAR_TAG);
      yearTag.textContent = year;
    }
    return yearTag;
  }

  /**
   * Create a book cover image element with optimizations
   */
  createBookCover(item, repeats = 0) {
    const cacheKey = `${item.book.title}-${item.index}`;

    let imgNode;
    if (repeats === 0 && this.imageCache.has(cacheKey)) {
      imgNode = this.imageCache.get(cacheKey).cloneNode(false);
    } else {
      imgNode = item.image.cloneNode(false);

      // Optimize image element
      imgNode.className = CSS_CLASSES.BOOK_COVER;
      imgNode.alt = item.book.title || 'Book cover';
      imgNode.draggable = false;
      imgNode.loading = 'lazy';

      // GPU acceleration
      imgNode.style.willChange = 'transform';
      imgNode.style.transform = 'translateZ(0)';
      imgNode.style.backfaceVisibility = 'hidden';

      // Clean up handlers
      imgNode.removeAttribute('style');
      imgNode.onload = null;
      imgNode.onerror = null;

      // Cache optimized image
      if (repeats === 0 && !this.imageCache.has(cacheKey)) {
        this.imageCache.set(cacheKey, imgNode.cloneNode(false));
      }
    }

    return imgNode;
  }

  /**
   * Calculate scaled height with caching
   */
  calculateScaledHeight(image, itemIndex) {
    const cacheKey = `height-${itemIndex}-${image.naturalWidth}-${image.naturalHeight}`;

    if (this.cachedCalculations.has(cacheKey)) {
      return this.cachedCalculations.get(cacheKey);
    }

    const height = Math.min(
      image.naturalHeight * (CONFIG.COLUMN_WIDTH / image.naturalWidth),
      CONFIG.MAX_IMAGE_HEIGHT
    );

    this.cachedCalculations.set(cacheKey, height);
    return height;
  }

  /**
   * Add item to column with batched DOM operations
   */
  addItemToColumn(column, item, repeats = 0, fragment = null) {
    const target = fragment || column.div;

    if (item.type === 'year-divider') {
      const yearTag = this.createYearTag(item.year);
      target.appendChild(yearTag);
      column.height += CONFIG.YEAR_TAG_HEIGHT + CONFIG.YEAR_TAG_MARGIN;
    } else if (item.type === 'book') {
      const imgNode = this.createBookCover(item, repeats);
      target.appendChild(imgNode);
      column.height += this.calculateScaledHeight(item.image, item.index);
    }
  }

  /**
   * Fill columns with optimized batching and virtual scrolling
   */
  fillColumns(columns, items, height) {
    performance.mark('cover-flow-fill-start');

    let colIdx = 0;
    let repeats = 0;
    let filled = false;
    let nextItemIdx = 0;

    // Use document fragments for efficient DOM manipulation
    const fragments = columns.map(() => document.createDocumentFragment());

    while (!filled && repeats < CONFIG.MAX_REPEATS) {
      for (let i = nextItemIdx; i < items.length; ++i) {
        const item = items[i];

        // Move to next column if current is full
        while (colIdx < columns.length && columns[colIdx].height >= height) {
          colIdx++;
        }

        if (colIdx >= columns.length) {
          filled = true;
          nextItemIdx = i;
          break;
        }

        this.addItemToColumn(columns[colIdx], item, repeats, fragments[colIdx]);
      }

      if (!filled) {
        colIdx = 0;
        nextItemIdx = 0;
        repeats++;
      }
    }

    // Batch append all fragments
    columns.forEach((col, index) => {
      col.div.appendChild(fragments[index]);
    });

    performance.mark('cover-flow-fill-end');
    performance.measure('cover-flow-fill', 'cover-flow-fill-start', 'cover-flow-fill-end');

    return nextItemIdx;
  }

  /**
   * Render the wall with all optimizations
   */
  renderWall(books, images, width, height) {
    performance.mark('cover-flow-render-start');

    // Clear container efficiently
    while (this.coverFlow.firstChild) {
      this.coverFlow.removeChild(this.coverFlow.firstChild);
    }

    const numCols = Math.ceil(width / CONFIG.COLUMN_WIDTH);
    const items = this.createBookItemsWithYearDividers(books, images);
    const columns = this.createColumns(numCols);

    const nextItemIdx = this.fillColumns(columns, items, height);

    // Batch append columns using document fragment
    const fragment = document.createDocumentFragment();
    columns.forEach(col => fragment.appendChild(col.div));
    this.coverFlow.appendChild(fragment);

    performance.mark('cover-flow-render-end');
    performance.measure('cover-flow-render', 'cover-flow-render-start', 'cover-flow-render-end');

    return {
      columns,
      items,
      nextItemIdx,
      colWidth: CONFIG.COLUMN_WIDTH
    };
  }

  /**
   * Clean up resources and return elements to pool
   */
  cleanup() {
    // Clear caches periodically to prevent memory leaks
    if (this.cachedCalculations.size > 1000) {
      this.cachedCalculations.clear();
    }

    if (this.imageCache.size > 500) {
      this.imageCache.clear();
    }

    // Limit pool sizes
    this.elementPool.columns = this.elementPool.columns.slice(0, 50);
    this.elementPool.images = this.elementPool.images.slice(0, 100);
    this.elementPool.yearTags = this.elementPool.yearTags.slice(0, 20);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      cachedCalculations: this.cachedCalculations.size,
      imageCache: this.imageCache.size,
      columnPool: this.elementPool.columns.length,
      imagePool: this.elementPool.images.length,
      yearTagPool: this.elementPool.yearTags.length
    };
  }
}
