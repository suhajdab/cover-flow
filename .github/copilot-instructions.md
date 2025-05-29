# Cover Flow Project - Custom Instructions for GitHub Copilot

This is a Goodreads book cover flow visualization project built with vanilla JavaScript and deployed on Vercel.

## Development Environment & Tools

Use `vercel dev` for local testing and development instead of `npm run dev`, as this project is designed for Vercel's serverless environment.

The project uses Vercel's serverless functions for the backend API (`api/goodreads.js`) and static file serving for the frontend.

## Code Style & Architecture

This project uses vanilla JavaScript with ES6 modules - no build tools or frameworks like React, Vue, or bundlers are used.

Use double quotes for JavaScript strings and maintain the existing modular architecture with separate files for different concerns:

- `ui-manager.js` - UI state management and DOM manipulation
- `book-data-service.js` - API calls and data fetching
- `cover-flow-renderer.js` - Animation and rendering logic
- `image-loader.js` - Image loading and caching
- `animation-controller.js` - Animation controls

## API & Data Handling

The backend API converts Goodreads RSS feeds to clean JSON format. When working with book data, ensure proper handling of:

- XML parsing from Goodreads RSS feeds
- Image URL extraction and validation
- Error handling for failed API requests
- Progress tracking during data loading

## Deployment & Configuration

This project is deployed on Vercel with specific configuration in `vercel.json` including:

- Serverless function configuration for API routes
- Security headers
- Static file serving rules

Always consider Vercel's deployment constraints and serverless function limitations when making changes.
