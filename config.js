const IS_PROD = process.env.NODE_ENV === "production";
const DOMAIN = IS_PROD ? "veeblog.com" : "veeblog.local:3000";

module.exports = {
	DOMAIN,
	IS_PROD,
	NODE_ENV: process.env.NODE_ENV,
	PORT: process.env.PORT || 3000,
	PAGE_LIMIT: 50,
	URL: IS_PROD ? `https://${DOMAIN}/` : `http://${DOMAIN}/`,
	MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/veeblog-dev",
	DISABLE_CSRF: process.env.DISABLE_CSRF,
	CSRF_COOKIE: "csrf_cookie",
	CSRF_TOKEN_EXPIRY: 60 * 30, // 30 mins
	SECRET: process.env.SECRET ?? "some-secret",
	AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY_ID,
	AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
	NO_REPLY_EMAIL: process.env.NO_REPLY_EMAIL ?? "Veeblog <noreply@email.veeblog.com>",
	INVALID_HANDLES: ["administrator", "admin", "bot", "veeblog", "hello", "hey", "hi", "demo", "test"],
	TITLE_MAX_LENGTH: 320,
	FEED_ITEMS_CACHE_TTL_MS: 60 * 60,
};
