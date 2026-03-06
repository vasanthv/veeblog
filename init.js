const express = require("express");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const pkg = require("./package.json");

const config = require("./config");
const apiRoutes = require("./server/routes/api");
const viewRoutes = require("./server/routes/view");
const profileRoutes = require("./server/routes/profile");
const {
	sessionMiddleWare,
	csrfMiddleware,
	attachUsertoRequest,
	attachUserDomainToRequest,
} = require("./server/middlewares");

const app = express();

app.set("view engine", "ejs");
app.locals.appVersion = pkg.version;

// Serve vue.js, page.js & axios to the browser
app.use(express.static(path.join(__dirname, "node_modules/axios/dist/")));
app.use(express.static(path.join(__dirname, "node_modules/vue/dist/")));

// Serve frontend assets & images to the browser
app.use(express.static(path.join(__dirname, "assets")));
app.use(express.static(path.join(__dirname, "assets/icons")));

// HTTP access logs
app.use(morgan("dev")); // for dev logging

app.use(attachUserDomainToRequest);
app.use((req, res, next) => {
	if (req.userDomain) return profileRoutes(req, res, next);
	return next();
});

// Attach cookie middleware
app.use(cookieParser());

// Attach the session middleware
app.use(sessionMiddleWare);
app.use(attachUsertoRequest);

// Custom CSRF middleware
app.use(csrfMiddleware);

// Handle API requests
app.use("/api", apiRoutes);

app.use("/", viewRoutes);

// Start the server
app.listen(config.PORT, null, function () {
	console.log("Node version", process.version);
	console.log("Veeblog server running on port", config.PORT);
});
