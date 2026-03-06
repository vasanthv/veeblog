const axios = require("axios");
const Parser = require("rss-parser");
const { TITLE_MAX_LENGTH } = require("../../config");

const parser = new Parser();

/**
 * Fetches XML data from the given URL.
 * @param {string} url - The RSS/Atom feed URL.
 * @returns {Promise<string>} - The XML data as a string.
 */
async function fetchFeedXml(url) {
	if (!url || typeof url !== "string") {
		throw new Error("Invalid feed URL");
	}

	let validatedUrl;
	try {
		validatedUrl = new URL(url).toString();
	} catch {
		throw new Error("Invalid feed URL");
	}

	try {
		const response = await axios.get(validatedUrl, { timeout: 10000, responseType: "text" });
		if (response.status !== 200) {
			throw new Error(`HTTP Error: ${response.status}`);
		}
		if (typeof response.data !== "string" || response.data.trim().length === 0) {
			throw new Error("Feed response is empty or not text");
		}
		return response.data;
	} catch (error) {
		throw error;
	}
}

/**
 * Returns the ISO 8601 date string for the date 20 years from now.
 *
 * @returns {string} An ISO-formatted date string (e.g., "2046-02-12T10:15:30.000Z").
 */
const isoDateTwentyYearsFromNow = () => {
	const date = new Date();
	date.setFullYear(date.getFullYear() + 20);
	return date.toISOString().replace(".000Z", "Z");
};

/**
 * Normalizes a date string to ISO format without milliseconds.
 * @param {string} dateStr - The date string from RSS/Atom feed.
 * @returns {string | null} - The formatted date string.
 */
const normalizeDate = (dateStr) => {
	if (!dateStr) return null;
	const date = new Date(dateStr);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().replace(".000Z", "Z");
};

/**
 * Trims a title to TITLE_MAX_LENGTH characters and adds an ellipsis if necessary.
 * @param {string} title - The original title string.
 * @returns {string} - The formatted title.
 */
const formatTitle = (title) => {
	const maxLength = TITLE_MAX_LENGTH;
	const safeTitle = typeof title === "string" ? title : String(title ?? "");
	return safeTitle.length > maxLength ? safeTitle.slice(0, maxLength).trim() + "…" : safeTitle;
};

/**
 * Parses XML feed data and extracts metadata and relevant items.
 * Filters out items missing title, link, or date.
 * @param {string} xmlData - The RSS/Atom XML data.
 * @param {string} [feedUrl] - Original source feed URL fallback.
 * @returns {Promise<Object>} - Extracted feed metadata and items.
 */
async function parseFeed(xmlData, feedUrl) {
	try {
		if (typeof xmlData !== "string" || xmlData.trim().length === 0) {
			throw new Error("Feed content is empty or not text");
		}

		const feed = await parser.parseString(xmlData);
		const feedItems = Array.isArray(feed.items) ? feed.items : [];

		// Extract channel-level metadata
		const channel = {
			title: feed.title ?? "",
			image: feed.image?.url,
			link: feed.link,
			description: feed.description,
			feedUrl: feedUrl,
		};

		// Extract and filter valid items
		const items = feedItems.slice(0, 100).map((item) => {
			const safeItem = item && typeof item === "object" ? item : {};
			const link = typeof safeItem.link === "string" && safeItem.link.trim() ? safeItem.link : "javascript:void(0)";
			const fallbackTitle =
				safeItem["content:encodedSnippet"] ?? safeItem.contentSnippet ?? safeItem.link ?? "Untitled item";

			return {
				guid: typeof safeItem.guid === "string" ? safeItem.guid : (safeItem.id ?? safeItem.link ?? link),
				title: formatTitle(safeItem.title ?? fallbackTitle),
				link,
				channel: { title: feed.title ?? "Unknown", link: feed.link, image: feed.image?.url },
				publishedOn: normalizeDate(safeItem.pubDate ?? safeItem.isoDate) ?? isoDateTwentyYearsFromNow(),
			};
		});

		return { items, channel };
	} catch (error) {
		throw new Error(error.message);
	}
}

/**
 * Main function to fetch and parse a feed URL.
 * @param {string} feedUrl - The RSS/Atom feed URL.
 */
async function processFeed(feedUrl) {
	try {
		const xmlData = await fetchFeedXml(feedUrl);
		return await parseFeed(xmlData, feedUrl);
	} catch (error) {
		console.log(`Error processing feedUrl: ${feedUrl}`, error.message);
		throw new Error(error.message);
	}
}

module.exports = { fetchFeedXml, parseFeed, processFeed };
