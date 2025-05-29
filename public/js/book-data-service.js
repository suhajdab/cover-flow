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
   * Fetch book data from the API with progress tracking
   * @returns {Promise<Object>} Book data response
   */
  async fetchBookData() {
    try {
      const apiEndpoint = Config.buildApiEndpoint();

      // Show connection progress
      this.onProgress?.('connect');

      const response = await fetch(apiEndpoint);

      if (!response.ok) {
        throw this.createHttpError(response.status);
      }

      // Show parsing progress
      this.onProgress?.('fetch');

      const data = await response.json();

      // Show completion with book count
      const bookCount = data.items?.length || 0;
      this.onProgress?.('fetch_complete', bookCount);

      return data;
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
