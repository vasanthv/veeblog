const randomString = require("randomstring");
const uuid = require("uuid").v4;

const utils = require("./utils");
const config = require("../config");

const { Cache, Users, Posts } = require("./model").getInstance();

const signUp = async (req, res, next) => {
	try {
		const username = utils.getValidUsername(req.body.username);
		await utils.isNewUsername(username);
		const email = utils.getValidEmail(req.body.email);
		await utils.isNewEmail(email);
		const password = utils.getValidPassword(req.body.password);
		const userAgent = req.get("user-agent");
		const date = new Date();

		const emailVerificationCode = uuid();
		const token = uuid();

		await new Users({
			username,
			email,
			password,
			emailVerificationCode,
			devices: [{ token, userAgent }],
			createdOn: date,
		}).save();
		req.session.token = token;

		res.json({
			message: "Account created. Please verify your email.",
			username,
		});

		utils.verificationEmail(username, email, emailVerificationCode);
	} catch (error) {
		next(error);
	}
};

const logIn = async (req, res, next) => {
	try {
		const username = utils.getValidUsername(req.body.username);
		const password = utils.getValidPassword(req.body.password);

		const user = await Users.findOne({
			username: { $regex: new RegExp(`^${username}$`, "i") },
			password,
		}).exec();

		if (!user) return utils.httpError(400, "Invalid user credentials");

		const userAgent = req.get("user-agent");

		const token = uuid();
		const devices = { token, userAgent };

		await Users.updateOne({ _id: user._id }, { $push: { devices }, lastLoginAt: new Date() });

		req.session.token = token;
		res.json({ message: "Logged in", username: user.username });

		try {
			if (user.deletionDate) {
				await Promise.all([
					Users.updateOne({ _id: user._id }, { $unset: { deletionDate: 1 } }),
					Posts.updateOne({ user: user._id }, { $unset: { deletionDate: 1 } }),
				]);
			}
		} catch (err) {}
	} catch (error) {
		next(error);
	}
};

const verifyEmail = async (req, res, next) => {
	try {
		const code = req.params.code;

		const user = await Users.findOne({ emailVerificationCode: code }).exec();
		if (!user) return res.status(400).send("Invalid email verification code");

		await Users.updateOne({ _id: user._id }, { $unset: { emailVerificationCode: 1 }, lastUpdatedAt: new Date() });

		res.send("Email verified");
	} catch (error) {
		next(error);
	}
};

const resetPassword = async (req, res, next) => {
	try {
		const username = utils.getValidUsername(req.body.username);

		const user = await Users.findOne({ username }).exec();
		if (!user) return utils.httpError(400, "Invalid username");

		const passwordString = randomString.generate(8);
		const password = await utils.getValidPassword(passwordString);

		await Users.updateOne({ _id: user._id }, { password, lastUpdatedOn: new Date() });
		await utils.resetPasswordEmail(user.username, user.email, passwordString);

		res.json({ message: "Password resetted" });
	} catch (error) {
		next(error);
	}
};

const resendEmailVerification = async (req, res, next) => {
	try {
		const { username, email, emailVerificationCode } = req.user;
		if (!emailVerificationCode) return utils.httpError(400, "Email has beed already verified");

		utils.verificationEmail(username, email, emailVerificationCode);

		res.json({ message: "Re-sent verification email." });
	} catch (error) {
		next(error);
	}
};

const updateAccount = async (req, res, next) => {
	try {
		const email =
			req.body.email && req.body.email !== req.user.email ? await utils.getValidEmail(req.body.email) : null;
		if (email) await utils.isNewEmail(email, req.user._id);

		const password = req.body.password ? await utils.getValidPassword(req.body.password) : null;

		const name = req.body.name ? await utils.getValidString(req.body.name, 1, 50, "Name") : null;
		const bio = req.body.bio ? await utils.getValidString(req.body.bio, 1, 640, "Bio") : null;

		const iconUrl = req.body.iconUrl ? await utils.getValidString(req.body.iconUrl, 1, 500, "Icon URL ") : null;

		const updateFields = {};
		if (email && email !== req.user.email) {
			const emailVerificationCode = uuid();
			updateFields["email"] = email;
			updateFields["emailVerificationCode"] = emailVerificationCode;
			await utils.verificationEmail(req.user.username, email, emailVerificationCode);
		}
		if (password) updateFields["password"] = password;

		updateFields["name"] = name;
		updateFields["iconUrl"] = iconUrl;

		if (bio) {
			updateFields["bio"] = bio;
			updateFields["bioHTML"] = utils.markdownToHtml(bio);
		} else {
			updateFields["bio"] = "";
			updateFields["bioHTML"] = "";
		}

		const customStyle = req.body.customStyle
			? await utils.getValidString(req.body.customStyle, 1, 5000, "Custom Style ")
			: null;
		updateFields["customStyle"] = customStyle;

		if (req.user.usertype !== "free") {
			const domain = req.body.domain ? await utils.getValidString(req.body.domain, 1, 100, "Domain") : null;
			const customScriptUrl = req.body.customScriptUrl
				? await utils.getValidString(req.body.customScriptUrl, 1, 500, "Custom Script URL ")
				: null;

			updateFields["domain"] = domain;
			updateFields["customScriptUrl"] = customScriptUrl;
		}

		await Users.updateOne({ _id: req.user._id }, { ...updateFields, lastUpdatedOn: new Date() });
		res.json({
			message: `Account updated. ${updateFields["emailVerificationCode"] ? "Please verify your email" : ""}`,
		});
	} catch (error) {
		next(error);
	}
};

