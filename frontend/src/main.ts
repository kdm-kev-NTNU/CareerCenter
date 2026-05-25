import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import { useAppStore } from "./stores/app.js";
import "./styles.css";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

function reportUnexpectedError(reason: unknown) {
  const message =
    reason instanceof Error ? reason.message : "En uventet feil oppstod. Prøv å laste siden på nytt.";
  useAppStore(pinia).setError(message);
}

app.config.errorHandler = (error) => {
  reportUnexpectedError(error);
};

window.addEventListener("unhandledrejection", (event) => {
  reportUnexpectedError(event.reason);
});

app.mount("#app");
