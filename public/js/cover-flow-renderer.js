import { CONFIG, CSS_CLASSES } from './config.js';

/**
 * Handles rendering of the cover flow display
 */
export class CoverFlowRenderer {
  constructor(coverFlowElement) {
    this.coverFlow = coverFlowElement;
  }

  /**
   * Create enhanced book items with year dividers
   * @param {Array} books - Array of book objects
   * @param {Array} images - Array of loaded image elements
   * @returns {Array} Array of items (books and year dividers)
   */
  createBookItemsWithYearDividers(books, images) {
    const items = [];
    let lastYear = null;

    books.forEach((book, idx) => {
      const img = images[idx];
      if (!img) return;

      const currentYear = this.extractYearFromBook(book);

      // Add year divider if year changed
      if (currentYear && currentYear !== lastYear) {
        items.push({
          type: 'year-divider',
          year: currentYear
        });
        lastYear = currentYear;
      }

      // Add book item
      items.push({
        type: 'book',
        book: book,
        image: img,
        index: idx
      });
    });

    return items;
  }

  /**
   * Extract year from book's read_at date
   * @param {Object} book - Book object
   * @returns {number|null} Year or null if not available
   */
  extractYearFromBook(book) {
    if (!book.read_at) return null;

    try {
      const date = new Date(book.read_at);
      return !isNaN(date.getTime()) ? date.getFullYear() : null;
    } catch (e) {
      console.warn("Error parsing read_at for year divider:", book.title, book.read_at, e);
      return null;
    }
  }

  /**
   * Create columns for the cover flow
   * @param {number} numCols - Number of columns to create
   * @returns {Array} Array of column objects
   */
  createColumns(numCols) {
    const columns = Array.from({ length: numCols }, () => ({
      div: document.createElement('div'),
      height: 0
    }));

    columns.forEach(col => {
      col.div.className = CSS_CLASSES.COVER_COLUMN;
    });

    return columns;
  }

  /**
   * Create a year tag element
   * @param {number} year - Year to display
   * @returns {HTMLElement} Year tag element
   */
  createYearTag(year) {
    const yearTag = document.createElement('div');
    yearTag.className = CSS_CLASSES.YEAR_TAG;
    yearTag.textContent = year;
    return yearTag;
  }

  /**
   * Create a book cover image element
   * @param {Object} item - Book item object
   * @param {number} repeats - Number of repeats (for cloning)
   * @returns {HTMLElement} Image element
   */
  createBookCover(item, repeats = 0) {
    const imgNode = repeats === 0 ? item.image : item.image.cloneNode(true);
    imgNode.className = CSS_CLASSES.BOOK_COVER;
    imgNode.alt = item.book.title || 'Book cover';
    imgNode.removeAttribute('style');
    imgNode.onload = null;
    imgNode.onerror = null;
    return imgNode;
  }

  /**
   * Calculate scaled height for an image
   * @param {HTMLImageElement} image - Image element
   * @returns {number} Scaled height in pixels
   */
  calculateScaledHeight(image) {
    return Math.min(
      image.naturalHeight * (CONFIG.COLUMN_WIDTH / image.naturalWidth),
      CONFIG.MAX_IMAGE_HEIGHT
    );
  }

  /**
   * Add item to column
   * @param {Object} column - Column object
   * @param {Object} item - Item to add
   * @param {number} repeats - Number of repeats
   */
  addItemToColumn(column, item, repeats = 0) {
    if (item.type === 'year-divider') {
      const yearTag = this.createYearTag(item.year);
      column.div.appendChild(yearTag);
      column.height += CONFIG.YEAR_TAG_HEIGHT + CONFIG.YEAR_TAG_MARGIN;
    } else if (item.type === 'book') {
      const imgNode = this.createBookCover(item, repeats);
      column.div.appendChild(imgNode);
      column.height += this.calculateScaledHeight(item.image);
    }
  }

  /**
   * Fill columns with items
   * @param {Array} columns - Array of column objects
   * @param {Array} items - Array of items to add
   * @param {number} height - Target height for columns
   * @returns {number} Next item index for continuation
   */
  fillColumns(columns, items, height) {
    let colIdx = 0;
    let repeats = 0;
    let filled = false;
    let nextItemIdx = 0;

    while (!filled && repeats < CONFIG.MAX_REPEATS) {
      for (let i = nextItemIdx; i < items.length; ++i) {
        const item = items[i];

        // If current column is full, move to next column
        while (colIdx < columns.length && columns[colIdx].height >= height) {
          colIdx++;
        }

        if (colIdx >= columns.length) {
          filled = true;
          nextItemIdx = i;
          break;
        }

        this.addItemToColumn(columns[colIdx], item, repeats);
      }

      if (!filled) {
        colIdx = 0;
        nextItemIdx = 0;
        repeats++;
      }
    }

    return nextItemIdx;
  }

  /**
   * Render the wall with preloaded images
   * @param {Array} books - Array of book objects
   * @param {Array} images - Array of loaded images
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   * @returns {Object} Render result with columns and items
   */
  renderWall(books, images, width, height) {
    this.coverFlow.innerHTML = '';

    const numCols = Math.ceil(width / CONFIG.COLUMN_WIDTH);
    const items = this.createBookItemsWithYearDividers(books, images);
    const columns = this.createColumns(numCols);

    const nextItemIdx = this.fillColumns(columns, items, height);

    // Add columns to DOM
    columns.forEach(col => this.coverFlow.appendChild(col.div));

    return {
      columns,
      items,
      nextItemIdx,
      colWidth: CONFIG.COLUMN_WIDTH
    };
  }
}
