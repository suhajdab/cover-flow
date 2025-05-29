/**
 * Converts Goodreads shelf RSS into clean JSON
 * Query params: userId (required), shelf (optional), key (optional)
 */
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    const { userId, shelf = 'read', key } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing required parameter "userId"' });
    }

    // Validate inputs to prevent SSRF attacks
    if (!/^\d+$/.test(userId)) {
      return res.status(400).json({ error: 'Invalid userId format. Must be numeric.' });
    }

    if (shelf && !/^[a-zA-Z0-9_-]+$/.test(shelf)) {
      return res.status(400).json({ error: 'Invalid shelf format. Only alphanumeric characters, hyphens, and underscores allowed.' });
    }

    // Build RSS URL
    const params = new URLSearchParams({ shelf, sort: 'date_read' });
    if (key) params.set('key', key);
    const base = `https://www.goodreads.com/review/list_rss/${userId}?${params}`;

    let title = '';
    const allItems = [];

    for (let page = 1; page <= 20; page++) {
      const url = `${base}&page=${page}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const xml = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Cover-Flow-App/1.0' }
        }).then(r => {
          clearTimeout(timeoutId);
          if (!r.ok) throw new Error(`Goodreads returned ${r.status} for ${url}`);
          return r.text();
        });

        const feed = parser.parse(xml, { ignoreAttributes: false, attributeNamePrefix: '' });
        const items = feed?.rss?.channel?.item ?? [];
        title = feed?.rss?.channel?.title ?? '';

        items.forEach(raw => {
          allItems.push({
            book_id: +raw.book_id,
            title: raw.title,
            author_name: raw.author_name,
            image_url: raw.book_large_image_url || '',
            read_at: raw.user_read_at,
            date_added: raw.user_date_added || raw.date_added,
          });
        });

        if (items.length < 100) break;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - Goodreads is taking too long to respond');
        }
        throw error;
      }
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({ total: allItems.length, shelf, userId, items: allItems, title });
  } catch (err) {
    console.error('API Error:', err);

    const statusCode = err.message.includes('Goodreads returned') ? 502 : 500;
    const errorMessage = statusCode === 502
      ? 'Unable to fetch data from Goodreads. Please try again later.'
      : 'An internal server error occurred. Please try again later.';

    return res.status(statusCode).json({ error: errorMessage });
  }
}