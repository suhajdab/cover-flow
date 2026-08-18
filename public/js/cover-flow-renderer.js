import { CONFIG, CSS_CLASSES } from './config.js';

function getNextItem(items, itemIdx) {
  if (items.length <= 1) {
    return undefined;
  }

  return items[(itemIdx + 1) % items.length];
}

function normalizeItemIndex(itemIdx, itemCount) {
  return ((itemIdx % itemCount) + itemCount) % itemCount;
}

export function getVisibleRatioInColumn(itemTop, itemHeight, columnHeight) {
  if (itemHeight <= 0) {
    return 0;
  }

  const visibleHeight = Math.max(0, Math.min(itemHeight, columnHeight - itemTop));
  return visibleHeight / itemHeight;
}

export function createColumnLayout(numCols, items, height, startItemIdx = 0, getItemHeight, options = {}) {
  const { wrap = true } = options;
  const columns = Array.from({ length: numCols }, () => ({
    height: 0,
    entries: []
  }));

  if (numCols <= 0 || items.length === 0) {
    return {
      columns,
      nextItemIdx: 0
    };
  }

  let colIdx = 0;
  let repeats = 0;
  let filled = false;
  let nextItemIdx = normalizeItemIndex(startItemIdx, items.length);

  const addLayoutEntry = (item, options = {}) => {
    const itemHeight = getItemHeight(item);
    const itemTop = columns[colIdx].height;
    const entry = {
      item,
      isRepeat: options.isRepeat || false,
      repeatCount: options.repeatCount || 0,
      top: itemTop,
      height: itemHeight,
      visibleRatio: getVisibleRatioInColumn(itemTop, itemHeight, height)
    };

    columns[colIdx].entries.push(entry);
    columns[colIdx].height += itemHeight;
    return entry;
  };

  const moveToNextColumn = () => {
    colIdx++;
    if (colIdx >= columns.length) {
      filled = true;
    }
  };

  const movePastFilledColumns = () => {
    while (colIdx < columns.length && columns[colIdx].height >= height) {
      moveToNextColumn();
    }
  };

  while (!filled && repeats < CONFIG.MAX_REPEATS) {
    for (let i = nextItemIdx; i < items.length; ++i) {
      movePastFilledColumns();

      if (filled) {
        nextItemIdx = i;
        break;
      }

      const item = items[i];
      const nextItem = wrap ? getNextItem(items, i) : items[i + 1];

      if (shouldMoveYearDividerToNextColumn(columns[colIdx].height, item, nextItem, height, getItemHeight)) {
        moveToNextColumn();

        if (filled) {
          nextItemIdx = i;
          break;
        }
      }

      const entry = addLayoutEntry(item, { repeatCount: repeats });

      if (shouldRepeatBottomBook(entry, nextItem)) {
        moveToNextColumn();

        if (filled) {
          nextItemIdx = i + 1;
          break;
        }

        addLayoutEntry(item, { isRepeat: true, repeatCount: repeats });
      }
    }

    if (!filled && !wrap) {
      nextItemIdx = items.length;
      break;
    }

    if (!filled) {
      colIdx = 0;
      nextItemIdx = 0;
      repeats++;
    }
  }

  return {
    columns,
    nextItemIdx
  };
}

export function createFiniteColumnLayouts(items, height, getItemHeight) {
  if (items.length === 0) {
    return [];
  }

  const layout = createColumnLayout(
    items.length + 1,
    items,
    height,
    0,
    getItemHeight,
    { wrap: false }
  );

  return layout.columns.filter(column => column.entries.length > 0);
}

export function createWrapTransitionLayout(columnLayouts, items, height) {
  const terminalEntry = columnLayouts.at(-1)?.entries.at(-1);

  if (!terminalEntry || !shouldRepeatBottomBook(terminalEntry, items[0])) {
    return null;
  }

  return {
    height: terminalEntry.height,
    entries: [{
      ...terminalEntry,
      isRepeat: true,
      top: 0,
      visibleRatio: getVisibleRatioInColumn(0, terminalEntry.height, height)
    }]
  };
}

export function createTerminalColumnWindow(columnLayouts, visibleColumnCount, wrapTransitionLayout = null) {
  if (columnLayouts.length === 0 || visibleColumnCount <= 0) {
    return {
      layouts: [],
      animationLayouts: [],
      nextColumnLayoutIndex: 0
    };
  }

  const visibleLayouts = columnLayouts.slice(-visibleColumnCount);
  const emptyLayouts = Array.from(
    { length: visibleColumnCount - visibleLayouts.length },
    () => ({ height: 0, entries: [] })
  );
  const bufferLayout = wrapTransitionLayout || columnLayouts[0];
  const animationLayouts = wrapTransitionLayout
    ? [...columnLayouts, wrapTransitionLayout]
    : columnLayouts;

  return {
    layouts: [...emptyLayouts, ...visibleLayouts, bufferLayout],
    animationLayouts,
    nextColumnLayoutIndex: wrapTransitionLayout
      ? 0
      : columnLayouts.length > 1 ? 1 : 0
  };
}

