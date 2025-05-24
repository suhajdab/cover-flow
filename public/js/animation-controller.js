import { CONFIG, CSS_CLASSES } from './config.js';

/**
 * Performance-optimized animation controller with GPU acceleration and efficient DOM management
 */
export class AnimationController {
  constructor(coverFlowElement) {
    this.coverFlow = coverFlowElement;
    this.animationFrameId = null;
    this.coverFlowOffset = 0;
    this.lastTimestamp = null;
    this.currentColumns = [];
    this.isRunning = false;

    // Performance optimizations
    this.columnPool = []; // Pool of reusable column elements
    this.imagePool = new Map(); // Pool of reusable image elements
    this.scheduledDOMUpdates = new Set(); // Batch DOM updates
    this.cachedDimensions = new Map(); // Cache expensive calculations

    // Enable GPU acceleration on container
    this.optimizeContainer();
  }

  /**
   * Optimize container for GPU acceleration
   */
  optimizeContainer() {
    this.coverFlow.style.willChange = 'transform';
    this.coverFlow.style.transform = 'translateZ(0)'; // Force hardware acceleration
    this.coverFlow.style.backfaceVisibility = 'hidden';
  }

  /**
   * Start the cover flow animation with optimizations
   */
  start(columns, colWidth, height, items, initialNextItemIdx) {
    this.stop();

    this.coverFlowOffset = 0;
    this.lastTimestamp = null;
    this.currentColumns = [...columns];
    this.isRunning = true;
    this.cachedDimensions.clear();

    // Pre-cache item dimensions
    this.precacheItemDimensions(items);

    let nextItemIdx = initialNextItemIdx % items.length;

    const animateCoverFlow = (timestamp) => {
      if (!this.isRunning) return;

      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      this.coverFlowOffset -= (CONFIG.ANIMATION_SPEED * delta) / 1000;

      // Use cached viewport width to avoid layout thrashing
      const viewportWidth = this.getCachedViewportWidth();
      const wallWidth = this.getWallWidth(colWidth);

      // Add new column when the last column starts to become visible (not when fully visible)
      if (wallWidth + this.coverFlowOffset <= viewportWidth) {
        nextItemIdx = this.addColumnToRightOptimized(items, height, nextItemIdx, colWidth);
      }

      this.removeColumnFromLeftOptimized(colWidth);

      // Use transform3d for better performance
      this.coverFlow.style.transform = `translate3d(${this.coverFlowOffset}px, 0, 0)`;

      this.animationFrameId = requestAnimationFrame(animateCoverFlow);
    };

    this.animationFrameId = requestAnimationFrame(animateCoverFlow);
  }

  /**
   * Pre-cache expensive dimension calculations
   */
  precacheItemDimensions(items) {
    items.forEach((item, index) => {
      if (item.type === 'book' && item.image) {
        const cacheKey = `book-${index}`;
        if (!this.cachedDimensions.has(cacheKey)) {
          const scaledHeight = Math.min(
            item.image.naturalHeight * (CONFIG.COLUMN_WIDTH / item.image.naturalWidth),
            CONFIG.MAX_IMAGE_HEIGHT
          );
          this.cachedDimensions.set(cacheKey, scaledHeight);
        }
      } else if (item.type === 'year-divider') {
        const cacheKey = `year-${item.year}`;
        if (!this.cachedDimensions.has(cacheKey)) {
          this.cachedDimensions.set(cacheKey, CONFIG.YEAR_TAG_HEIGHT + CONFIG.YEAR_TAG_MARGIN);
        }
      }
    });
  }

  /**
   * Get cached viewport width to avoid repeated DOM queries
   */
  getCachedViewportWidth() {
    const now = performance.now();
    const cacheKey = 'viewport-width';
    const cached = this.cachedDimensions.get(cacheKey);

    // Cache viewport width for 100ms to avoid excessive DOM queries
    if (!cached || now - cached.timestamp > 100) {
      const width = window.innerWidth;
      this.cachedDimensions.set(cacheKey, { width, timestamp: now });
      return width;
    }

    return cached.width;
  }

  /**
   * Create or reuse column element from pool
   */
  createOrReuseColumn() {
    if (this.columnPool.length > 0) {
      const col = this.columnPool.pop();
      col.div.innerHTML = ''; // Clear previous content
      col.height = 0;
      return col;
    }

    return {
      div: this.createOptimizedColumnElement(),
      height: 0
    };
  }

  /**
   * Create optimized column element with GPU acceleration
   */
  createOptimizedColumnElement() {
    const div = document.createElement('div');
    div.className = CSS_CLASSES.COVER_COLUMN;
    // Enable GPU acceleration for columns
    div.style.willChange = 'transform';
    div.style.transform = 'translateZ(0)';
    return div;
  }

