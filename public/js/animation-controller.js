import { CONFIG, CSS_CLASSES } from './config.js';

/**
 * Handles animation of the cover flow
 */
export class AnimationController {
  constructor(coverFlowElement) {
    this.coverFlow = coverFlowElement;
    this.animationFrameId = null;
    this.coverFlowOffset = 0;
    this.lastTimestamp = null;
    this.currentColumns = [];
    this.isRunning = false;
  }

  /**
   * Start the cover flow animation
   * @param {Array} columns - Initial columns
   * @param {number} colWidth - Column width
   * @param {number} height - Viewport height
   * @param {Array} items - Items array
   * @param {number} initialNextItemIdx - Starting item index
   */
  start(columns, colWidth, height, items, initialNextItemIdx) {
    this.stop();

    this.coverFlowOffset = 0;
    this.lastTimestamp = null;
    this.currentColumns = [...columns];
    this.isRunning = true;

    let nextItemIdx = initialNextItemIdx % items.length;

    const animateCoverFlow = (timestamp) => {
      if (!this.isRunning) return;

      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      this.coverFlowOffset -= (CONFIG.ANIMATION_SPEED * delta) / 1000;

      // Add new columns when needed
      const wallWidth = this.getWallWidth(colWidth);
      const viewportWidth = window.innerWidth;

      if (wallWidth + this.coverFlowOffset < viewportWidth + colWidth) {
        nextItemIdx = this.addColumnToRight(items, height, nextItemIdx, colWidth);
      }

      // Remove columns that are out of view
      this.removeColumnFromLeft(colWidth);

      this.coverFlow.style.transform = `translateX(${this.coverFlowOffset}px)`;

      this.animationFrameId = requestAnimationFrame(animateCoverFlow);
    };

    this.animationFrameId = requestAnimationFrame(animateCoverFlow);
  }

  /**
   * Stop the animation
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;
  }

  /**
   * Get total width of current wall
   * @param {number} colWidth - Column width
   * @returns {number} Total wall width
   */
  getWallWidth(colWidth) {
    return this.currentColumns.length * colWidth;
  }

  /**
   * Add a new column to the right side
   * @param {Array} items - Items array
   * @param {number} height - Target height
   * @param {number} nextItemIdx - Current item index
   * @param {number} colWidth - Column width
   * @returns {number} Updated next item index
   */
  addColumnToRight(items, height, nextItemIdx, colWidth) {
    const col = {
      div: document.createElement('div'),
      height: 0
    };
    col.div.className = CSS_CLASSES.COVER_COLUMN;

    let filled = false;
    let repeats = 0;
    let i = nextItemIdx;

    while (!filled && repeats < CONFIG.MAX_REPEATS) {
      for (; i < items.length; ++i) {
        const item = items[i];

        if (item.type === 'year-divider') {
          const yearTag = document.createElement('div');
          yearTag.className = CSS_CLASSES.YEAR_TAG;
          yearTag.textContent = item.year;
          col.div.appendChild(yearTag);
          col.height += CONFIG.YEAR_TAG_HEIGHT + CONFIG.YEAR_TAG_MARGIN;
        } else if (item.type === 'book') {
          const imgNode = item.image.cloneNode(true);
          imgNode.className = CSS_CLASSES.BOOK_COVER;
          imgNode.alt = item.book.title || 'Book cover';
          imgNode.removeAttribute('style');
          imgNode.onload = null;
          imgNode.onerror = null;

          col.div.appendChild(imgNode);
          const scaledHeight = Math.min(
            item.image.naturalHeight * (CONFIG.COLUMN_WIDTH / item.image.naturalWidth),
            CONFIG.MAX_IMAGE_HEIGHT
          );
          col.height += scaledHeight;
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

    this.coverFlow.appendChild(col.div);
    this.currentColumns.push(col);

    return i % items.length;
  }

  /**
   * Remove columns that are no longer visible
   * @param {number} colWidth - Column width
   */
  removeColumnFromLeft(colWidth) {
    if (this.currentColumns.length === 0) return;

    const leftEdge = this.coverFlowOffset + colWidth;
    if (leftEdge <= 0) {
      if (this.coverFlow.firstChild) {
        this.coverFlow.removeChild(this.coverFlow.firstChild);
      }
      this.currentColumns.shift();
      this.coverFlowOffset += colWidth;
    }
  }

  /**
   * Check if animation is currently running
   * @returns {boolean} True if animation is running
   */
  isAnimationRunning() {
    return this.isRunning;
  }
}