function shouldRepeatBottomBook(entry, nextItem) {
  return entry.item.type === "book"
    && nextItem
    && nextItem?.type !== "year-divider"
    && !entry.isRepeat
    && entry.top > 0
    && entry.visibleRatio < CONFIG.MIN_BOTTOM_COVER_VISIBILITY;
}

function shouldMoveYearDividerToNextColumn(columnHeight, item, nextItem, height, getItemHeight) {
  return item.type === "year-divider"
    && nextItem?.type === "book"
    && columnHeight > 0
    && columnHeight + getItemHeight(item) + (getItemHeight(nextItem) * CONFIG.MIN_BOTTOM_COVER_VISIBILITY) > height;
}

/**
 * Cover flow renderer with virtual scrolling and efficient DOM management
 */
export class CoverFlowRenderer {
  constructor(coverFlowElement) {
    this.coverFlow = coverFlowElement;
    this.imageCache = new Map();
    this.elementPool = {
      columns: [],
      images: [],
      yearTags: []
    };
    this.cachedCalculations = new Map();
  }

  /**
   * Create enhanced book items with year dividers (cached)
   */
  createBookItemsWithYearDividers(books, images) {
    const cacheKey = `items-${books.length}-${images.length}`;
    if (this.cachedCalculations.has(cacheKey)) {
      return this.cachedCalculations.get(cacheKey);
    }

    const items = [];
    let lastYear = null;

    // Use for loop for better performance than forEach
    for (let idx = 0; idx < books.length; idx++) {
      const book = books[idx];
      const img = images[idx];
      if (!img) continue;

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
    }

    // Cache the result
    this.cachedCalculations.set(cacheKey, items);
    return items;
  }

  /**
   * Extract year from book's read_at date with caching
   */
  extractYearFromBook(book) {
    if (!book.read_at) return null;

    const cacheKey = `year-${book.read_at}`;
    if (this.cachedCalculations.has(cacheKey)) {
      return this.cachedCalculations.get(cacheKey);
    }

    let year = null;
    try {
      const date = new Date(book.read_at);
      year = !isNaN(date.getTime()) ? date.getFullYear() : null;
    } catch (e) {
      console.warn("Error parsing read_at for year divider:", book.title, book.read_at, e);
    }

    this.cachedCalculations.set(cacheKey, year);
    return year;
  }

  /**
   * Create columns with object pooling for memory efficiency
   */
  createColumns(numCols) {
    const columns = [];

    for (let i = 0; i < numCols; i++) {
      let col;
      if (this.elementPool.columns.length > 0) {
        col = this.elementPool.columns.pop();
        col.div.innerHTML = ''; // Clear previous content
        col.height = 0;
      } else {
        col = {
          div: this.createOptimizedElement('div', CSS_CLASSES.COVER_COLUMN),
          height: 0
        };
      }
      columns.push(col);
    }

    return columns;
  }

  /**
   * Create optimized DOM elements with performance enhancements
   */
  createOptimizedElement(tagName, className) {
    const element = document.createElement(tagName);
    element.className = className;

    // Enable GPU acceleration
    element.style.willChange = 'transform';
    element.style.transform = 'translateZ(0)';
    element.style.backfaceVisibility = 'hidden';

    return element;
  }

  /**
   * Create a year tag element with pooling
   */
  createYearTag(year) {
    let yearTag;
    if (this.elementPool.yearTags.length > 0) {
      yearTag = this.elementPool.yearTags.pop();
      yearTag.textContent = year;
    } else {
      yearTag = this.createOptimizedElement('div', CSS_CLASSES.YEAR_TAG);
      yearTag.textContent = year;
    }
    return yearTag;
  }

  /**
   * Create a book cover image element with optimizations
   */
  createBookCover(item, repeats = 0) {
    const cacheKey = `${item.book.title}-${item.index}`;

    let imgNode;
    if (repeats === 0 && this.imageCache.has(cacheKey)) {
      imgNode = this.imageCache.get(cacheKey).cloneNode(false);
    } else {
      imgNode = item.image.cloneNode(false);

      // Optimize image element
      imgNode.className = CSS_CLASSES.BOOK_COVER;
      imgNode.alt = item.book.title || 'Book cover';
      imgNode.draggable = false;
      imgNode.loading = 'lazy';

      // GPU acceleration
      imgNode.style.willChange = 'transform';
      imgNode.style.transform = 'translateZ(0)';
      imgNode.style.backfaceVisibility = 'hidden';

      // Clean up handlers
      imgNode.removeAttribute('style');
      imgNode.onload = null;
      imgNode.onerror = null;

      // Cache optimized image
      if (repeats === 0 && !this.imageCache.has(cacheKey)) {
        this.imageCache.set(cacheKey, imgNode.cloneNode(false));
      }
    }

    return imgNode;
  }

