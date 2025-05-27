/**
 * RSS Dialog handler for capturing Goodreads RSS feed URLs
 */
export class RSSDialog {
  constructor() {
    this.dialog = null;
    this.input = null;
    this.submitButton = null;
    this.errorElement = null;
    this.initialized = false;
  }

  /**
   * Initialize the dialog elements
   */
  initialize() {
    if (this.initialized) return;

    this.dialog = document.getElementById('rss-dialog');
    this.input = document.getElementById('rss-url-input');
    this.submitButton = document.getElementById('submit-rss-url');
    this.errorElement = document.getElementById('rss-error');

    if (!this.dialog || !this.input || !this.submitButton || !this.errorElement) {
      throw new Error('RSS dialog elements not found in DOM');
    }

    this.setupEventListeners();
    this.initialized = true;
  }

  /**
   * Set up event listeners for the dialog
   */
  setupEventListeners() {
    // Submit button click
    this.submitButton.addEventListener('click', () => {
      this.handleSubmit();
    });

    // Enter key in input field
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSubmit();
      }
    });

    // Input validation on type
    this.input.addEventListener('input', () => {
      this.clearError();
      this.validateInput();
    });

    // Close dialog on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });

    // Close dialog on backdrop click
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) {
        this.hide();
      }
    });
  }

  /**
   * Show the dialog
   */
  show() {
    if (!this.initialized) {
      this.initialize();
    }
    this.dialog.classList.remove('hidden');
    this.input.focus();
  }

  /**
   * Hide the dialog
   */
  hide() {
    this.dialog.classList.add('hidden');
    this.clearError();
    this.input.value = '';
  }

  /**
   * Check if dialog is visible
   */
  isVisible() {
    return !this.dialog.classList.contains('hidden');
  }

  /**
   * Handle form submission
   */
  handleSubmit() {
    const url = this.input.value.trim();

    if (!url) {
      this.showError('Please enter a Goodreads RSS feed URL');
      return;
    }

    try {
      const parsed = this.parseGoodreadsRSSUrl(url);
      this.redirectToShelf(parsed.userId, parsed.shelf);
    } catch (error) {
      this.showError(error.message);
    }
  }

  /**
   * Parse Goodreads RSS feed URL to extract userId and shelf
   * @param {string} url - The RSS feed URL
   * @returns {Object} Object with userId and shelf
   */
  parseGoodreadsRSSUrl(url) {
    try {
      const urlObj = new URL(url);

      // Check if it's a Goodreads URL
      if (!urlObj.hostname.includes('goodreads.com')) {
        throw new Error('Please enter a valid Goodreads RSS feed URL');
      }

      // Extract userId from the path
      // Expected format: /review/list_rss/{userId}
      const pathMatch = urlObj.pathname.match(/\/review\/list_rss\/(\d+)/);
      if (!pathMatch) {
        throw new Error('Invalid Goodreads RSS URL format. Expected: /review/list_rss/{userId}');
      }

      const userId = pathMatch[1];

      // Extract shelf from query parameters
      const searchParams = new URLSearchParams(urlObj.search);
      const shelf = searchParams.get('shelf') || 'read';

      return { userId, shelf };
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Please enter a valid URL');
      }
      throw error;
    }
  }

  /**
   * Redirect to the app with userId and shelf parameters
   * @param {string} userId - Goodreads user ID
   * @param {string} shelf - Shelf name
   */
  redirectToShelf(userId, shelf) {
    const url = new URL(window.location.href);
    url.searchParams.set('userId', userId);
    url.searchParams.set('shelf', shelf);

    // Navigate to the URL with parameters
    window.location.href = url.toString();
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    this.errorElement.textContent = message;
    this.errorElement.classList.remove('hidden');
  }

  /**
   * Clear error message
   */
  clearError() {
    this.errorElement.classList.add('hidden');
    this.errorElement.textContent = '';
  }

  /**
   * Validate input and update submit button state
   */
  validateInput() {
    const url = this.input.value.trim();
    this.submitButton.disabled = !url;
  }

  /**
   * Check if query parameters exist in current URL
   * @returns {boolean} True if userId or shelf parameters exist
   */
  static hasRequiredParams() {
    const params = new URLSearchParams(window.location.search);
    // Check if we have actual parameters (not just using defaults)
    return params.has('userId') || params.has('shelf');
  }
}
