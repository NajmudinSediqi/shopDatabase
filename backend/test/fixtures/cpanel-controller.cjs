const { spawn } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "../../..");
const { startLauncher, spawnManagedService } = require(
  path.join(root, "deploy/cpanel/launcher.cjs"),
);
const { spawnWorkerService } = require(path.join(root, "deploy/cpanel/worker-service.cjs"));
const app = startLauncher({
  root,
  port: 0,
  graceMs: 500,
  killMs: 1000,
  startupMs: 20000,
  spawnService(name, entry, env) {
    if (name === "frontend" && process.env.TEST_THROW_SECOND === "1")
      throw Error("Injected second startup failure");
    const child =
      process.env.TEST_MODE === "workers"
        ? spawnWorkerService(name, entry, env)
        : process.env.TEST_MODE === "managed"
          ? spawnManagedService(
              name,
              process.env.TEST_FIXTURE ? path.join(__dirname, "cpanel-service.cjs") : entry,
              { ...env, TEST_SERVICE: name },
              root,
            )
          : spawn(
              process.execPath,
              [process.env.TEST_FIXTURE ? path.join(__dirname, "cpanel-service.cjs") : entry],
              {
                cwd: root,
                env: { ...env, TEST_SERVICE: name },
                stdio: "ignore",
                shell: false,
                detached: false,
              },
            );
    process.send({ type: "service", name, pid: child.pid, port: Number(env.PORT) });
    return child;
  },
});
app.ready.then((value) => {
  if (value) process.send({ type: "ready", port: value.server.address().port });
});
process.on("message", (message) => {
  if (message === "stop") void app.shutdown();
  if (message === "disconnect-services") for (const { child } of app.children) child.disconnect?.();
});
