const socketPath = "/socket";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ["@/assets/css/sakura.css"],
  modules: [
    ["@/modules/socket", { socketPath }]
  ],
  runtimeConfig: {
    public: {
      socketPath,
    },
  },
})
