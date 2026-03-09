const Feed = require("feed").Feed;
const router = require("express").Router();

const { Posts } = require("../model").getInstance();
const { attachDayjsToLocals, attachTagsFromQuery, setUserTimezone } = require("../middlewares");
const {
	getPagedPosts,
	getUserBaseUrl,
	getUserByUsername,
	getValidUsername,
	getTitle,
	formatPostDate,
} = require("../utils");
const config = require("../../config");

router.use(attachDayjsToLocals);
router.use(attachTagsFromQuery);

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
			...pagination,
		});
	} catch (error) {
		next(error);
	}
});

router.get("/post/:id", setUserTimezone, async (req, res, next) => {
	try {
		const handle = getValidUsername(req.userDomain);
		const query = { _id: req.params.id };

		const post = await Posts.findOne(query).populate("user").lean();

		if (post?.user?.username !== handle) return res.status(404).render("404");

		let postDate = post.createdOn.toString();

		if (req.timezone) {
			postDate = formatPostDate(post.createdOn, req.timezone);
		}

		res.render("single", { profile: post.user, post, title: getTitle(post.text), postDate });
	} catch (error) {
		next(error);
	}
});

router.get("/tags", async (req, res, next) => {
	try {
		const handle = getValidUsername(req.userDomain);
		const profileUser = await getUserByUsername(handle);
		if (!profileUser) return res.status(404).render("404");

		const groupedTags = await Posts.aggregate([
			{ $match: { user: profileUser._id } },
			{ $unwind: "$hashtags" },
			{ $group: { _id: "$hashtags", count: { $sum: 1 } } },
			{ $sort: { _id: 1 } },
		]);

		res.render("tags", { profile: profileUser, groupedTags });
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
	if (err.httpErrorCode) {
		res.status(err.httpErrorCode).send(err.message || "Something went wrong");
	} else {
		next(err);
	}
});

// Handle the unknown errors
// eslint-disable-next-line
router.use((err, req, res, next) => {
	console.error(err);
	res.status(500).send("Something went wrong");
});

module.exports = router;
