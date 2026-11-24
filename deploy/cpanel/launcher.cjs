const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

function spawnManagedService(name, entry, env, root) {
  return spawn(process.execPath, [path.join(__dirname, "managed-service.cjs"), entry], {
    cwd: root,
    env,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    shell: false,
    detached: false,
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
function waitForPort(port, signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    let socket,
      retry,
      settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(retry);
      signal.removeEventListener("abort", aborted);
      socket?.destroy();
      error ? reject(error) : resolve();
    };
    const aborted = () => finish(Error("STARTUP_ABORTED"));
    const deadline = setTimeout(() => finish(Error("STARTUP_TIMEOUT")), timeoutMs);
    const attempt = () => {
      if (signal.aborted) return aborted();
      socket = net.connect({ host: "127.0.0.1", port });
      socket.once("connect", () => finish());
      socket.once("error", () => {
        socket.destroy();
        if (!settled) retry = setTimeout(attempt, 50);
      });
    };
    signal.addEventListener("abort", aborted, { once: true });
    attempt();
  });
}
async function within(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function startLauncher({
  root,
  env = process.env,
  spawnService,
  port = env.PORT || 3000,
  graceMs = 5000,
  killMs = 2000,
  startupMs = 30000,
  exit = (code) => process.exit(code),
  log = console,
} = {}) {
  const children = [];
  const sockets = new Set();
  const abort = new AbortController();
  let server,
    stopping,
    exitCode = 0;
  const handlers = new Map();
  function stop(record, signal) {
    try {
      record.child.kill(signal);
    } catch (error) {
      log.error(`Launcher: ${record.name} stop failed (${error.code || "STOP_ERROR"})`);
    }
  }
  function shutdown(code = 0) {
    exitCode = Math.max(exitCode, code);
    if (stopping) return stopping;
    // Schedule work only after the shared promise exists (exit events can reenter).
    stopping = Promise.resolve().then(async () => {
      abort.abort();
      if (server?.listening) server.close();
      for (const record of children) if (!record.closed) stop(record, "SIGTERM");
      const allClosed = Promise.all(children.map((record) => record.done));
      if (!(await within(allClosed, graceMs))) {
        log.error("Launcher: shutdown deadline; force-stopping remaining services");
        for (const record of children) if (!record.closed) stop(record, "SIGKILL");
        if (!(await within(allClosed, killMs))) {
          exitCode = 1;
          log.error("Launcher: service did not confirm exit before final deadline");
        }
      }
      for (const socket of sockets) socket.destroy();
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
      process.removeListener("uncaughtException", fatal);
      process.removeListener("unhandledRejection", fatal);
      exit(exitCode);
    });
    return stopping;
  }
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    const handler = () => {
      void shutdown(0);
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  // Fail closed; avoid logging exception text that could contain credentials.
  const fatal = () => {
    log.error("Launcher: fatal error; stopping services");
    void shutdown(1);
  };
  process.on("uncaughtException", fatal);
  process.on("unhandledRejection", fatal);
  function launch(name, entry, childEnv) {
    if (stopping) throw Error("STARTUP_ABORTED");
    const child = spawnService
      ? spawnService(name, entry, childEnv)
      : spawnManagedService(name, entry, childEnv, root);
    let resolve;
    const record = {
      name,
      child,
      closed: false,
      done: new Promise((done) => {
        resolve = done;
      }),
    };
    children.push(record);
    child.once("close", () => {
      record.closed = true;
      resolve();
    });
    child.once("error", (error) => {
      // Codes only: error messages/arguments can contain deployment credentials.
      log.error(`Launcher: ${name} failed (${error.code || "SERVICE_ERROR"})`);
      void shutdown(1);
    });
    child.once("exit", (code, signal) => {
      if (!stopping) {
        log.error(`Launcher: ${name} exited (${signal || code})`);
        void shutdown(1);
      }
    });
    return child;
  }
  const ready = (async () => {
    try {
      const apiPort = await freePort();
      let webPort = await freePort();
      while (webPort === apiPort) webPort = await freePort();
      launch("backend", path.join(root, "backend/src/server.mjs"), {
        ...env,
        PORT: String(apiPort),
        HOST: "127.0.0.1",
      });
      launch("frontend", path.join(root, ".output/server/index.mjs"), {
        ...env,
        BACKEND_URL: `http://127.0.0.1:${apiPort}`,
        PORT: String(webPort),
        NITRO_PORT: String(webPort),
        HOST: "127.0.0.1",
        NITRO_HOST: "127.0.0.1",
      });
      await Promise.all([
        waitForPort(apiPort, abort.signal, startupMs),
        waitForPort(webPort, abort.signal, startupMs),
      ]);
      if (stopping) return;
      server = http.createServer((req, res) => {
        const target =
          req.url === "/api" || req.url.startsWith("/api/") || req.url.startsWith("/api?")
            ? apiPort
            : webPort;
        const upstream = http.request(
          {
            hostname: "127.0.0.1",
            port: target,
            method: req.method,
            path: req.url,
            headers: req.headers,
          },
          (response) => {
            res.writeHead(response.statusCode, response.headers);
            response.pipe(res);
          },
        );
        upstream.on("error", () => {
          if (!res.headersSent) res.writeHead(503, { "Content-Type": "text/plain" });
          res.end("Service unavailable");
        });
        res.on("close", () => upstream.destroy());
        req.pipe(upstream);
      });
      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });
      server.on("error", (error) => {
        log.error(`Launcher: listener failed (${error.code || "LISTEN_ERROR"})`);
        void shutdown(1);
      });
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      return { server, apiPort, webPort };
    } catch (error) {
      if (!stopping) log.error(`Launcher: startup failed (${error.code || "STARTUP_ERROR"})`);
      if (stopping) await stopping;
      else await shutdown(1);
    }
  })();
  return { ready, shutdown, children };
}
module.exports = { startLauncher, spawnManagedService };
