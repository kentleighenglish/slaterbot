import { Server } from "socket.io";
import { createResolver, defineNuxtModule, addServerHandler } from "nuxt/kit";

export default defineNuxtModule((options, nuxt) => {
    nuxt.hook('listen', server => {
        const io = new Server(server, {
            path: options?.socketPath,
        });
    
        nuxt.hook('close', () => io.close())
        
        io.on('connection', () => {
            console.log("CONNECTION");
        })
    })

//   meta: {
//     name: "socket"
//   },
//   setup () {
//     const { resolve } = createResolver(import.meta.url)

//     // Add an API route
//     addServerHandler({
//       route: '/api/hello',
//       handler: resolve('./runtime/api-route')
//     })
//   }
})