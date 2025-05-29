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
   * Initialize progress list to show all steps
   */
  initializeProgressList() {
    this.setProgressItemState('connect', 'pending');
    this.setProgressItemState('fetch', 'pending');
    this.setProgressItemState('images', 'pending');
  }

  /**
   * Set the state of a progress item
   * @param {string} step - Step name ('connect', 'fetch', 'images')
   * @param {string} state - State ('pending', 'active', 'completed')
   * @param {string} status - Optional status text to display
   */
  setProgressItemState(step, state, status = '') {
    const elementKey = `PROGRESS_${step.toUpperCase()}`;
    const element = this.elements[elementKey];

    if (!element) return;

    // Remove all state classes
    element.classList.remove('active', 'completed');

    // Add new state class
    if (state !== 'pending') {
      element.classList.add(state);
    }

    // Update status text
    const statusElement = element.querySelector('.progress-status');
    if (statusElement && status) {
      statusElement.textContent = status;
    }
  }

  /**
   * Update connection progress
   */
  updateConnectionProgress() {
    this.setProgressItemState('connect', 'active');
  }

  /**
   * Update book fetching progress during streaming
   * @param {number} bookCount - Current number of books fetched
   */
  updateFetchingProgress(bookCount) {
    this.setProgressItemState('connect', 'completed');
    this.setProgressItemState('fetch', 'active', `${bookCount} books`);
  }

  /**
   * Mark fetch as completed and prepare for image loading
   * @param {number} bookCount - Final number of books found
   */
  updateFetchProgress(bookCount = 0) {
    this.setProgressItemState('connect', 'completed');
    this.setProgressItemState('fetch', 'completed', `${bookCount} books`);
  }

  /**
   * Update image loading progress
   * @param {number} loaded - Number of loaded images
   * @param {number} failed - Number of failed images  
   * @param {number} total - Total number of images
   */
  updateImageLoadingProgress(loaded, failed, total) {
    this.setProgressItemState('images', 'active', `${loaded + failed}/${total}`);

    // Update progress bar
    const percent = total ? Math.round((loaded + failed) / total * 100) : 100;
    if (this.elements.PROGRESS_BAR_INNER) {
      this.elements.PROGRESS_BAR_INNER.style.width = percent + '%';
    }

    // Mark as completed when all images are processed
    if (loaded + failed === total) {
      this.setProgressItemState('images', 'completed', total.toString());
    }
  }

  /**
   * Update progress with custom message and optional progress bar
   * @param {string} message - Custom message to display
   * @param {number} loaded - Number of loaded items (optional)
   * @param {number} failed - Number of failed items (optional)
   * @param {number} total - Total number of items (optional)
   */
  updateProgressWithMessage(message, loaded = 0, failed = 0, total = 0) {
    if (total > 0) {
      const percent = Math.round((loaded + failed) / total * 100);
      if (this.elements.PROGRESS_BAR_INNER) {
        this.elements.PROGRESS_BAR_INNER.style.width = percent + '%';
      }
    }

    if (this.elements.PROGRESS_TEXT) {
      this.elements.PROGRESS_TEXT.textContent = message;
    }
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
   * Update progress bar and text for image loading
   * @param {number} loaded - Number of loaded items
   * @param {number} failed - Number of failed items
   * @param {number} total - Total number of items
   */
  updateImageProgress(loaded, failed, total) {
    const percent = total ? Math.round((loaded + failed) / total * 100) : 100;

    if (this.elements.PROGRESS_BAR_INNER) {
      this.elements.PROGRESS_BAR_INNER.style.width = percent + '%';
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
      this.elements.FLOATING_CARD.classList.remove('slide-out');
    }
  }

  /**
   * Hide the floating card with delay
   */
  hideCardWithDelay() {
    // Wait for the content to be visible, then start the hide sequence
    setTimeout(() => {
      if (this.elements.FLOATING_CARD) {
        this.elements.FLOATING_CARD.classList.add('slide-out');
      }
    }, CONFIG.CARD_HIDE_DELAY);
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
