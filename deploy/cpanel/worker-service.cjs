const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { EventEmitter } = require("node:events");
function spawnWorkerService(name, entry, env) {
  const service = new EventEmitter();
  const worker = new Worker(path.join(__dirname, "service-worker.cjs"), {
    env,
    workerData: { name, entry },
  });
  worker.on("error", (error) => service.emit("error", error));
  worker.on("exit", (code) => {
    service.emit("exit", code);
    service.emit("close", code);
  });
  service.kill = (signal) => {
    if (signal === "SIGKILL") void worker.terminate();
    else worker.postMessage("shutdown");
  };
  return service;
}
module.exports = { spawnWorkerService };
