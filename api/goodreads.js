/**
 * Converts Goodreads shelf RSS into clean JSON
 * Query params: userId (required), shelf (optional), key (optional), page (optional), sort (optional), order (optional)
 */
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    const { userId, shelf = 'read', key, page = '1', sort = 'date_read', order = 'a' } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing required parameter "userId"' });
    }

    // Validate inputs to prevent SSRF attacks
    if (typeof userId !== "string" || userId.length > 15 || !/^\d+$/.test(userId)) {
      return res.status(400).json({ error: 'Invalid userId format. Must be numeric.' });
    }

    if (typeof shelf !== "string" || shelf.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(shelf)) {
      return res.status(400).json({ error: 'Invalid shelf format. Only alphanumeric characters, hyphens, and underscores allowed.' });
    }

    if (key !== undefined && key !== null &&
        (typeof key !== "string" || key.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(key))) {
      return res.status(400).json({ error: "Invalid key format" });
    }

    // Validate sort parameter if present - only allow alphanumeric and underscores
    if (typeof sort !== "string" || !/^[a-zA-Z0-9_]+$/.test(sort)) {
      return res.status(400).json({ error: 'Invalid sort parameter format. Only alphanumeric characters and underscores allowed.' });
    }

    // Validate order parameter if present - only allow 'a' or 'd'
    if (typeof order !== "string" || !/^[ad]$/.test(order)) {
      return res.status(400).json({ error: 'Invalid order parameter format. Must be "a" or "d".' });
    }

    if (typeof page !== "string" || !/^\d+$/.test(page)) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    const pageNum = Number(page);
    if (!Number.isSafeInteger(pageNum) || pageNum < 1 || pageNum > 21) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    return await handleSinglePage(res, userId, shelf, key, pageNum, 'date_read', 'a');
  } catch (err) {
    console.error('API Error:', err);

    const statusCode = err.message.includes('Goodreads returned') ? 502 : 500;
    const errorMessage = statusCode === 502
      ? 'Unable to fetch data from Goodreads. Please try again later.'
      : 'An internal server error occurred. Please try again later.';

    return res.status(statusCode).json({ error: errorMessage });
  }
}

async function handleSinglePage(res, userId, shelf, key, pageNum, sort, order) {
  // Build RSS URL
  const params = new URLSearchParams({ 
    shelf, 
    sort,
    page: pageNum.toString() 
  });
  
  // Add order parameter if provided
  if (order) {
    params.set('order', order);
  }
  
  if (key) params.set('key', key);
  const url = `https://www.goodreads.com/review/list_rss/${userId}?${params}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Cover-Flow-App/1.0' }
    });
    if (!response.ok) throw new Error(`Goodreads returned ${response.status}`);
    const xml = await response.text();

    const feed = parser.parse(xml, { ignoreAttributes: false, attributeNamePrefix: '' });
    const parsedItems = feed?.rss?.channel?.item;
    const items = Array.isArray(parsedItems) ? parsedItems : parsedItems ? [parsedItems] : [];
    const title = feed?.rss?.channel?.title ?? '';

    const pageData = items.map(raw => ({
      book_id: +raw.book_id,
      title: raw.title,
      author_name: raw.author_name,
      image_url: raw.book_large_image_url || '',
      read_at: raw.user_read_at,
      date_added: raw.user_date_added || raw.date_added,
    }));

    res.json({
      page: pageNum,
      items: pageData,
      title,
      hasMore: items.length === 100 // Goodreads returns 100 items per page
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout - Goodreads is taking too long to respond' });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
