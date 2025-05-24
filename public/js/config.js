// Configuration constants
export const CONFIG = {
  // Layout constants
  COLUMN_WIDTH: 240,
  MAX_IMAGE_HEIGHT: 320,
  YEAR_TAG_HEIGHT: 60,
  YEAR_TAG_MARGIN: 20,

  // Animation constants
  ANIMATION_SPEED: 20, // pixels per second
  MAX_REPEATS: 10,

  // UI constants
  CARD_HIDE_DELAY: 3000,
  CARD_HIDE_TRANSITION: 500,

  // API constants
  API_ENDPOINT: '/api/goodreads?userId=18906657&shelf=read'
};

export const SELECTORS = {
  COVER_FLOW: '#cover-flow',
  FLOATING_CARD: '#floating-card',
  CHANNEL_TITLE: '#channel-title',
  BOOK_COUNT: '#book-count',
  PROGRESS_BAR: '#progress-bar',
  PROGRESS_BAR_INNER: '#progress-bar-inner',
  PROGRESS_TEXT: '#progress-text'
};

export const CSS_CLASSES = {
  COVER_COLUMN: 'cover-column',
  BOOK_COVER: 'book-cover',
  YEAR_TAG: 'year-tag',
  HIDDEN: 'hidden'
};
