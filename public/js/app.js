import { BookDataService } from './book-data-service.js';
import { ImageLoader } from './image-loader.js';
import { CoverFlowRenderer } from './cover-flow-renderer.js';
import { AnimationController } from './animation-controller.js';
import { UIManager } from './ui-manager.js';
import { SELECTORS } from './config.js';

/**
 * Main application class that orchestrates all components
 */
export class BookCoverFlowApp {
  constructor() {
    this.bookDataService = new BookDataService();
    this.imageLoader = new ImageLoader();
    this.uiManager = new UIManager();

    // Initialize components that need DOM elements
    this.coverFlowRenderer = null;
    this.animationController = null;

    // Bind methods
    this.handleResize = this.debounce(this.handleResize.bind(this), 250);
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Initialize DOM-dependent components
      const coverFlowElement = document.querySelector(SELECTORS.COVER_FLOW);
      if (!coverFlowElement) {
        throw new Error('Cover flow element not found');
      }

      this.coverFlowRenderer = new CoverFlowRenderer(coverFlowElement);
      this.animationController = new AnimationController(coverFlowElement);

      // Set up event listeners
      this.setupEventListeners();

      // Initialize UI
      this.uiManager.resetProgress();
      this.uiManager.setProgressText('Fetching book data...');

      // Load book data
      const books = await this.bookDataService.initialize();

      // Update UI with book info
      this.uiManager.updateChannelInfo(
        this.bookDataService.getChannelTitle(),
        this.bookDataService.getBookCount()
      );

      // Check for empty state
      if (this.uiManager.handleEmptyState(books)) {
        return;
      }

      // Build the wall
      await this.buildWall();

    } catch (error) {
      this.uiManager.showError(error);
    }
  }

  /**
   * Build the book cover wall
   */
  async buildWall() {
    const books = this.bookDataService.getBooks();

    if (this.uiManager.handleEmptyState(books)) {
      return;
    }

    // Stop any existing animation
    this.animationController?.stop();

    // Reset progress
    this.uiManager.resetProgress();
    this.uiManager.setProgressText('Loading covers...');

    // Set up progress callback
    this.imageLoader.setProgressCallback((loaded, failed, total) => {
      this.uiManager.updateProgress(loaded, failed, total);
    });

    try {
      // Load images
      const images = await this.imageLoader.preloadImages(books);

      // Render the wall
      const { width, height } = this.uiManager.getViewportSize();
      const renderResult = this.coverFlowRenderer.renderWall(books, images, width, height);

      // Start animation
      this.animationController.start(
        renderResult.columns,
        renderResult.colWidth,
        height,
        renderResult.items,
        renderResult.nextItemIdx
      );

      // Hide the floating card after a delay
      this.uiManager.hideCardWithDelay();

    } catch (error) {
      console.error('Failed to build wall:', error);
      this.uiManager.showError(error);
    }
  }

  /**
   * Handle window resize events
   */
  handleResize() {
    if (this.animationController?.isAnimationRunning()) {
      this.buildWall();
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.animationController?.stop();
    window.removeEventListener('resize', this.handleResize);
  }

  /**
   * Debounce utility function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new BookCoverFlowApp();
  app.initialize();

  // Make app globally available for debugging
  window.bookCoverFlowApp = app;
});
