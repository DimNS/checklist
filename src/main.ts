import { App } from "./app";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("#app not found");
}

new App(root, localStorage);