  /**
   * Create or reuse image element with optimizations
   */
  createOrReuseImage(item, itemIndex) {
    const cacheKey = `${item.book.title}-${itemIndex}`;

    if (this.imagePool.has(cacheKey)) {
      return this.imagePool.get(cacheKey).cloneNode(false);
    }

    const imgNode = item.image.cloneNode(false);
    imgNode.className = CSS_CLASSES.BOOK_COVER;
    imgNode.alt = item.book.title || 'Book cover';
    imgNode.draggable = false; // Prevent drag operations

    // Optimize image rendering
    imgNode.style.willChange = 'transform';
    imgNode.style.transform = 'translateZ(0)';
    imgNode.loading = 'lazy';

    // Clean up any existing handlers
    imgNode.onload = null;
    imgNode.onerror = null;
    imgNode.removeAttribute('style');

    // Cache the optimized image
    this.imagePool.set(cacheKey, imgNode);

    return imgNode.cloneNode(false);
  }

  /**
   * Optimized column addition with batched DOM operations
   */
  addColumnToRightOptimized(items, height, nextItemIdx, colWidth) {
    const col = this.createOrReuseColumn();

    let filled = false;
    let repeats = 0;
    let i = nextItemIdx;
    const fragment = document.createDocumentFragment(); // Batch DOM operations

    while (!filled && repeats < CONFIG.MAX_REPEATS) {
      for (; i < items.length; ++i) {
        const item = items[i];

        if (item.type === 'year-divider') {
          const yearTag = this.createOptimizedYearTag(item.year);
          fragment.appendChild(yearTag);
          const cachedHeight = this.cachedDimensions.get(`year-${item.year}`) ||
            (CONFIG.YEAR_TAG_HEIGHT + CONFIG.YEAR_TAG_MARGIN);
          col.height += cachedHeight;
        } else if (item.type === 'book') {
          const imgNode = this.createOrReuseImage(item, i);
          fragment.appendChild(imgNode);

          const cacheKey = `book-${i}`;
          const cachedHeight = this.cachedDimensions.get(cacheKey) ||
            Math.min(
              item.image.naturalHeight * (CONFIG.COLUMN_WIDTH / item.image.naturalWidth),
              CONFIG.MAX_IMAGE_HEIGHT
            );
          col.height += cachedHeight;
        }

        if (col.height >= height) {
          filled = true;
          i++;
          break;
        }
      }

      if (!filled) {
        i = 0;
        repeats++;
      }
    }

    // Single DOM append operation
    col.div.appendChild(fragment);
    this.coverFlow.appendChild(col.div);
    this.currentColumns.push(col);

    return i % items.length;
  }

  /**
   * Create optimized year tag element
   */
  createOptimizedYearTag(year) {
    const yearTag = document.createElement('div');
    yearTag.className = CSS_CLASSES.YEAR_TAG;
    yearTag.textContent = year;

    // GPU acceleration for year tags
    yearTag.style.willChange = 'transform';
    yearTag.style.transform = 'translateZ(0)';

    return yearTag;
  }

  /**
   * Optimized column removal with element pooling
   */
  removeColumnFromLeftOptimized(colWidth) {
    if (this.currentColumns.length === 0) return;

    const leftEdge = this.coverFlowOffset + colWidth;
    if (leftEdge <= 0) {
      const removedColumn = this.currentColumns.shift();

      if (this.coverFlow.firstChild) {
        this.coverFlow.removeChild(this.coverFlow.firstChild);
      }

      // Return column to pool for reuse
      if (this.columnPool.length < 10) { // Limit pool size
        this.columnPool.push(removedColumn);
      }

      this.coverFlowOffset += colWidth;
    }
  }

  /**
   * Stop animation and clean up resources
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;

    // Clear caches periodically to prevent memory leaks
    if (this.cachedDimensions.size > 1000) {
      this.cachedDimensions.clear();
    }

    if (this.imagePool.size > 500) {
      this.imagePool.clear();
    }
  }

  /**
   * Get total width of current wall
   */
  getWallWidth(colWidth) {
    return this.currentColumns.length * colWidth;
  }

  /**
   * Check if animation is currently running
   */
  isAnimationRunning() {
    return this.isRunning;
  }

  /**
   * Clean up all resources
   */
  destroy() {
    this.stop();
    this.columnPool = [];
    this.imagePool.clear();
    this.cachedDimensions.clear();
    this.scheduledDOMUpdates.clear();
  }
}
