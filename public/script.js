// Global variables
let bookData = null;
let channel = null;
let books = [];

// Fetch book data from API
async function fetchBookData() {
  try {
    const response = await fetch('/api/goodreads?userId=18906657&shelf=read');
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed - the server rejected the request');
      } else if (response.status === 403) {
        throw new Error('Access forbidden - check API permissions');
      } else if (response.status >= 500) {
        throw new Error('Server error - please try again later');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch book data:', error);
    throw error;
  }
}

// Initialize the application
async function initializeApp() {
  try {
    progressBarInner.style.width = '0';
    progressText.textContent = 'Fetching book data...';

    bookData = await fetchBookData();
    books = Array.isArray(bookData.items) ? bookData.items : [];

    // Set channel title
    document.getElementById('channel-title').textContent = `${bookData.title}`;
    // Set book count
    const bookCount = bookData.total || books.length;
    document.getElementById('book-count').textContent = `Books: ${bookCount}`;

    // Sort books by read_at in descending order (most recent first)
    books.sort((a, b) => {
      const dateAString = a.read_at;
      const dateBString = b.read_at;

      // Handle cases where dates might be missing or invalid
      if (!dateAString && !dateBString) return 0;
      if (!dateAString) return 1;
      if (!dateBString) return -1;

      try {
        const dateA = new Date(dateAString);
        const dateB = new Date(dateBString);

        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;

        return dateB - dateA;
      } catch (e) {
        console.warn("Error parsing date for sorting:", a.title, dateAString, b.title, dateBString, e);
        if (!dateAString && !dateBString) return 0;
        if (!dateAString) return 1;
        if (!dateBString) return -1;
        return 0;
      }
    });

    // Start building the wall
    buildWall();
  } catch (error) {
    // More specific error messages
    let errorMessage = 'Failed to load book data.';
    if (error.message.includes('Authentication failed')) {
      errorMessage = 'API authentication failed. Server needs to be updated.';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Network error. Check your connection and try again.';
    }

    progressText.textContent = errorMessage + location.href;
    progressBarInner.style.width = '0%';
    console.error('Initialization failed:', error);

    // Show the card permanently on error so user can see the message
    document.getElementById('floating-card').classList.remove('hidden');
  }
}

// --- Sliding wall of book covers ---
const coverFlow = document.getElementById('cover-flow');
const progressBar = document.getElementById('progress-bar');
const progressBarInner = document.getElementById('progress-bar-inner');
const progressText = document.getElementById('progress-text');

