const geoip = require("geoip-lite");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
const Feed = require("feed").Feed;
const router = require("express").Router();

const { Posts } = require("../model").getInstance();
const { getPagedPosts, getUserBaseUrl, getUserByUsername, getValidUsername, getTitle } = require("../utils");
const config = require("../../config");

dayjs.extend(relativeTime);

const staticViews = ["/terms", "/privacy", "/pricing"];
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
		const handle = getValidUsername(req.userDomain);
		const profileUser = await getUserByUsername(handle);
		if (!profileUser) return res.status(404).render("404");

		const query = { user: profileUser._id };
		if (req.tags?.length > 0) query.hashtags = { $all: req.tags };

		const pagination = await getPagedPosts(req, query);
		res.render("profile", {
			user: req.user,
			tags: req.tags,
			profile: profileUser,
			url: config.URL,
			csrfToken: req.csrfToken,
			...pagination,
		});
	} catch (error) {
		next(error);
	}
});

router.get("/post/:id", async (req, res, next) => {
	try {
		const handle = getValidUsername(req.userDomain);
		const query = { _id: req.params.id };

		const post = await Posts.findOne(query).populate("user").lean();

		if (post?.user?.username !== handle) return res.status(404).render("404");

		let postDate = post.createdOn.toString();

		// get user timezone from ip address from cloudfront
		if (req.userIp) {
			const geo = geoip.lookup(req.userIp);
			if (geo?.timezone) {
				postDate = post.createdOn.toLocaleString("en-US", { timeZone: geo.timezone });
			}
		}

		res.render("single", {
			profile: post.user,
			post,
			csrfToken: req.csrfToken,
			title: getTitle(post.text),
			postDate,
		});
	} catch (error) {
		next(error);
	}
});

router.get(["/feed/rss", "/feed/json"], async (req, res, next) => {
	try {
		const handle = getValidUsername(req.userDomain);
		const profileUser = await getUserByUsername(handle);
		if (!profileUser) return res.status(404).render("404");

		const query = { user: profileUser._id };
		if (req.tags?.length > 0) query.hashtags = { $all: req.tags };

		const { posts } = await getPagedPosts(req, query);

		const baseUrl = getUserBaseUrl(profileUser);

		const feed = new Feed({
			title: profileUser.name ?? profileUser.username,
			description: profileUser.bio,
			id: baseUrl,
			link: baseUrl,
			generator: config.URL,
			author: {
				name: profileUser.name ?? profileUser.username,
				link: baseUrl,
			},
		});

		posts.forEach((post) => {
			feed.addItem({
				title: getTitle(post.text),
				id: `${baseUrl}post/${post._id}`,
				link: `${baseUrl}post/${post._id}`,
				description: post.text,
				content: post.html,
				date: post.createdOn,
			});
		});

		if (req.path.endsWith("/json")) {
			return res.type("application/feed+json").send(feed.json1());
		}
		return res.type("application/rss+xml").send(feed.rss2());
	} catch (error) {
		next(error);
	}
});

router.get("/*", async (req, res, next) => res.status(404).render("404"));

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
