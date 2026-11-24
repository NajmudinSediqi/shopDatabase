import assert from "node:assert/strict";
import { fork } from "node:child_process";
import net from "node:net";
import { readFile } from "node:fs/promises";
const controller = new URL("../fixtures/cpanel-controller.cjs", import.meta.url);
export async function start(env) {
  const child = fork(controller, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const services = [];
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Controller readiness timeout")), 25000);
    child.on("message", (message) => {
      if (message.type === "service") services.push(message);
      if (message.type === "ready") {
        clearTimeout(timer);
        resolve(message.port);
      }
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(Error("Controller exited before readiness"));
    });
  });
  try {
    return { child, services, port: await ready };
  } catch (error) {
    child.kill("SIGKILL");
    for (const s of services)
      if (s.pid)
        try {
          process.kill(s.pid, "SIGKILL");
        } catch {}
    throw error;
  }
}
export const listening = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

export async function gone(pid) {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === "ESRCH") return true;
    throw error;
  }
  if (process.platform === "linux") {
    // An exited orphan can briefly remain a zombie until init/subreaper reaps it.
    try {
      return /\) Z /.test(await readFile(`/proc/${pid}/stat`, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return true;
      throw error;
    }
  }
  return false;
}
export async function waitGone(services, since = Date.now()) {
  const deadline = since + 5000;
  while (Date.now() < deadline) {
    if ((await Promise.all(services.map((s) => gone(s.pid)))).every(Boolean)) {
      if ((await Promise.all(services.map((s) => listening(s.port)))).every((open) => !open))
        return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("A recorded service PID is still running after parent loss");
}
