const { marked } = require("marked");

// Markdown to html converter initialization
const renderer = new marked.Renderer();

// Prevent nested links
renderer.link = function (href, title, text) {
	const token = typeof href === "object" && href !== null ? href : null;
	const resolvedHref = token ? token.href : href;
	const resolvedTitle = token ? token.title : title;
	const resolvedText = token ? token.text : text;
	if (!resolvedHref) return resolvedText ?? "";
	const t = resolvedTitle ? ` title="${resolvedTitle}"` : "";
	return `<a href="${resolvedHref}"${t} target="_blank" rel="noopener noreferrer">${resolvedText}</a>`;
};

renderer.text = function (text) {
	const safeText = typeof text === "string" ? text : (text?.text ?? String(text ?? ""));
	// 1️⃣ Linkify URLs
	let result = safeText.replace(
		/\bhttps?:\/\/[^\s<]+[^\s<.,:;"')\]]/gi,
		(url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
	);
	// 2️⃣ Linkify hashtags
	result = result.replace(
		/\B#([a-zA-Z0-9_]+)/g,
		(_, tag) => `<a href="?tag=${encodeURIComponent(tag.toLowerCase())}">#${tag}</a>`
	);

	return result;
};

marked.setOptions({ renderer });

module.exports = marked;
