Vue.component("dataSection", {
    props: {
        title: {
            type: String,
            default: null
        },
        data: {
            type: Object,
            default: () => ([])
        }
    },
    render(h) {
        return h("div", {}, [
            h("h3", this.title)
        ]);
    }
});

const app = new Vue({
    el: "#root",
    data: () => ({
        engineData: {}
    }),
    mounted() {
        const socket = io({
            path: "/socket"
        });

        socket.on("update", (data) => {
            this.engineData = { ...data };
        });
    },
    render (h) {
        // console.log(this.engineData);
        return h('div', [
            h("h1", "Slaterbot"),
            h("dataSection", {
                props: {
                    title: "Positions"
                }
            }),
            h("div", {}, JSON.stringify(this.engineData))
        ]);
    }
});