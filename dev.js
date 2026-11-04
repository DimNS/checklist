import index from "./index.html";

const server = Bun.serve({
  routes: {
    "/": index,
  },
  development: true,
});

console.log(`http://${server.hostname}:${server.port}`);
