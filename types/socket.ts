import { Socket } from "socket.io-client";

export const socketEvents = {
    update: "update" as "update",
};

export interface SocketClientEvents {
  [socketEvents.update]: (
    set: any,
    callback?: () => void
  ) => void;
}

export interface SocketServerEvents {
  [socketEvents.update]: (data: any) => void;
}

export type SocketClientInstance = Socket<
  SocketServerEvents,
  SocketClientEvents
>;

declare module "nuxt/types" {
  interface Context {
    $socket: () => SocketClientInstance;
  }
  interface NuxtAppOptions {
    $socket: () => SocketClientInstance;
  }
}

// declare module "vue/types/vue" {
//   interface Vue {
//     $socket: () => SocketClientInstance;
//   }
// }