/* global axios, Vue */

const defaultState = function () {
	const params = new URLSearchParams(window.location.search);
	return {
		toast: [{ type: "", message: "" }],
		newAccount: { username: "", email: "", password: "" },
		authCreds: { username: "", password: "" },
		post: { text: params.has("text") ? params.get("text") : "" },
		myAccount: { username: "", email: "", password: "", name: "", bio: "" },
		feedUrls: "",
		deleteConfirm: false,
		feedItems: [],
		feedErrorHTML: "",
		isLoading: false,
	};
};
function redirect(path, replace = false) {
	if (replace) window.location.replace(path);
	else window.location.href = path;
}
const App = Vue.createApp({
	data() {
		return defaultState();
	},
	methods: {
		setToast(message, type = "error") {
			this.toast = { type, message, time: new Date().getTime() };
			setTimeout(() => {
				if (new Date().getTime() - this.toast.time >= 3000) {
					this.toast.message = "";
				}
			}, 3500);
		},
		signUp() {
			if (!this.newAccount.username || !this.newAccount.email || !this.newAccount.password) {
				return this.setToast("All fields are mandatory");
			}
			axios.post("/api/signup", this.newAccount).then(this.authenticate);
		},
		signIn() {
			if (!this.authCreds.username || !this.authCreds.password) {
				return this.setToast("Please enter valid details");
			}
			axios.post("/api/login", this.authCreds).then(this.authenticate);
		},
		forgotPassword() {
			if (!this.authCreds.username) {
				return this.setToast("Please enter your username");
			}
			axios.post("/api/reset", { username: this.authCreds.username }).then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		authenticate(response) {
			this.setToast(response.data.message, "success");
			redirect(this.urlState ?? "/", true);
		},
		resendVerification() {
			axios.post("/api/resend").then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		updateAccount() {
			axios.put("/api/account", { ...this.myAccount }).then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		updateFeeds() {
			axios.put("/api/feeds", { feeds: this.feedUrls }).then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		deleteAccount() {
			if (confirm("Are you sure you want to delete your account?")) {
				axios.delete("/api/account").then((response) => {
					this.setToast(response.data.message, "success");
					redirect("/logout");
				});
			}
		},
		createPost() {
			if (!this.post.text.trim()) return this.setToast("Text cannot be empty");
			const text = this.post.text.trim();
			axios.post("/api/posts", { text }).then((response) => {
				this.post.text = "";
				this.setToast(response.data.message, "success");
				redirect("/");
			});
		},
		updatePost(id) {
			if (!this.post.text.trim()) return this.setToast("Text cannot be empty");
			const text = this.post.text.trim();
			axios.put("/api/posts/" + id, { text }).then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		deletePost(id) {
			if (confirm("Are you sure you want to delete this post? There is no undo")) {
				axios.delete(`/api/posts/${id}`).then((response) => {
					this.setToast(response.data.message, "success");
					redirect("/");
				});
			}
		},
		getFeedItems() {
			this.isLoading = true;
			const params = {};
			if (this.feedItems.length > 0) params["skip"] = this.feedItems.length;

			axios
				.get("/api/feed", { params })
				.then((response) => {
					this.feedItems.push(...response.data.items);
					this.showLoadMore = response.data.items.length === 50;
					if (response.data.errors.length > 0) {
						this.feedErrorHTML = `<summary>An error occurred while fetching some feeds.</summary><ul>${response.data.errors.map((e) => `<li>${e}</li>`).join("")}</ul>`;
					} else {
						this.feedErrorHTML = "";
					}
				})
				.finally(() => {
					this.isLoading = false;
				});
		},
		timeAgo(dateString) {
			const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
			let interval = seconds / 31536000;
			if (interval > 1) {
				const count = Math.floor(interval);
				return `${count} year${count === 1 ? "" : "s"} ago`;
			}
			interval = seconds / 2592000;
			if (interval > 1) {
				const count = Math.floor(interval);
				return `${count} month${count === 1 ? "" : "s"} ago`;
			}
			interval = seconds / 86400;
			if (interval > 1) {
				const count = Math.floor(interval);
				return `${count} day${count === 1 ? "" : "s"} ago`;
			}
			interval = seconds / 3600;
			if (interval > 1) {
				const count = Math.floor(interval);
				return `${count} hour${count === 1 ? "" : "s"} ago`;
			}
			interval = seconds / 60;
			if (interval > 1) {
				const count = Math.floor(interval);
				return `${count} minute${count === 1 ? "" : "s"} ago`;
			}
			return "now";
		},
	},
}).mount("#app");

(() => {
	const csrfToken = document.cookie
		.split("; ")
		.find((c) => c.startsWith("csrf_cookie="))
		?.split("=")[1];
	if (csrfToken) axios.defaults.headers.common["x-csrf-token"] = csrfToken;

	axios.interceptors.response.use(
		(response) => response,
		(error) => {
			console.log(error);
			App.setToast(error.response.data.message || "Something went wrong. Please try again");
			throw error;
		}
	);
})();
