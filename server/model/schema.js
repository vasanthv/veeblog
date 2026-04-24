const { Schema } = require("mongoose");

const config = require("../../config");

const userSchema = new Schema({
	username: {
		type: String,
		index: true,
		required: true,
		unique: true,
		match: /^([a-zA-Z0-9]){3,18}$/,
	},
	password: String,
	email: { type: String, index: true, required: true, unique: true },
	emailVerificationCode: { type: String, index: true },
	createdOn: { type: Date, default: Date.now },
	usertype: { type: String, enum: ["free", "paid"], default: "free", required: true },
	updatedOn: Date,
	lastLoginOn: Date,
	name: String,
	iconUrl: String,
	bio: String,
	bioHTML: String,
	nav: { type: String, default: "[Home](/) &middot; [Follow via RSS](/feed/rss)" },
	navHTML: {
		type: String,
		default: '<a href="/">Home</a> · <a href="/feed/rss">Follow via RSS</a>',
	},
	domain: String,
	customStyle: String,
	customScriptUrl: String,
	feedFollows: [{ type: String }],
	devices: [{ token: { type: String, index: true }, userAgent: String }],
	deletionDate: { type: Date, expires: 0 },
});

const postSchema = new Schema({
	user: { type: Schema.Types.ObjectId, ref: "Users", index: true },
	text: String,
	html: String,
	hashtags: [{ type: String, index: true }],
	createdOn: { type: Date, default: Date.now },
	updatedOn: Date,
	deletionDate: { type: Date, expires: 0 },
});

const cacheSchema = new Schema({
	guid: { type: String, select: false },
	feedUrl: String,
	title: String,
	link: String,
	channel: { title: String, link: String, image: String },
	publishedOn: Date,
	createdOn: { type: Date, select: false, default: Date.now, expires: config.FEED_ITEMS_CACHE_TTL_MS },
});

module.exports = {
	userSchema,
	postSchema,
	cacheSchema,
};
