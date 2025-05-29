import { Config } from './config.js';

/**
 * Service for handling API calls and data management
 */
export class BookDataService {
  constructor() {
    this.bookData = null;
    this.books = [];
    this.onProgress = null;
  }

  /**
   * Set progress callback for RSS parsing
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  /**
   * Fetch book data from the API with polling progress tracking
   * @returns {Promise<Object>} Book data response
   */
  async fetchBookData() {
    try {
      // Show connection progress
      this.onProgress?.('connect');

      let allItems = [];
      let totalBooks = 0;
      let channelTitle = '';
      let page = 1;
      let hasMore = true;

      // Show fetch start
      this.onProgress?.('fetch');

      while (hasMore && page <= 20) {
        const apiEndpoint = Config.buildApiEndpoint() + `&page=${page}&streaming=false`;

        const response = await fetch(apiEndpoint);

        if (!response.ok) {
          throw this.createHttpError(response.status);
        }

        const pageData = await response.json();

        // Add items to collection
        allItems.push(...pageData.items);
        totalBooks = allItems.length;
        channelTitle = pageData.title;

        // Update channel title immediately after first page
        if (page === 1 && channelTitle) {
          this.onProgress?.('channel_title', channelTitle);
        }

        // Update progress
        this.onProgress?.('fetch_progress', totalBooks, page);

        // Check if there are more pages
        hasMore = pageData.hasMore;
        page++;

        // Small delay to show progress visually
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Show completion
      this.onProgress?.('fetch_complete', totalBooks);

      return {
        items: allItems,
        total: totalBooks,
        title: channelTitle
      };
    } catch (error) {
      console.error('Failed to fetch book data:', error);
      throw error;
    }
  }

  /**
   * Create appropriate error based on HTTP status
   * @param {number} status - HTTP status code
   * @returns {Error} Appropriate error object
   */
  createHttpError(status) {
    const errorMessages = {
      401: 'Authentication failed - the server rejected the request',
      403: 'Access forbidden - check API permissions',
      500: 'Server error - please try again later'
    };

    const message = errorMessages[status] || `HTTP error! status: ${status}`;
    return new Error(message);
  }

  /**
   * Initialize book data
   * @returns {Promise<Array>} Array of books
   */
  async initialize() {
    this.bookData = await this.fetchBookData();
    this.books = Array.isArray(this.bookData.items) ? this.bookData.items : [];
    return this.books;
  }

  /**
   * Get book data
   * @returns {Object} Book data object
   */
  getBookData() {
    return this.bookData;
  }

  /**
   * Get books array
   * @returns {Array} Books array
   */
  getBooks() {
    return this.books;
  }

  /**
   * Get book count
   * @returns {number} Total number of books
   */
  getBookCount() {
    return this.bookData?.total || this.books.length;
  }

  /**
   * Get channel title
   * @returns {string} Channel title
   */
  getChannelTitle() {
    return this.bookData?.title || 'Book Collection';
  }
}
