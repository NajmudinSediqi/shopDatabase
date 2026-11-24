const { parentPort, workerData } = require("node:worker_threads");
const { pathToFileURL } = require("node:url");
parentPort.on("message", (message) => {
  if (message !== "shutdown") return;
  if (process.listenerCount("SIGTERM")) process.emit("SIGTERM");
  else process.exit(0);
});
(async () => {
  const service = await import(pathToFileURL(workerData.entry).href);
  if (workerData.name === "backend") await service.startServer();
})().catch(() => {
  console.error("Service worker: startup failed");
  process.exit(1);
});
