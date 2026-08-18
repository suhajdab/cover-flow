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
  start(columns, colWidth, items, columnLayouts, nextColumnLayoutIndex = 0) {
    this.stop();

    this.coverFlowOffset = 0;
    this.coverFlow.style.transform = 'translate3d(0px, 0, 0)';
    this.lastTimestamp = null;
    this.currentColumns = [...columns];
    this.isRunning = true;
    this.cachedDimensions.clear();

    const animateCoverFlow = (timestamp) => {
      if (!this.isRunning) return;

      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      this.coverFlowOffset -= (CONFIG.ANIMATION_SPEED * delta) / 1000;

      while (this.coverFlowOffset <= -colWidth && columnLayouts.length > 0) {
        this.removeColumnFromLeftOptimized();
        this.addColumnToRightOptimized(columnLayouts[nextColumnLayoutIndex], items);
        nextColumnLayoutIndex = (nextColumnLayoutIndex + 1) % columnLayouts.length;
        this.coverFlowOffset += colWidth;
      }

      // Use transform3d for better performance
      this.coverFlow.style.transform = `translate3d(${this.coverFlowOffset}px, 0, 0)`;

      this.animationFrameId = requestAnimationFrame(animateCoverFlow);
    };

    this.animationFrameId = requestAnimationFrame(animateCoverFlow);
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
  addColumnToRightOptimized(layoutColumn, items) {
    const col = this.createOrReuseColumn();
    this.populateColumnFromLayout(col, layoutColumn, items);

    this.coverFlow.appendChild(col.div);
    this.currentColumns.push(col);
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
  removeColumnFromLeftOptimized() {
    const removedColumn = this.currentColumns.shift();

    if (this.coverFlow.firstChild) {
      this.coverFlow.removeChild(this.coverFlow.firstChild);
    }

    if (removedColumn && this.columnPool.length < 10) {
      this.columnPool.push(removedColumn);
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
