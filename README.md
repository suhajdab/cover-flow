# Book Cover Flow

A beautiful, animated visualization of your Goodreads library that displays your books in an elegant cover flow interface. This project converts Goodreads RSS feeds to create a smooth book shelf revisiting experience.

## ✨ Features

- **Animated Cover Flow**: Smooth horizontal scrolling animation of book covers
- **Goodreads Integration**: Fetches books directly from your Goodreads shelves
- **Progress Tracking**: Visual progress bar and reading statistics
- **Desktop Screensaver Display**: Designed for full-screen, unattended playback
- **Fast Performance**: Optimized image loading and caching
- **Clean API**: RESTful endpoint that converts Goodreads RSS to clean JSON

## 🚀 Live Demo

Visit the deployed application: [Cover Flow](https://cover-flow-beta.vercel.app/)

## Intended Usage

Cover Flow is a desktop-only ambient display whose primary host is a macOS screensaver using a native WebKit frame or web view. The host loads the app as a top-level webpage and can provide only its launch URL. It is not intended for mobile, touch, responsive layouts, or HTML `<iframe>` embedding.

The launch URL is the complete runtime configuration. A screensaver URL should include:

- `userId`: Goodreads user ID; required to bypass the setup dialog
- `shelf`: Goodreads shelf; optional, defaults to `read`
- `key`: private Goodreads RSS feed key when the shelf requires it

```text
https://cover-flow-beta.vercel.app/?userId=123&shelf=read&key=YOUR_PRIVATE_KEY
```

The feed key remains in the URL by design because the screensaver cannot supply request bodies, custom headers, or persistent credentials. Treat the full launch URL and access logs containing query strings as sensitive; this exposure is an accepted constraint of the host integration. Frontend-to-API requests remain `GET` requests, and startup configuration must remain recoverable from URL query parameters unless the screensaver integration changes.

Each screensaver activation may start with a fresh WebKit context. The app must not depend on cookies, `localStorage`, `sessionStorage`, service workers, or a previous execution. It fetches current book data and cover images on every launch.

Runtime assumptions:

- A modern desktop WebKit runtime with JavaScript modules, `fetch`, `AbortController`, CSS transforms, and `requestAnimationFrame`
- HTTPS network access to the deployed app, its Vercel API, Goodreads, and configured cover-image hosts
- A full desktop viewport suitable for continuous, automatic animation after startup

Opening the site in a normal desktop browser is a secondary setup and preview workflow. Without `userId` in the URL, the RSS dialog accepts a Goodreads feed URL and redirects to a self-contained launch URL suitable for the screensaver.

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), CSS3, HTML5
- **Backend**: Node.js serverless function (Vercel)
- **Deployment**: Vercel
- **Dependencies**:
  - `fast-xml-parser` - XML to JSON conversion

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/suhajdab/cover-flow.git
   cd cover-flow
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run locally**

   ```bash
   npx vercel dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```

├── api/
│ └── goodreads.js # Vercel serverless function
├── public/
│ ├── index.html # Main HTML file
│ ├── styles.css # Global styles
│ └── js/ # Modern ES6 modules
│ ├── app.js # Main application controller
│ ├── animation-controller.js
│ ├── book-data-service.js
│ ├── config.js # Configuration constants
│ ├── cover-flow-renderer.js
│ ├── image-loader.js
│ ├── rss-dialog.js # RSS URL input dialog
│ └── ui-manager.js
├── package.json # Dependencies and scripts
├── vercel.json # Vercel deployment config
├── LICENSE # MIT License
└── README.md # This file

```

## 🧪 Running Tests

Run `npm test` to execute the Node.js tests.

## 🪝 Git Hooks

Enable the pre-commit hook to automatically run the tests before each commit:

```bash
git config core.hooksPath githooks
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Goodreads for providing RSS feeds
- The book cover images are provided by Amazon and publishers

## ⚠️ Important Notes

- This project relies on Goodreads RSS feeds, which may change or be discontinued
- Book cover images are loaded from external sources and may have varying load times
- The API fetches fresh data on each request to ensure up-to-date information

## 🐛 Known Issues

- Some book covers may not display if the image URL is broken
- Very large libraries (1000+ books) may take longer to load
- RSS feed limitations may not show all books from very large shelves

## 📧 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/suhajdab/cover-flow/issues) on GitHub.
