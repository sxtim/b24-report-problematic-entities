import { createApp } from "vue"
import App from "./App.vue"
import { initBX24 } from "./utils/bx24.js"

// Vuetify
import "@mdi/font/css/materialdesignicons.css"
import { createVuetify } from "vuetify"
import { ru } from "vuetify/locale"
import "vuetify/styles"

const vuetify = createVuetify({
	locale: {
		locale: "ru",
		messages: { ru },
	},
})

initBX24().then(bx24 => {
	const placementInfo = bx24.placement.info()
	const app = createApp(App, {
		placementInfo: placementInfo,
	})
	app.provide("BX24", bx24)
	app.use(vuetify)
	app.mount("#app")
})
