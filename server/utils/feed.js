const { JSDOM } = require("jsdom");
const { fetchFeedXml, parseFeed, processFeed } = require("../rss-parser");

const { Cache } = require("../model").getInstance();

/**
 * Resolves a usable feed URL from an input URL.
 * First checks whether the URL itself is a valid RSS/Atom feed, then falls back to
 * discovering `<link rel="alternate" ...>` feed links from HTML content.
 *
 * @param {string} url - Candidate website/feed URL.
 * @returns {Promise<string|null>} A valid feed URL or `null` if none can be resolved.
 */
const getValidFeedUrl = async (url) => {
	try {
		const content = await fetchFeedXml(url);
		try {
			const { items } = await parseFeed(content);
			if (items.length > 0) return url;
		} catch {
			// Not a valid feed. Check HTML link tags next.
		}

		const dom = new JSDOM(content);
		const links = [...dom.window.document.querySelectorAll("link[href]")];
		for (const linkEl of links) {
			const rel = (linkEl.getAttribute("rel") || "").toLowerCase();
			const type = (linkEl.getAttribute("type") || "").toLowerCase();
			const href = linkEl.getAttribute("href");
			if (!href) continue;

			const isRssLink = rel.includes("alternate") && /(?:rss|atom|xml)/i.test(type);
			if (!isRssLink) continue;

			try {
				return new URL(href, url).toString();
			} catch {
				continue;
			}
		}

		return null;
	} catch (err) {
		console.error(`Error while getting valid feed url: ${url}`, err.message);
		return null;
	}
};

/**
 * Fetches a feed, caches parsed items, and updates feed status metadata.
 *
 * @param {string} url - Feed URL to fetch and cache.
 * @returns {Promise<{success: boolean, url: string}>} Cache operation result.
 */
const cacheFeed = async (url) => {
	try {
		if (!url || typeof url !== "string") return { success: false, url };

		const cachedCount = await Cache.countDocuments({ feedUrl: url });
		if (cachedCount > 0) return { success: true, url };

		const { items, channel } = await processFeed(url);
		if (!Array.isArray(items) || items.length === 0) return { success: false, url };

		const cachePayload = items.map((item) => ({
			...item,
			feedUrl: channel.feedUrl,
		}));

		await Cache.insertMany(cachePayload, { ordered: false });

		return { success: true, url };
	} catch {
		return { success: false, url };
	}
};

module.exports = { getValidFeedUrl, cacheFeed };
