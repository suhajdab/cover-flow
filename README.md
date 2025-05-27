# Book Cover Flow

A beautiful, animated visualization of your Goodreads library that displays your books in an elegant cover flow interface. This project converts Goodreads RSS feeds to create a smooth, responsive book browsing experience.

## ✨ Features

- **Animated Cover Flow**: Smooth horizontal scrolling animation of book covers
- **Goodreads Integration**: Fetches books directly from your Goodreads shelves
- **Progress Tracking**: Visual progress bar and reading statistics
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Fast Performance**: Optimized image loading and caching
- **Clean API**: RESTful endpoint that converts Goodreads RSS to clean JSON

## 🚀 Live Demo

Visit the deployed application: [Your Vercel URL here]

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), CSS3, HTML5
- **Backend**: Node.js serverless function (Vercel)
- **Deployment**: Vercel
- **Dependencies**:
  - `fast-xml-parser` - XML to JSON conversion
  - `node-fetch` - HTTP requests

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

## 🔧 Configuration

### Default Settings

The app comes with sensible defaults, but you can customize it by modifying URL parameters:

- `userId` - Your Goodreads user ID (required)
- `shelf` - Shelf name (default: "read")
- `maxPages` - Maximum pages to fetch (default: 20)

### Finding Your Goodreads User ID

1. Go to your Goodreads profile
2. Look at the URL: `https://www.goodreads.com/user/show/[USER_ID]`
3. The number is your user ID

### Usage Examples

```
# View a specific user's read books
https://yourapp.vercel.app/?userId=18906657&shelf=read

# View to-read shelf
https://yourapp.vercel.app/?userId=18906657&shelf=to-read

# Limit to 10 pages
https://yourapp.vercel.app/?userId=18906657&maxPages=10
```

## 🌐 API Endpoints

### GET `/api/goodreads`

Converts Goodreads RSS feeds and returns clean JSON data.

**Query Parameters:**

- `userId` (required) - Goodreads numerical user ID
- `shelf` (optional) - Shelf name, default: "read"
- `maxPages` (optional) - Maximum pages to fetch, default: 20
- `fields` (optional) - Comma-separated list of fields to include

**Example Request:**

```
GET /api/goodreads?userId=18906657&shelf=read&fields=title,author_name,image_url
```

**Example Response:**

```json
{
  "total": 150,
  "shelf": "read",
  "userId": "18906657",
  "title": "User's read shelf",
  "items": [
    {
      "book_id": 12345,
      "title": "The Great Gatsby",
      "author_name": "F. Scott Fitzgerald",
      "image_url": "https://...",
      "read_at": "2024-01-15",
      "date_added": "2024-01-10"
    }
  ]
}
```

## 🎨 Customization

### Modifying Animation Settings

Edit `public/js/config.js` to customize:

```javascript
export const CONFIG = {
  COLUMN_WIDTH: 200, // Width of each book column
  MAX_IMAGE_HEIGHT: 320, // Maximum height for book covers
  ANIMATION_SPEED: 30, // Pixels per second
  MAX_REPEATS: 10, // Maximum animation cycles
  CARD_HIDE_DELAY: 3000, // MS before hiding info card
};
```

### Styling

Modify `public/styles.css` to customize the appearance:

- Cover flow layout and spacing
- Color scheme and typography
- Responsive breakpoints
- Animation transitions

## 📁 Project Structure

```
├── api/
│   └── goodreads.js          # Vercel serverless function
├── public/
│   ├── index.html            # Main HTML file
│   ├── styles.css            # Global styles
│   ├── script.js             # Legacy script (deprecated)
│   └── js/                   # Modern ES6 modules
│       ├── app.js            # Main application controller
│       ├── animation-controller.js
│       ├── book-data-service.js
│       ├── config.js         # Configuration constants
│       ├── cover-flow-renderer.js
│       ├── image-loader.js
│       └── ui-manager.js
├── package.json              # Dependencies and scripts
├── vercel.json              # Vercel deployment config
└── README.md                # This file
```

## 🚀 Deployment

### Deploy to Vercel

1. **Install Vercel CLI**

   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

### Deploy to Other Platforms

The project can be deployed to any platform that supports Node.js serverless functions:

- Netlify Functions
- AWS Lambda
- Cloudflare Workers

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
- Inspired by Apple's Cover Flow interface

## ⚠️ Important Notes

- This project relies on Goodreads RSS feeds, which may change or be discontinued
- Book cover images are loaded from external sources and may have varying load times
- The API includes a 24-hour cache to improve performance and reduce API calls

## 🐛 Known Issues

- Some book covers may not display if the image URL is broken
- Very large libraries (1000+ books) may take longer to load
- RSS feed limitations may not show all books from very large shelves

## 📧 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/cover-flow/issues) on GitHub.
