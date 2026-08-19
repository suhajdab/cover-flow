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
      this.redirectToShelf(parsed.userId, parsed.shelf, parsed.key, parsed.sort, parsed.order);
    } catch (error) {
      this.showError(error.message);
    }
  }

  /**
   * Parse Goodreads RSS feed URL to extract userId and shelf
   * @param {string} url - The RSS feed URL
   * @returns {Object} Object with userId, shelf, key, sort, and order
   */
  parseGoodreadsRSSUrl(url) {
    try {
      const urlObj = new URL(url);

      // Strict hostname validation - only allow goodreads.com and www.goodreads.com
      if (urlObj.hostname !== 'goodreads.com' && urlObj.hostname !== 'www.goodreads.com') {
        throw new Error('Please enter a valid Goodreads RSS feed URL (goodreads.com only)');
      }

      // Ensure HTTPS protocol for security
      if (urlObj.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed for security reasons');
      }

      // Extract userId from the path with strict validation
      // Expected format: /review/list_rss/{userId}
      const pathMatch = urlObj.pathname.match(/^\/review\/list_rss\/(\d+)$/);
      if (!pathMatch) {
        throw new Error('Invalid Goodreads RSS URL format. Expected: /review/list_rss/{userId}');
      }

      const userId = pathMatch[1];

      // Validate userId is reasonable (1-15 digits)
      if (userId.length > 15) {
        throw new Error('Invalid user ID format');
      }

      // Extract shelf and key from query parameters with validation
      const searchParams = new URLSearchParams(urlObj.search);
      let shelf = searchParams.get('shelf') || 'read';
      const key = searchParams.get('key');
      const sort = searchParams.get('sort');
      const order = searchParams.get('order');

      // Validate shelf parameter - only allow alphanumeric, hyphens, underscores
      if (!/^[a-zA-Z0-9_-]+$/.test(shelf)) {
        throw new Error('Invalid shelf name format');
      }

      // Validate key parameter if present
      if (key && (key.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(key))) {
        throw new Error('Invalid key format');
      }

      // Validate sort parameter if present - only allow alphanumeric and underscores
      if (sort && !/^[a-zA-Z0-9_]+$/.test(sort)) {
        throw new Error('Invalid sort parameter format');
      }

      // Validate order parameter if present - only allow 'a' or 'd'
      if (order && !/^[ad]$/.test(order)) {
        throw new Error('Invalid order parameter format');
      }

      return { userId, shelf, key, sort, order };
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
   * @param {string} key - Goodreads API key (optional)
   * @param {string} sort - Sort parameter (optional)
   * @param {string} order - Order parameter (optional)
   */
  redirectToShelf(userId, shelf, key, sort, order) {
    const url = new URL(window.location.href);
    url.searchParams.set('userId', userId);
    url.searchParams.set('shelf', shelf);

    if (key) {
      url.searchParams.set("key", key);
    } else {
      url.searchParams.delete("key");
    }

    // Add sort parameter if it exists
    if (sort) {
      url.searchParams.set('sort', sort);
    }

    // Add order parameter if it exists
    if (order) {
      url.searchParams.set('order', order);
    }

    // Navigate to the URL with parameters
    window.location.href = url.toString();
  }

  /**
   * Show error message (XSS-safe)
   * @param {string} message - Error message to display
   */
  showError(message) {
    // Use textContent instead of innerHTML to prevent XSS
    this.errorElement.textContent = this.sanitizeText(message);
    this.errorElement.classList.remove('hidden');
  }

  /**
   * Sanitize text content to prevent XSS
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (typeof text !== 'string') return '';
    // Remove any HTML tags and limit length
    return text.replace(/<[^>]*>/g, '').substring(0, 500);
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
   * Check whether the current URL has a valid Goodreads user ID parameter
   * @returns {boolean} True when userId contains 1 to 15 digits
   */
  static hasValidUserIdParam() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    return typeof userId === "string" && /^\d{1,15}$/.test(userId);
  }
}
