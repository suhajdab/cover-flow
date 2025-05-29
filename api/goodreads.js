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
    const { userId, shelf = 'read', key, page = '1', streaming = 'false' } = req.query;

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

    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    // If streaming=false, return single page
    if (streaming === 'false') {
      return await handleSinglePage(req, res, userId, shelf, key, pageNum);
    }

    // Original streaming implementation
    return await handleStreaming(req, res, userId, shelf, key);
  } catch (err) {
    console.error('API Error:', err);

    const statusCode = err.message.includes('Goodreads returned') ? 502 : 500;
    const errorMessage = statusCode === 502
      ? 'Unable to fetch data from Goodreads. Please try again later.'
      : 'An internal server error occurred. Please try again later.';

    return res.status(statusCode).json({ error: errorMessage });
  }
}

async function handleSinglePage(req, res, userId, shelf, key, pageNum) {
  // Build RSS URL
  const params = new URLSearchParams({ shelf, sort: 'date_read', page: pageNum.toString() });
  if (key) params.set('key', key);
  const url = `https://www.goodreads.com/review/list_rss/${userId}?${params}`;

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
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout - Goodreads is taking too long to respond' });
    }
    throw error;
  }
}

async function handleStreaming(req, res, userId, shelf, key) {
  // Build RSS URL
  const params = new URLSearchParams({ shelf, sort: 'date_read' });
  if (key) params.set('key', key);
  const base = `https://www.goodreads.com/review/list_rss/${userId}?${params}`;

  // Set up streaming response for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  let title = '';
  let totalItems = 0;

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

      if (items.length > 0) {
        const pageData = items.map(raw => ({
          book_id: +raw.book_id,
          title: raw.title,
          author_name: raw.author_name,
          image_url: raw.book_large_image_url || '',
          read_at: raw.user_read_at,
          date_added: raw.user_date_added || raw.date_added,
        }));

        totalItems += pageData.length;

        // Send page data as SSE event
        const eventData = JSON.stringify({
          type: 'page',
          page,
          title,
          items: pageData,
          totalSoFar: totalItems
        });
        const chunk = `data: ${eventData}\n\n`;

        res.write(chunk);

        // Force flush the response and add small delay
        if (res.flush) {
          res.flush();
        }

        // Small delay to ensure streaming works properly
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      if (items.length < 100) break;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const errorData = JSON.stringify({
          type: 'error',
          message: 'Request timeout - Goodreads is taking too long to respond'
        });
        res.write(`data: ${errorData}\n\n`);
        return res.end();
      }
      const errorData = JSON.stringify({
        type: 'error',
        message: error.message
      });
      res.write(`data: ${errorData}\n\n`);
      return res.end();
    }
  }

  // Send completion signal
  const completeData = JSON.stringify({
    type: 'complete',
    total: totalItems,
    shelf,
    userId,
    title
  });
  res.write(`data: ${completeData}\n\n`);

  return res.end();
}