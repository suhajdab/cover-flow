import { BookDataService } from './book-data-service.js';
import { ImageLoader } from './image-loader.js';
import { CoverFlowRenderer } from './cover-flow-renderer.js';
import { AnimationController } from './animation-controller.js';
import { UIManager } from './ui-manager.js';
import { RSSDialog } from './rss-dialog.js';
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
  }  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Check if we have required query parameters
      if (!RSSDialog.hasRequiredParams()) {
        this.showRSSDialog();
        return;
      }

      // Initialize DOM-dependent components
      const coverFlowElement = document.querySelector(SELECTORS.COVER_FLOW);
      if (!coverFlowElement) {
        throw new Error('Cover flow element not found');
      }

      this.coverFlowRenderer = new CoverFlowRenderer(coverFlowElement);
      this.animationController = new AnimationController(coverFlowElement);

      // Set up event listeners
      this.setupEventListeners();

      // Initialize progress list UI
      this.uiManager.initializeProgressList();

      // Set up RSS parsing progress callback
      this.bookDataService.setProgressCallback((step, bookCount) => {
        switch (step) {
          case 'connect':
            this.uiManager.updateConnectionProgress();
            break;
          case 'fetch':
            this.uiManager.setProgressItemState('connect', 'completed');
            this.uiManager.setProgressItemState('fetch', 'active');
            break;
          case 'fetch_complete':
            this.uiManager.updateFetchProgress(bookCount);
            break;
        }
      });

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

    // Set up progress callback for image loading
    this.imageLoader.setProgressCallback((loaded, failed, total) => {
      this.uiManager.updateImageLoadingProgress(loaded, failed, total);
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
   * Log performance metrics to console
   */
  logPerformanceMetrics() {
    console.group('🚀 Application Performance Metrics');
    console.log(`⚡ Init Time: ${this.performanceMetrics.initTime.toFixed(2)}ms`);
    console.log(`🎨 Render Time: ${this.performanceMetrics.renderTime.toFixed(2)}ms`);
    console.log(`📊 Animation Started: ${(this.performanceMetrics.animationStartTime - this.performanceMetrics.startTime).toFixed(2)}ms from start`);

    // Get renderer metrics
    const rendererMetrics = this.coverFlowRenderer.getPerformanceMetrics();
    console.log(`🗄️ Cache Efficiency:`, rendererMetrics);

    // Performance summary from monitor
    setTimeout(() => {
      performanceMonitor.logReport();
    }, 2000); // Wait 2 seconds for FPS measurement

    console.groupEnd();
  }

  /**
   * Show the RSS dialog for URL input
   */
  showRSSDialog() {
    const rssDialog = new RSSDialog();
    rssDialog.show();
  }

  /**
   * Handle window resize events with performance awareness
   */
  handleResize() {
    if (this.animationController?.isAnimationRunning()) {
      // Clean up resources before rebuild
      this.coverFlowRenderer.cleanup();
      this.buildWall();
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    window.addEventListener('resize', this.handleResize);

    // Add performance debugging hotkeys
    document.addEventListener('keydown', (e) => {
      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();
        this.logPerformanceMetrics();
      }
      if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        this.cleanupResources();
      }
    });
  }

  /**
   * Clean up resources manually
   */
  cleanupResources() {
    console.log('🧹 Cleaning up resources...');
    this.coverFlowRenderer?.cleanup();
    this.animationController?.destroy?.();
    console.log('✅ Resources cleaned up');
  }

  /**
   * Clean up all resources
   */
  destroy() {
    performanceMonitor.stopMonitoring();
    this.animationController?.destroy?.();
    this.coverFlowRenderer?.cleanup();
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

  /**
   * Get current performance summary
   */
  getPerformanceSummary() {
    return {
      ...this.performanceMetrics,
      monitor: performanceMonitor.getSummary(),
      renderer: this.coverFlowRenderer?.getPerformanceMetrics(),
      uptime: performance.now() - this.performanceMetrics.startTime
    };
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new BookCoverFlowApp();
  app.initialize();

  // Make app globally available for debugging
  window.bookCoverFlowApp = app;

  // Add global performance utilities
  window.getPerformanceReport = () => app.getPerformanceSummary();
  window.cleanupResources = () => app.cleanupResources();
});
