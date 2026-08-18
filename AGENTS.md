# Cover Flow Agent Instructions

This repository is a Goodreads book cover flow visualization built with vanilla JavaScript and deployed on Vercel.

## Development Environment and Tools

- Use `npx vercel dev` for local testing and development instead of `npm run dev`; the project is designed for Vercel's serverless environment and should work locally without network access.
- The backend uses Vercel serverless functions in `api/goodreads.js`, while the frontend is served as static files from `public`.

## Code Style and Architecture

- Use double quotes for JavaScript strings.
- Do not introduce frameworks or bundlers; keep the existing vanilla JavaScript architecture and ES modules in `public/js`.
- Preserve the current separation of concerns:
	- `ui-manager.js`: UI state management and DOM manipulation.
	- `book-data-service.js`: API calls and data fetching.
	- `cover-flow-renderer.js`: Animation and rendering logic.
	- `image-loader.js`: Image loading and caching.
	- `animation-controller.js`: Animation controls.

## API and Data Handling

The backend API converts Goodreads RSS feeds into clean JSON. When changing book data handling, preserve:

- XML parsing from Goodreads RSS feeds.
- Image URL extraction and validation.
- Error handling for failed API requests.
- Progress tracking during data loading.
- Input validation in `api/goodreads.js`.

## Deployment and Configuration

- Account for Vercel deployment constraints and serverless function limitations.
- Preserve the `vercel.json` configuration for serverless API routes, security headers, and static file serving.
- Maintain security headers in `api/goodreads.js` and `vercel.json`.

## Workflow

- Keep commit messages concise.
- Run the relevant tests after changes.
