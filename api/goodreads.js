/**
 * Loads public Goodreads shelf covers
 * Query params: userId (required), shelf (optional), key (optional), page (optional), sort (optional), order (optional)
 */
import { loadGoodreadsShelf } from "../lib/goodreads-widget.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  try {
    const { userId, shelf = "read", key, page = "1", sort = "date_read", order = "a" } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "Missing required parameter \"userId\"" });
    }

    // Validate inputs to prevent SSRF attacks
    if (typeof userId !== "string" || userId.length > 15 || !/^\d+$/.test(userId)) {
      return res.status(400).json({ error: "Invalid userId format. Must be numeric." });
    }

    if (typeof shelf !== "string" || shelf.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(shelf)) {
      return res.status(400).json({ error: "Invalid shelf format. Only alphanumeric characters, hyphens, and underscores allowed." });
    }

    if (key !== undefined && key !== null &&
        (typeof key !== "string" || key.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(key))) {
      return res.status(400).json({ error: "Invalid key format" });
    }

    // Validate sort parameter if present - only allow alphanumeric and underscores
    if (typeof sort !== "string" || !/^[a-zA-Z0-9_]+$/.test(sort)) {
      return res.status(400).json({ error: "Invalid sort parameter format. Only alphanumeric characters and underscores allowed." });
    }

    // Validate order parameter if present - only allow "a" or "d"
    if (typeof order !== "string" || !/^[ad]$/.test(order)) {
      return res.status(400).json({ error: "Invalid order parameter format. Must be \"a\" or \"d\"." });
    }

    if (typeof page !== "string" || !/^\d+$/.test(page)) {
      return res.status(400).json({ error: "Invalid page number" });
    }

    const pageNum = Number(page);
    if (!Number.isSafeInteger(pageNum) || pageNum < 1 || pageNum > 21) {
      return res.status(400).json({ error: "Invalid page number" });
    }

    const data = pageNum === 1
      ? await loadGoodreadsShelf(userId, shelf)
      : { items: [], title: "" };
    return res.json({ page: pageNum, ...data, hasMore: false });
  } catch (err) {
    if (err.name === "TimeoutError") {
      return res.status(504).json({ error: "Request timeout - Goodreads is taking too long to respond" });
    }
    console.error("Goodreads widget error:", err.message);
    return res.status(502).json({ error: "Unable to fetch data from Goodreads. Please try again later." });
  }
}
