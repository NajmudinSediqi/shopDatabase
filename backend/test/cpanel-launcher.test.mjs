import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { once, EventEmitter } from "node:events";
import net from "node:net";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { startLauncher, spawnManagedService } = require("../../deploy/cpanel/launcher.cjs");
const fixture = fileURLToPath(new URL("./fixtures/cpanel-service.cjs", import.meta.url));
const root = fileURLToPath(new URL("../../", import.meta.url));
const quiet = { error() {} };
const dead = (pid) => {
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
};
function launch(overrides = {}) {
  let code;
  const app = startLauncher({
    root,
    port: 0,
    graceMs: 1000,
    killMs: 2000,
    startupMs: 30000,
    log: quiet,
    exit: (value) => {
      code = value;
    },
    spawnService(name, entry, env) {
      return spawnManagedService(name, fixture, { ...env, TEST_SERVICE: name }, root);
    },
    ...overrides,
  });
  return { app, code: () => code };
}
test("public listener bind failure reaps both services", async () => {
  const occupied = net.createServer();
  occupied.listen(0);
  await once(occupied, "listening");
  try {
    const { app, code } = launch({ port: occupied.address().port });
    await app.ready;
    assert.equal(code(), 1);
    app.children.forEach(({ child }) => dead(child.pid));
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});
test("shutdown during startup cancels readiness without changing successful exit code", async () => {
  const { app, code } = launch({
    spawnService() {
      return spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
    },
  });
  while (!app.children.length) await new Promise((resolve) => setTimeout(resolve, 5));
  await app.shutdown();
  await app.ready;
  assert.equal(code(), 0);
  app.children.forEach(({ child }) => dead(child.pid));
});
test("five start/stop cycles route website/API and reap both exact child PIDs", async () => {
  for (let i = 0; i < 5; i++) {
    const { app, code } = launch();
    try {
      const { server } = await app.ready;
      const url = `http://127.0.0.1:${server.address().port}`;
      for (const [path, service] of [
        ["/", "frontend"],
        ["/api/health", "backend"],
        ["/api?x=1", "backend"],
      ]) {
        assert.equal((await (await fetch(url + path)).json()).service, service);
      }
    } finally {
      await app.shutdown();
    }
    assert.equal(code(), 0);
    app.children.forEach(({ child }) => dead(child.pid));
  }
});
test("synchronous second launch failure reaps first child", async () => {
  const { app, code } = launch({
    spawnService(name, entry, env) {
      if (name === "frontend") throw Error("injected");
      return spawnManagedService(name, fixture, env, root);
    },
  });
  await app.ready;
  assert.equal(code(), 1);
  app.children.forEach(({ child }) => dead(child.pid));
});
test("unexpected frontend exit reaps backend", async () => {
  const { app, code } = launch();
  await app.ready;
  const closed = once(app.children[0].child, "close");
  app.children[1].child.kill("SIGKILL");
  await closed;
  await app.shutdown(1);
  assert.equal(code(), 1);
  app.children.forEach(({ child }) => dead(child.pid));
});
test("readiness timeout reaps both children", async () => {
  const { app, code } = launch({
    startupMs: 100,
    spawnService() {
      return spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
    },
  });
  await app.ready;
  assert.equal(code(), 1);
  app.children.forEach(({ child }) => dead(child.pid));
});
test("bounded shutdown escalates TERM to KILL for an unresponsive service", async () => {
  const signals = [];
  const { app } = launch({
    graceMs: 20,
    startupMs: 30,
    spawnService() {
      const child = new EventEmitter();
      child.kill = (signal) => {
        signals.push(signal);
        if (signal === "SIGKILL")
          queueMicrotask(() => {
            child.emit("exit", 1);
            child.emit("close");
          });
      };
      return child;
    },
  });
  await app.ready;
  assert.deepEqual(signals, ["SIGTERM", "SIGTERM", "SIGKILL", "SIGKILL"]);
});
test("signal handlers request shutdown (synthetic dispatch on Windows)", async () => {
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    const { app, code } = launch();
    await app.ready;
    process.emit(signal);
    await app.shutdown();
    assert.equal(code(), 0);
    app.children.forEach(({ child }) => dead(child.pid));
  }
});
