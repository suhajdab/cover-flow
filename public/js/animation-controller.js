import { CONFIG, CSS_CLASSES } from './config.js';
import { createColumnLayout, findPreviousColumnStartItemIndex } from './cover-flow-renderer.js';

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
  start(columns, colWidth, height, items, initialStartItemIdx = 0) {
    this.stop();

    this.coverFlowOffset = 0;
    this.lastTimestamp = null;
    this.currentColumns = [...columns];
    this.isRunning = true;
    this.cachedDimensions.clear();

    // Pre-cache item dimensions
    this.precacheItemDimensions(items);

    let previousItemIdx = findPreviousColumnStartItemIndex(
      items,
      height,
      initialStartItemIdx,
      item => this.getItemHeight(item)
    );

    const animateCoverFlow = (timestamp) => {
      if (!this.isRunning) return;

      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      this.coverFlowOffset += (CONFIG.ANIMATION_SPEED * delta) / 1000;

      // Use cached viewport width to avoid layout thrashing
      const viewportWidth = this.getCachedViewportWidth();

      while (this.coverFlowOffset >= 0 && items.length > 0) {
        previousItemIdx = this.addColumnToLeftOptimized(items, height, previousItemIdx);
        this.coverFlowOffset -= colWidth;
      }

      this.removeColumnsFromRightOptimized(colWidth, viewportWidth);

      // Use transform3d for better performance
      this.coverFlow.style.transform = `translate3d(${this.coverFlowOffset}px, 0, 0)`;

      this.animationFrameId = requestAnimationFrame(animateCoverFlow);
    };

    this.animationFrameId = requestAnimationFrame(animateCoverFlow);
  }

  /**
   * Calculate rendered item height using the same rules as column planning
   */
  getItemHeight(item) {
    if (item.type === "year-divider") {
      return CONFIG.YEAR_TAG_HEIGHT + CONFIG.YEAR_TAG_MARGIN;
    }

    if (item.type === "book") {
      return Math.min(
        item.image.naturalHeight * (CONFIG.COLUMN_WIDTH / item.image.naturalWidth),
        CONFIG.MAX_IMAGE_HEIGHT
      );
    }

    return 0;
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
  addColumnToLeftOptimized(items, height, startItemIdx) {
    const col = this.createOrReuseColumn();
    const layout = createColumnLayout(1, items, height, startItemIdx, item => this.getItemHeight(item));
    this.populateColumnFromLayout(col, layout.columns[0], items);

    this.coverFlow.insertBefore(col.div, this.coverFlow.firstChild);
    this.currentColumns.unshift(col);

    return findPreviousColumnStartItemIndex(items, height, startItemIdx, item => this.getItemHeight(item));
  }

  /**
   * Populate a column from the shared layout planner
   */
  populateColumnFromLayout(col, layoutColumn, items) {
    const fragment = document.createDocumentFragment();

    layoutColumn.entries.forEach(entry => {
      const item = entry.item;

      if (item.type === 'year-divider') {
        const yearTag = this.createOptimizedYearTag(item.year);
        fragment.appendChild(yearTag);
      } else if (item.type === 'book') {
        const imgNode = this.createOrReuseImage(item, item.index ?? items.indexOf(item));
        fragment.appendChild(imgNode);
      }

      col.height += entry.height;
    });

    col.div.appendChild(fragment);
  }

  /**
   * Optimized column removal with element pooling
   */
  removeColumnsFromRightOptimized(colWidth, viewportWidth) {
    while (this.currentColumns.length > 0) {
      const rightColumnLeft = ((this.currentColumns.length - 1) * colWidth) + this.coverFlowOffset;

      if (rightColumnLeft < viewportWidth) {
        return;
      }

      const removedColumn = this.currentColumns.pop();

      if (this.coverFlow.lastChild) {
        this.coverFlow.removeChild(this.coverFlow.lastChild);
      }

      // Return column to pool for reuse
      if (this.columnPool.length < 10) { // Limit pool size
        this.columnPool.push(removedColumn);
      }
    }
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
