import { defineNuxtPlugin, useRuntimeConfig } from "nuxt/app";
import { SocketClientInstance } from "@/types/socket";
import io from "socket.io-client";

export default defineNuxtPlugin(nuxtApp => {
    const { public: { socketPath } } = useRuntimeConfig();
  
    const socket: SocketClientInstance = io(window.location.host, {
      autoConnect: false,
      path: socketPath as string,
    });
  
    return {
        provide: {
            socket: socket,
        },
    }
  })