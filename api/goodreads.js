/*  api/goodreads.js
    A Vercel Node.js (λ) that proxies a Goodreads shelf RSS into clean JSON.

    Query parameters:
      userId   – Goodreads numerical user id     (required)
      shelf    – Shelf name, e.g. "to-read"      (optional, default "read")
      maxPages – Fail-safe page limit            (optional, default 20)
      fields   – Comma-sep list of properties to keep (optional)

    Example:
      /api/goodreads?userId=137464693&shelf=read
*/

import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser();

export default async function handler(req, res) {

  try {
    let title = '';
    const {
      userId,
      shelf = 'read',
      maxPages = 20,
      fields,                      // e.g. "title,author_name,link"
    } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'Missing required parameter "userId"' });
      return;
    }

    const keep = fields ? fields.split(',') : null;

    // goodreads rss example: https://www.goodreads.com/review/list_rss/18906657?key=-I4ajTpWDLwBoUseE9oOvPY79yya1ocsyHLfMWB760INaEPi&shelf=read&sort=date_read&page=2
    const base = `https://www.goodreads.com/review/list_rss/${userId}?key=-I4ajTpWDLwBoUseE9oOvPY79yya1ocsyHLfMWB760INaEPi&shelf=${encodeURIComponent(
      shelf,
    )}&sort=date_read`;

    const allItems = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const url = `${base}&page=${page}`;
      const xml = await fetch(url).then(
        r => {
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
          read_at: raw.read_at,
          date_added: raw.user_date_added || raw.date_added,
        };
        allItems.push(keep ? Object.fromEntries(Object.entries(obj).filter(([k]) => keep.includes(k))) : obj);
      });

      if (items.length < 100) break; // last page reached
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // 24 hour CDN
    return res.status(200).json({ total: allItems.length, shelf, userId, items: allItems, title });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}