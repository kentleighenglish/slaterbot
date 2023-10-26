import { Server } from "socket.io";
import { createResolver, defineNuxtModule, addServerHandler } from "nuxt/kit";
import Engine from "../engine";

export default defineNuxtModule((options, nuxt) => {
	nuxt.hook("listen", server => {
		const io = new Server(server, {
			path: options?.socketPath,
		});
		const engine = new Engine(io);

		nuxt.hook("close", () => io.close())

		io.on("connection", (socket) => {
			console.log("CONNECTION");

			socket.emit("update", engine.output);
		});

		engine.subscribe((data: any) => {
			io.emit("update", data);
		});
	})
})