// Create enhanced book items with year dividers
function createBookItemsWithYearDividers(books, images) {
  const items = [];
  let lastYear = null;

  books.forEach((book, idx) => {
    const img = images[idx];
    if (!img) return;

    // Get year from read_at
    let currentYear = null;
    if (book.read_at) {
      try {
        const date = new Date(book.read_at);
        if (!isNaN(date.getTime())) {
          currentYear = date.getFullYear();
        }
      } catch (e) {
        console.warn("Error parsing read_at for year divider:", book.title, book.read_at, e);
      }
    }

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

function preloadImages(books, onProgress, onComplete) {
  let loaded = 0;
  let failed = 0;
  const images = [];
  const total = books.length;
  if (total === 0) {
    onProgress(0, 0, 0);
    onComplete([]);
    return;
  }
  books.forEach((book, idx) => {
    const imgSrc = book.image_url || '';
    if (!imgSrc) {
      loaded++;
      onProgress(loaded, failed, total);
      images[idx] = null;
      if (loaded + failed === total) onComplete(images);
      return;
    }
    const img = new window.Image();
    img.src = imgSrc;
    img.onload = function () {
      loaded++;
      images[idx] = img;
      onProgress(loaded, failed, total);
      if (loaded + failed === total) onComplete(images);
    };
    img.onerror = function () {
      failed++;
      images[idx] = null;
      onProgress(loaded, failed, total);
      if (loaded + failed === total) onComplete(images);
    };
  });
}

function buildWallWithPreloaded(images) {
  coverFlow.innerHTML = '';
  const { width, height } = getViewportSize();
  const colWidth = 240;
  let numCols = Math.ceil(width / colWidth);

  // Create enhanced items with year dividers
  const items = createBookItemsWithYearDividers(books, images);

  // Prepare columns
  const columns = Array.from({ length: numCols }, () => {
    return {
      div: document.createElement('div'),
      height: 0 // actual pixel height of images + gaps
    };
  });
  columns.forEach(col => {
    col.div.className = 'cover-column';
  });

  // Fill columns with items (books and year dividers)
  let colIdx = 0;
  let repeats = 0;
  const maxRepeats = 10;
  let filled = false;
  let nextItemIdx = 0;

  while (!filled && repeats < maxRepeats) {
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

      if (item.type === 'year-divider') {
        // Create year tag element
        const yearTag = document.createElement('div');
        yearTag.className = 'year-tag';
        yearTag.textContent = item.year;
        columns[colIdx].div.appendChild(yearTag);
        columns[colIdx].height += 60 + 20; // height + margin
      } else if (item.type === 'book') {
        // Clone the image if it's a repeat
        const imgNode = repeats === 0 ? item.image : item.image.cloneNode(true);
        imgNode.className = 'book-cover';
        imgNode.alt = item.book.title || 'Book cover';
        imgNode.removeAttribute('style');
        imgNode.onload = null;
        imgNode.onerror = null;

        columns[colIdx].div.appendChild(imgNode);
        const scaledHeight = Math.min(item.image.naturalHeight * (240 / item.image.naturalWidth), 320);
        columns[colIdx].height += scaledHeight;
      }
    }
    if (!filled) {
      colIdx = 0;
      nextItemIdx = 0;
      repeats++;
    }
  }

  // Add columns to coverFlow
  columns.forEach(col => coverFlow.appendChild(col.div));

  // Start sliding animation after wall is built
  startCoverFlowAnimation(columns, colWidth, height, items, nextItemIdx);
}

// Animation state
let animationFrameId = null;
let coverFlowOffset = 0;
let lastTimestamp = null;
let currentColumns = [];

function startCoverFlowAnimation(columns, colWidth, height, items, initialNextItemIdx) {
  // Cancel previous animation if any
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
  coverFlowOffset = 0;
  lastTimestamp = null;
  currentColumns = columns;

  // Initialize the next item index from where initial wall building left off
  let nextItemIdx = initialNextItemIdx % items.length;

  function getWallWidth() {
    return currentColumns.length * colWidth;
  }

  function addColumnToRight() {
    let col = {
      div: document.createElement('div'),
      height: 0
    };
    col.div.className = 'cover-column';

    let filled = false;
    let repeats = 0;
    const maxRepeats = 10;
    let i = nextItemIdx;

    while (!filled && repeats < maxRepeats) {
      for (; i < items.length; ++i) {
        const item = items[i];

        if (item.type === 'year-divider') {
          const yearTag = document.createElement('div');
          yearTag.className = 'year-tag';
          yearTag.textContent = item.year;
          col.div.appendChild(yearTag);
          col.height += 60 + 20;
        } else if (item.type === 'book') {
          const imgNode = item.image.cloneNode(true);
          imgNode.className = 'book-cover';
          imgNode.alt = item.book.title || 'Book cover';
          imgNode.removeAttribute('style');
          imgNode.onload = null;
          imgNode.onerror = null;

          col.div.appendChild(imgNode);
          const scaledHeight = Math.min(item.image.naturalHeight * (240 / item.image.naturalWidth), 320);
          col.height += scaledHeight;
        }

        if (col.height >= height) {
          filled = true;
          i++; // move to next item for next column
          break;
        }
      }
      if (!filled) {
        i = 0;
        repeats++;
      }
    }
    // Save the next item index for the next column
    nextItemIdx = i % items.length;
    coverFlow.appendChild(col.div);
    currentColumns.push(col);
  }

  function removeColumnFromLeft() {
    // Remove leftmost column if it's fully out of the screen
    if (currentColumns.length === 0) return;
    const leftEdge = coverFlowOffset + colWidth;
    if (leftEdge <= 0) {
      // Remove first column DOM and from array
      if (coverFlow.firstChild) coverFlow.removeChild(coverFlow.firstChild);
      currentColumns.shift();
      coverFlowOffset += colWidth;
    }
  }

  function animateCoverFlow(ts) {
    if (!lastTimestamp) lastTimestamp = ts;
    const delta = ts - lastTimestamp;
    lastTimestamp = ts;

    // px per second, e.g. 20px/sec
    const speed = 20;
    coverFlowOffset -= (speed * delta) / 1000;

    // When the last column is fully visible, add a new column to the right
    const wallWidth = getWallWidth();
    const { width } = getViewportSize();
    if (wallWidth + coverFlowOffset < width + colWidth) {
      addColumnToRight();
    }

    // Remove columns on the left once fully out of the screen
    removeColumnFromLeft();

    coverFlow.style.transform = `translateX(${coverFlowOffset}px)`;

    animationFrameId = requestAnimationFrame(animateCoverFlow);
  }

  animationFrameId = requestAnimationFrame(animateCoverFlow);
}

// Stop animation on resize to avoid glitches, restart after wall is rebuilt
window.addEventListener('resize', () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  buildWall();
});

function buildWall() {
  if (!books || books.length === 0) {
    progressText.textContent = 'No books found.';
    return;
  }

  progressBarInner.style.width = '0';
  progressText.textContent = 'Loading covers...';

  preloadImages(books, (loaded, failed, total) => {
    const percent = total ? Math.round((loaded + failed) / total * 100) : 100;
    progressBarInner.style.width = percent + '%';
    progressText.textContent = `Loading covers: ${loaded + failed} / ${total}`;
  }, (images) => {
    buildWallWithPreloaded(images);
    setTimeout(() => {
      setTimeout(() => {
        document.getElementById('floating-card').classList.add('hidden');
      }, 3000);
    }, 500);
  });
}

window.addEventListener('resize', buildWall);

// Get viewport width and height (define this function that was missing)
function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

// Start the application
initializeApp();
