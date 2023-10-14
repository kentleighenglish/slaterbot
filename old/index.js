import http from "http";
import express from "express";
import { resolve } from "path";
import debugFunc from "debug";
import { Server } from "socket.io";

import Engine from "./engine/index.js";

const log = debugFunc("bot:main");

const app = express();
const server = http.createServer(app);
const engine = new Engine();

const io = new Server(server, {
	path: "/socket"
});

engine.subscribe((data) => {
	io.emit("update", data);
})

io.on("connection", (socket) => {
	log(`connection: ${socket.id}`);

	// @todo: Handle socket connection
	console.log(engine.output);
	socket.emit("update", engine.output);
});

// normal routes
app.use(express.static("public"));

app.get("*", async (request, response) => {
	response.send()
})

server.listen(process.env.PORT || 3000, () => {
	log(`Server running on ${process.env.PORT}`)
});