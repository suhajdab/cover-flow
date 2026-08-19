// Configuration constants
export const CONFIG = {
  // Layout constants
  COLUMN_WIDTH: 200,
  MAX_IMAGE_HEIGHT: 320,
  YEAR_TAG_HEIGHT: 54,
  YEAR_TAG_MARGIN: 0,
  MIN_BOTTOM_COVER_VISIBILITY: 0.75,

  // Animation constants
  ANIMATION_SPEED: 30, // pixels per second
  MAX_REPEATS: 10,

  // UI constants
  CARD_HIDE_DELAY: 3000,
  CARD_HIDE_TRANSITION: 500,

  // API constants
  DEFAULT_USER_ID: '18906657',
  DEFAULT_SHELF: 'read',
  API_BASE_PATH: '/api/goodreads'
};

/**
 * Utility functions for URL and API handling
 */
export const Config = {
  /**
   * Get URL search parameters
   * @returns {URLSearchParams} URL search parameters
   */
  getUrlParams() {
    return new URLSearchParams(window.location.search);
  },

  /**
   * Get user ID from URL params or use default
   * @returns {string} User ID
   */
  getUserId() {
    const params = this.getUrlParams();
    return params.get('userId') || CONFIG.DEFAULT_USER_ID;
  },

  /**
   * Get shelf from URL params or use default
   * @returns {string} Shelf name
   */
  getShelf() {
    const params = this.getUrlParams();
    return params.get('shelf') || CONFIG.DEFAULT_SHELF;
  },

  /**
   * Get sort parameter from URL params
   * @returns {string|null} Sort parameter or null if not provided
   */
  getSort() {
    const params = this.getUrlParams();
    return params.get('sort');
  },

  /**
   * Get order parameter from URL params
   * @returns {string|null} Order parameter or null if not provided
   */
  getOrder() {
    const params = this.getUrlParams();
    return params.get('order');
  },

  /**
   * Get key from URL params
   * @returns {string|null} API key or null if not provided
   */
  getKey() {
    return this.getUrlParams().get("key");
  },

  /**
   * Build API request with current parameters
   * @param {number} [page] - Optional page number
   * @returns {{url: string, options: RequestInit}} API URL and fetch options
   */
  buildApiRequest(page) {
    const userId = this.getUserId();
    const shelf = this.getShelf();
    const key = this.getKey();

    const params = new URLSearchParams({
      userId,
      shelf,
      sort: "date_read",
      order: "a"
    });

    if (key) {
      params.set("key", key);
    }
    if (page) {
      params.set('page', page.toString());
    }

    return {
      url: `${CONFIG.API_BASE_PATH}?${params.toString()}`,
      options: {}
    };
  }
};

export const SELECTORS = {
  COVER_FLOW: '#cover-flow',
  FLOATING_CARD: '#floating-card',
  CHANNEL_TITLE: '#channel-title',
  PROGRESS_BAR: '#progress-bar',
  PROGRESS_BAR_INNER: '#progress-bar-inner',
  PROGRESS_TEXT: '#progress-text',
  PROGRESS_LIST: '#progress-list',
  PROGRESS_CONNECT: '#progress-connect',
  PROGRESS_FETCH: '#progress-fetch',
  PROGRESS_IMAGES: '#progress-images'
};

export const CSS_CLASSES = {
  COVER_COLUMN: 'cover-column',
  BOOK_COVER: 'book-cover',
  YEAR_TAG: 'year-tag',
  HIDDEN: 'hidden'
};
