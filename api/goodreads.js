/*  api/goodreads.js
    A Vercel Node.js (λ) that converts a Goodreads shelf RSS into clean JSON.

    Query parameters:
      userId   – Goodreads numerical user id     (required)
      shelf    – Shelf name, e.g. "to-read"      (optional, default "read")
      key      – Goodreads RSS key               (optional, omitted if not provided)

    Example:
      /api/goodreads?userId=137464693&shelf=read&key=YOUR_RSS_KEY
*/

import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser();

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    let title = '';
    const {
      userId,
      shelf = 'read',
      key,                         // Goodreads RSS key (optional)
    } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'Missing required parameter "userId"' });
      return;
    }

    // Validate userId is numeric to prevent SSRF attacks
    if (!/^\d+$/.test(userId)) {
      res.status(400).json({ error: 'Invalid userId format. Must be numeric.' });
      return;
    }

    // Validate shelf parameter to prevent injection
    if (shelf && !/^[a-zA-Z0-9_-]+$/.test(shelf)) {
      res.status(400).json({ error: 'Invalid shelf format. Only alphanumeric characters, hyphens, and underscores allowed.' });
      return;
    }

    // Build base URL with parameters
    const params = new URLSearchParams({
      shelf: shelf,
      sort: 'date_read'
    });

    if (key) {
      params.set('key', key);
    }

    const base = `https://www.goodreads.com/review/list_rss/${userId}?${params.toString()}`;

    const allItems = [];
    for (let page = 1; page <= 20; page += 1) {
      const url = `${base}&page=${page}`;

      // Add timeout protection (10 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const xml = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Cover-Flow-App/1.0'
          }
        }).then(
          r => {
            clearTimeout(timeoutId);
            if (!r.ok) throw new Error(`Goodreads returned ${r.status} for ${url}`);
            return r.text();
          },
        );

        const feed = parser.parse(xml, { ignoreAttributes: false, attributeNamePrefix: '' });
        const items = feed?.rss?.channel?.item ?? [];
        title = feed?.rss?.channel?.title ?? '';

        // map → thin JSON
        items.forEach(raw => {
          const obj = {
            book_id: +raw.book_id,
            title: raw.title,
            author_name: raw['author_name'],
            image_url: raw.book_large_image_url || '',
            read_at: raw.user_read_at,
            date_added: raw.user_date_added || raw.date_added,
          };
          allItems.push(obj);
        });

        if (items.length < 100) break; // last page reached
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - Goodreads is taking too long to respond');
        }
        throw error;
      }
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // 24 hour CDN
    return res.status(200).json({ total: allItems.length, shelf, userId, items: allItems, title });
  } catch (err) {
    // Log the full error for debugging but don't expose details to client
    console.error('API Error:', err);

    // Return generic error message to prevent information disclosure
    const statusCode = err.message.includes('Goodreads returned') ? 502 : 500;
    const errorMessage = statusCode === 502
      ? 'Unable to fetch data from Goodreads. Please try again later.'
      : 'An internal server error occurred. Please try again later.';

    return res.status(statusCode).json({ error: errorMessage });
  }
}