  /**
   * Calculate scaled height with caching
   */
  calculateScaledHeight(image, itemIndex) {
    const cacheKey = `height-${itemIndex}-${image.naturalWidth}-${image.naturalHeight}`;

    if (this.cachedCalculations.has(cacheKey)) {
      return this.cachedCalculations.get(cacheKey);
    }

    const height = Math.min(
      image.naturalHeight * (CONFIG.COLUMN_WIDTH / image.naturalWidth),
      CONFIG.MAX_IMAGE_HEIGHT
    );

    this.cachedCalculations.set(cacheKey, height);
    return height;
  }

  /**
   * Add item to column with batched DOM operations
   */
  addItemToColumn(column, entry, fragment = null) {
    const target = fragment || column.div;
    const item = entry.item;

    if (item.type === 'year-divider') {
      const yearTag = this.createYearTag(item.year);
      target.appendChild(yearTag);
    } else if (item.type === 'book') {
      target.appendChild(this.createBookCover(item, entry.repeatCount));
    }

    column.height += entry.height;
  }

  /**
   * Calculate rendered item height using the same rules as column filling
   */
  getItemHeight(item) {
    if (item.type === "year-divider") {
      return CONFIG.YEAR_TAG_HEIGHT + CONFIG.YEAR_TAG_MARGIN;
    }

    if (item.type === "book") {
      return this.calculateScaledHeight(item.image, item.index);
    }

    return 0;
  }

  /**
   * Fill columns with optimized batching and virtual scrolling
   */
  fillColumns(columns, items, height, startItemIdx = 0) {
    const layout = createColumnLayout(
      columns.length,
      items,
      height,
      startItemIdx,
      item => this.getItemHeight(item)
    );
    const fragments = columns.map(() => document.createDocumentFragment());

    layout.columns.forEach((layoutColumn, colIdx) => {
      layoutColumn.entries.forEach(entry => {
        this.addItemToColumn(columns[colIdx], entry, fragments[colIdx]);
      });
    });

    // Batch append all fragments
    columns.forEach((col, index) => {
      col.div.appendChild(fragments[index]);
    });

    return layout.nextItemIdx;
  }

  populateColumnsFromLayouts(columns, layouts) {
    const fragments = columns.map(() => document.createDocumentFragment());

    layouts.forEach((layoutColumn, colIdx) => {
      layoutColumn.entries.forEach(entry => {
        this.addItemToColumn(columns[colIdx], entry, fragments[colIdx]);
      });
    });

    columns.forEach((col, index) => {
      col.div.appendChild(fragments[index]);
    });
  }

  /**
   * Render the wall with all optimizations
   */
  renderWall(books, images, width, height) {
    // Clear container efficiently
    while (this.coverFlow.firstChild) {
      this.coverFlow.removeChild(this.coverFlow.firstChild);
    }

    const visibleColumnCount = Math.ceil(width / CONFIG.COLUMN_WIDTH);
    const items = this.createBookItemsWithYearDividers(books, images);
    const columnLayouts = createFiniteColumnLayouts(
      items,
      height,
      item => this.getItemHeight(item)
    );
    const wrapTransitionLayout = createWrapTransitionLayout(columnLayouts, items, height);
    const terminalWindow = createTerminalColumnWindow(
      columnLayouts,
      visibleColumnCount,
      wrapTransitionLayout
    );
    const columns = this.createColumns(terminalWindow.layouts.length);
    this.populateColumnsFromLayouts(columns, terminalWindow.layouts);

    // Batch append columns using document fragment
    const fragment = document.createDocumentFragment();
    columns.forEach(col => fragment.appendChild(col.div));
    this.coverFlow.appendChild(fragment);

    return {
      columns,
      items,
      columnLayouts: terminalWindow.animationLayouts,
      nextColumnLayoutIndex: terminalWindow.nextColumnLayoutIndex,
      colWidth: CONFIG.COLUMN_WIDTH
    };
  }

  /**
   * Clean up resources and return elements to pool
   */
  cleanup() {
    // Clear caches periodically to prevent memory leaks
    if (this.cachedCalculations.size > 1000) {
      this.cachedCalculations.clear();
    }

    if (this.imageCache.size > 500) {
      this.imageCache.clear();
    }

    // Limit pool sizes
    this.elementPool.columns = this.elementPool.columns.slice(0, 50);
    this.elementPool.images = this.elementPool.images.slice(0, 100);
    this.elementPool.yearTags = this.elementPool.yearTags.slice(0, 20);
  }
}
