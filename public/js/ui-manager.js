import { SELECTORS, CSS_CLASSES, CONFIG } from './config.js';

/**
 * Manages UI elements and user feedback
 */
export class UIManager {
  constructor() {
    this.elements = this.initializeElements();
  }

  /**
   * Initialize DOM element references
   * @returns {Object} Object containing DOM element references
   */
  initializeElements() {
    const elements = {};

    Object.entries(SELECTORS).forEach(([key, selector]) => {
      elements[key] = document.querySelector(selector);
      if (!elements[key]) {
        console.warn(`Element not found for selector: ${selector}`);
      }
    });

    return elements;
  }

  /**
   * Update progress bar and text
   * @param {number} loaded - Number of loaded items
   * @param {number} failed - Number of failed items
   * @param {number} total - Total number of items
   */
  updateProgress(loaded, failed, total) {
    const percent = total ? Math.round((loaded + failed) / total * 100) : 100;

    if (this.elements.PROGRESS_BAR_INNER) {
      this.elements.PROGRESS_BAR_INNER.style.width = percent + '%';
    }

    if (this.elements.PROGRESS_TEXT) {
      this.elements.PROGRESS_TEXT.textContent = `Loading covers: ${loaded + failed} / ${total}`;
    }
  }

  /**
   * Set progress text message
   * @param {string} message - Message to display
   */
  setProgressText(message) {
    if (this.elements.PROGRESS_TEXT) {
      this.elements.PROGRESS_TEXT.textContent = message;
    }
  }

  /**
   * Reset progress bar
   */
  resetProgress() {
    if (this.elements.PROGRESS_BAR_INNER) {
      this.elements.PROGRESS_BAR_INNER.style.width = '0%';
    }
  }

  /**
   * Update channel information
   * @param {string} title - Channel title
   * @param {number} bookCount - Number of books
   */
  updateChannelInfo(title, bookCount) {
    if (this.elements.CHANNEL_TITLE) {
      this.elements.CHANNEL_TITLE.textContent = title;
    }

    if (this.elements.BOOK_COUNT) {
      this.elements.BOOK_COUNT.textContent = `Books: ${bookCount}`;
    }
  }

  /**
   * Show error message
   * @param {Error} error - Error object
   */
  showError(error) {
    let errorMessage = 'Failed to load book data.';

    if (error.message.includes('Authentication failed')) {
      errorMessage = 'API authentication failed. Server needs to be updated.';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Network error. Check your connection and try again.';
    }

    this.setProgressText(errorMessage);
    this.resetProgress();
    this.showCard();

    console.error('Application error:', error);
  }

  /**
   * Show the floating card
   */
  showCard() {
    if (this.elements.FLOATING_CARD) {
      this.elements.FLOATING_CARD.classList.remove(CSS_CLASSES.HIDDEN);
    }
  }

  /**
   * Hide the floating card with delay
   */
  hideCardWithDelay() {
    setTimeout(() => {
      setTimeout(() => {
        if (this.elements.FLOATING_CARD) {
          this.elements.FLOATING_CARD.classList.add(CSS_CLASSES.HIDDEN);
        }
      }, CONFIG.CARD_HIDE_DELAY);
    }, CONFIG.CARD_HIDE_TRANSITION);
  }

  /**
   * Get viewport dimensions
   * @returns {Object} Object with width and height properties
   */
  getViewportSize() {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  /**
   * Check if no books message should be shown
   * @param {Array} books - Books array
   * @returns {boolean} True if no books found
   */
  handleEmptyState(books) {
    if (!books || books.length === 0) {
      this.setProgressText('No books found.');
      return true;
    }
    return false;
  }
}
