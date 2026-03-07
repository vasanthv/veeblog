const rateLimiter = require("express-rate-limit");
const mongoStore = require("connect-mongo");
const session = require("express-session");
const uuid = require("uuid").v4;

const config = require("../config");
const utils = require("./utils");
const { Users } = require("./model").getInstance();

/**
 * This is an Express session middleware to enable session handling for the applicatio n
 * @return {null}
 */
const sessionMiddleWare = session({
	secret: config.SECRET,
	store: mongoStore.create({ mongoUrl: config.MONGODB_URI }),
	cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 },
	resave: false,
	saveUninitialized: false,
	rolling: true,
});

/**
 * This is an Express js middleware to attach the request user to req.user path.
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const attachUsertoRequest = async (req, res, next) => {
	if (req.session.token) {
		const token = req.session.token;
		req["token"] = token;
		req["user"] = await Users.findOne({ "devices.token": token }).lean();
	}
	next();
};

/**
 * Resolves username subdomains and stores the matched username on req.userDomain.
 * For requests on the root domain, the middleware is a no-op.
 * For requests on username.domain, a matching username must exist or a 404 is raised.
 */
const attachUserDomainToRequest = async (req, res, next) => {
	try {
		const hostname = (req.hostname || "").toLowerCase();
		const baseDomain = config.DOMAIN.split(":")[0].toLowerCase();
		const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

		if (!hostname || hostname === baseDomain) return next();
		if (hostname === `www.${baseDomain}`) return next();

		// Custom domain support: match request hostname against Users.domain
		const customDomainUser = await Users.findOne({
			domain: { $regex: new RegExp(`^${escapeRegExp(hostname)}$`, "i") },
		})
			.select("username")
			.lean()
			.exec();
		if (customDomainUser) {
			req.userDomain = customDomainUser.username;
			return next();
		}

		const domainSuffix = `.${baseDomain}`;
		if (!hostname.endsWith(domainSuffix)) return res.status(404).render("404");

		const subdomain = hostname.slice(0, -domainSuffix.length);
		if (!subdomain || subdomain.includes(".")) return res.status(404).render("404");

		const username = subdomain.toLowerCase();
		if (!/^([a-zA-Z0-9]){3,18}$/.test(username) || config.INVALID_HANDLES.includes(username)) {
			return res.status(404).render("404");
		}
		const user = await Users.findOne({ username }).select("username").lean().exec();

		if (!user) return res.status(404).render("404");
		req.userDomain = user.username;

		next();
	} catch (error) {
		next(error);
	}
};

/**
 * This is an Express js middleware to check if the request is authenticated or not.
 * Calls next when authenticated.
 * Responds a JSON error response if not authenticated.
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const isUserAuthed = (req, res, next) => {
	if (req.user) return next();
	res.status(401).json({ message: "Please log in" });
};

/**
 * This is an Express js middleware to add CSRF tokens to the request
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const csrfMiddleware = (req, res, next) => {
	if (config.DISABLE_CSRF) return next();
	const CSRF_COOKIE = config.CSRF_COOKIE;

	// Only protect state-changing requests
	if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
		// Ensure token exists for the client
		if (!req.cookies[CSRF_COOKIE]) {
			const token = utils.createCsrfToken();
			res.cookie(CSRF_COOKIE, token, {
				httpOnly: false, // must be readable by JS
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
				maxAge: config.CSRF_TOKEN_EXPIRY * 1000,
			});
			req.csrfToken = token;
		}
		req.csrfToken = req.cookies[CSRF_COOKIE];
		return next();
	}

	const cookieToken = req.cookies[CSRF_COOKIE];
	const requestToken = req.headers["x-csrf-token"] || req.body?.csrfToken;

	if (!cookieToken || !requestToken || cookieToken !== requestToken || !utils.verifyCsrfToken(requestToken)) {
		return res.status(403).json({ error: "Page expired. Please refresh and try again" });
	}

	next();
};

/**
 * This is an Express js middleware to rate limit request. Uses `express-rate-limit` package
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const rateLimit = (options) => {
	return rateLimiter({
		max: 50,
		...options,
		windowMs: (options?.windowMs || 15) * 60 * 1000, // in minutes
		// Use a combination of factors for rate limiting
		keyGenerator: (req) => {
			// If user is authenticated, use their session token
			if (req.session?.token) return req.session.token;

			// Otherwise use a combination of IP and user agent
			const userAgent = req.get("user-agent") || "unknown";
			return `${req.ip}-${userAgent}`;
		},
		handler: (req, res) =>
			res.status(429).json({
				message: `Too many requests. Try again after ${options?.windowMs || 15} mins`,
			}),
	});
};

module.exports = {
	sessionMiddleWare,
	attachUsertoRequest,
	attachUserDomainToRequest,
	isUserAuthed,
	csrfMiddleware,
	rateLimit,
};