const updateFeeds = async (req, res, next) => {
	try {
		const rawFeeds = typeof req.body.feeds === "string" ? req.body.feeds : "";
		const feedFollows = [
			...new Set(
				rawFeeds
					.split(/\r?\n/)
					.map((url) => url.trim())
					.filter(Boolean)
			),
		];

		feedFollows.forEach((url) => {
			if (!utils.isValidUrl(url)) utils.httpError(400, `Invalid feed URL: ${url}`);
		});

		await Users.updateOne({ _id: req.user._id }, { feedFollows, lastUpdatedOn: new Date() });
		res.json({ message: "Feeds updated", feedFollows });
	} catch (error) {
		next(error);
	}
};

const getFeed = async (req, res, next) => {
	try {
		const feedUrls = req.user.feedFollows;

		if (!feedUrls || feedUrls.length === 0) return utils.httpError(400, "No feeds");

		if (feedUrls.length > 50) return utils.httpError(400, "Max. 50 feeds");

		const results = await Promise.allSettled(feedUrls.map(utils.cacheFeed));

		const errors = results.filter((r) => !r.value.success).map((r) => r.value.url);
		const skip = req.query.skip;

		const items = await Cache.find({ feedUrl: { $in: feedUrls } })
			.sort("-publishedOn")
			.skip(skip)
			.limit(config.PAGE_LIMIT)
			.lean();

		res.json({ items, errors });
	} catch (error) {
		next(error);
	}
};

const deleteAccount = async (req, res, next) => {
	try {
		await utils.accountDeletionEmail(req.user.username, req.user.email);

		const deletionDate = new Date(new Date().setDate(new Date().getDate() + 7));
		await Promise.all([
			Users.updateOne({ _id: req.user._id }, { deletionDate: deletionDate }),
			Posts.updateOne({ user: req.user._id }, { deletionDate: deletionDate }),
		]);

		return res.json({ message: "Your account will be deleted in 7 days." });
	} catch (error) {
		next(error);
	}
};

const logOut = async (req, res, next) => {
	try {
		await Users.updateOne({ _id: req.user._id }, { $pull: { devices: { token: req.token } } });
		req.session.destroy();
		res.json({ message: "Logged out" });
	} catch (error) {
		next(error);
	}
};

const createPost = async (req, res, next) => {
	try {
		if (req.user.emailVerificationCode) {
			return utils.httpError(400, "Please verify your email.");
		}

		const text = utils.getValidPost(req.body.text);
		const hashtags = utils.getHashtagsFromText(text);
		const html = utils.markdownToHtml(text);
		const post = await new Posts({
			user: req.user._id,
			text,
			html,
			hashtags,
			createdOn: new Date(),
		}).save();

		res.json({ message: "Post created", post });
	} catch (error) {
		next(error);
	}
};

const updatePost = async (req, res, next) => {
	try {
		const post = await Posts.findOne({ _id: req.params.id, user: req.user._id }).exec();
		if (!post) return utils.httpError(404, "Post not found");

		const updateFields = {};

		const text = utils.getValidPost(req.body.text);
		updateFields["text"] = text;
		updateFields["html"] = utils.markdownToHtml(text);
		updateFields["hashtags"] = utils.getHashtagsFromText(text);

		updateFields["updatedOn"] = new Date();
		await Posts.updateOne({ _id: post._id }, updateFields);

		res.json({ message: "Post updated" });
	} catch (error) {
		next(error);
	}
};

const deletePost = async (req, res, next) => {
	try {
		const post = await Posts.findOneAndDelete({ _id: req.params.id, user: req.user._id }).exec();
		if (!post) return utils.httpError(404, "Post not found");

		res.json({ message: "Post deleted" });
	} catch (error) {
		next(error);
	}
};

module.exports = {
	signUp,
	logIn,
	verifyEmail,
	resetPassword,
	resendEmailVerification,
	updateAccount,
	updateFeeds,
	getFeed,
	logOut,
	deleteAccount,
	createPost,
	updatePost,
	deletePost,
};
