/**
 * Setup for a public Goodreads shelf
 */
export class GoodreadsDialog {
  constructor() {
    this.dialog = null;
    this.input = null;
    this.form = null;
    this.submitButton = null;
    this.errorElement = null;
    this.initialized = false;
  }

  /**
   * Initialize the dialog elements
   */
  initialize() {
    if (this.initialized) return;

    this.dialog = document.getElementById("goodreads-dialog");
    this.form = document.getElementById("goodreads-form");
    this.input = document.getElementById("goodreads-url-input");
    this.submitButton = document.getElementById("submit-goodreads-url");
    this.errorElement = document.getElementById("goodreads-error");

    if (!this.dialog || !this.form || !this.input || !this.submitButton || !this.errorElement) {
      throw new Error("Goodreads dialog elements not found in DOM");
    }

    this.setupEventListeners();
    this.initialized = true;
  }

  /**
   * Set up event listeners for the dialog
   */
  setupEventListeners() {
    this.form.addEventListener("submit", event => {
      event.preventDefault();
      this.handleSubmit();
    });

    // Input validation on type
    this.input.addEventListener("input", () => {
      this.clearError();
      this.validateInput();
    });

    // Close dialog on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isVisible()) {
        this.hide();
      }
    });

    // Close dialog on backdrop click
    this.dialog.addEventListener("click", (e) => {
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
    this.dialog.classList.remove("hidden");
    this.validateInput();
    this.input.focus();
  }

  /**
   * Hide the dialog
   */
  hide() {
    this.dialog.classList.add("hidden");
    this.clearError();
    this.input.value = "";
    this.validateInput();
  }

  /**
   * Check if dialog is visible
   */
  isVisible() {
    return !this.dialog.classList.contains("hidden");
  }

  /**
   * Handle form submission
   */
  handleSubmit() {
    const url = this.input.value.trim();

    if (!url) {
      this.showError("Enter a Goodreads profile or shelf URL");
      return;
    }

    try {
      const { userId, shelf } = this.parseGoodreadsUrl(url);
      this.redirectToShelf(userId, shelf);
    } catch (error) {
      this.showError(error.message);
    }
  }

  parseGoodreadsUrl(value) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error("Enter a valid Goodreads profile or shelf URL");
    }

    const validHost = url.hostname === "goodreads.com" || url.hostname === "www.goodreads.com";
    if (url.protocol !== "https:" || !validHost || url.port || url.username || url.password) {
      throw new Error("Use an HTTPS link from goodreads.com");
    }

    const match = url.pathname.match(/^\/(user\/show|review\/list(?:_rss)?)\/(\d{1,15})(?:-[^/]+)?\/?$/);
    if (!match) {
      throw new Error("Open your Goodreads profile or shelf and copy its link");
    }

    const [, path, userId] = match;
    const shelf = path === "user/show"
      ? "read"
      : url.searchParams.get("shelf") || url.searchParams.get("tag") || "read";
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(shelf)) {
      throw new Error("Invalid shelf name format");
    }

    return { userId, shelf };
  }

  redirectToShelf(userId, shelf) {
    const url = new URL(window.location.href);
    url.searchParams.delete("key");
    url.searchParams.set("userId", userId);
    url.searchParams.set("shelf", shelf);
    window.location.href = url.toString();
  }

  /**
   * Show error message (XSS-safe)
   * @param {string} message - Error message to display
   */
  showError(message) {
    // Use textContent instead of innerHTML to prevent XSS
    this.errorElement.textContent = this.sanitizeText(message);
    this.errorElement.classList.remove("hidden");
  }

  /**
   * Sanitize text content to prevent XSS
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (typeof text !== "string") return "";
    // Remove any HTML tags and limit length
    return text.replace(/<[^>]*>/g, "").substring(0, 500);
  }

  /**
   * Clear error message
   */
  clearError() {
    this.errorElement.classList.add("hidden");
    this.errorElement.textContent = "";
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
