const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
const router = require("express").Router();
const { Users, Posts } = require("../model").getInstance();
const { getPagedPosts, getUserBaseUrl } = require("../utils");

dayjs.extend(relativeTime);

const staticViews = ["/terms", "/privacy"];
router.get(staticViews, (req, res) => res.render(req.path.substring(1), { user: req.user }));

// attach day js to be used in ejs
router.use((req, res, next) => {
	res.locals.dayjs = dayjs;
	next();
});

// Attach tags from the query params
router.use((req, res, next) => {
	const rawTags = req.query.tag;
	if (rawTags) {
		req.tags = (Array.isArray(rawTags) ? rawTags : [rawTags]).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
	}
	next();
});

router.get("/", async (req, res, next) => {
	try {
		if (!req.user) return res.render("index");
		const query = { user: req.user._id };
		if (req.tags?.length > 0) query.hashtags = { $all: req.tags };

		const userBaseUrl = getUserBaseUrl(req.user);
		const pagination = await getPagedPosts(req, query);
		res.render("home", { user: req.user, tags: req.tags, ...pagination, userBaseUrl });
	} catch (error) {
		next(error);
	}
});

router.get(["/login", "/signup"], (req, res, next) => {
	try {
		if (req.user) return res.redirect("/");

		const view = req.path.substring(1);
		res.render(view, { csrfToken: req.csrfToken });
	} catch (error) {
		next(error);
	}
});

router.get("/new", async (req, res, next) => {
	try {
		if (!req.user) return res.redirect("/login");
		res.render("post", { user: req.user, csrfToken: req.csrfToken });
	} catch (error) {
		next(error);
	}
});

router.get("/edit/:id", async (req, res, next) => {
	try {
		if (!req.user) return res.redirect("/login");

		const query = { _id: req.params.id };

		const post = await Posts.findOne(query).lean();

		if (!post.user.equals(req.user._id)) return res.status(404).render("404", { user: req.user });

		res.render("post", { user: req.user, post, csrfToken: req.csrfToken });
	} catch (error) {
		next(error);
	}
});

router.get("/feed", async (req, res, next) => {
	try {
		if (!req.user) return res.redirect("/login");

		res.render("feed", { user: req.user, csrfToken: req.csrfToken });
	} catch (error) {
		next(error);
	}
});

router.get("/feed/config", async (req, res, next) => {
	try {
		if (!req.user) return res.redirect("/login");
		res.render("feed-config", { user: req.user, csrfToken: req.csrfToken });
	} catch (error) {
		next(error);
	}
});

router.get("/settings", async (req, res, next) => {
	try {
		if (!req.user) return res.redirect("/login");
		res.render("settings", { user: req.user, csrfToken: req.csrfToken });
	} catch (error) {
		next(error);
	}
});

router.get("/export", async (req, res, next) => {
	try {
		if (!req.user) return res.redirect("/login");

		const posts = await Posts.find({ user: req.user._id }).lean().exec();

		const exportData = {
			name: req.user.name,
			username: req.user.username,
			email: req.user.email,
			bio: req.user.bio,
			footer: req.user.footer,
			createdOn: req.user.createdOn,
			follows: req.user.follows,
			posts: posts.map((post) => ({
				_id: post._id,
				text: post.text,
				tags: post.hashtags,
				date: post.createdOn,
				updatedOn: post.updatedOn,
			})),
		};

		const jsonString = JSON.stringify(exportData, null, 2); // 'null, 2' for pretty-printing

		// Set headers to prompt download
		res.setHeader("Content-disposition", `attachment; filename=veeblog_${req.user.username}.json`);
		res.setHeader("Content-Type", "application/json");

		// Send the JSON string as the response body
		res.end(jsonString);
	} catch (error) {
		next(error);
	}
});

router.get("/logout", async (req, res, next) => {
	try {
		if (!req.user) return res.redirect("/");
		await Users.updateOne({ _id: req.user._id }, { $pull: { devices: { token: req.token } } });
		req.session.destroy();
		res.redirect("/");
	} catch (error) {
		next(error);
	}
});

router.get("/*", async (req, res, next) => res.status(404).render("404", { user: req.user }));

// Handle the known errors
router.use((err, req, res, next) => {
	console.error(err, "Caught error");
	if (err.httpErrorCode) {
		res.status(err.httpErrorCode).send(err.message || "Something went wrong");
	} else {
		next(err);
	}
});

// Handle the unknown errors
// eslint-disable-next-line
router.use((err, req, res, next) => {
	console.error(err, "Uncaught error");
	res.status(500).send("Something went wrong");
});

module.exports = router;
