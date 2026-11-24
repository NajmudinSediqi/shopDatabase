import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { start, gone, waitGone, listening } from "./helpers/cpanel-processes.mjs";
test("managed services exit after IPC loss, independent of parent signal cleanup", async () => {
  const { child, services } = await start({ TEST_FIXTURE: "1", TEST_MODE: "managed" });
  const closed = once(child, "exit");
  try {
    child.send("disconnect-services");
    await closed;
    await waitGone(services);
  } finally {
    child.kill("SIGKILL");
    for (const s of services)
      try {
        process.kill(s.pid, "SIGKILL");
      } catch {}
  }
});

test("five abrupt parent-kill cycles leave no running managed service PIDs or open ports", async (t) => {
  const all = [];
  try {
    for (let i = 0; i < 5; i++) {
      const { child, services, port } = await start({ TEST_FIXTURE: "1", TEST_MODE: "managed" });
      assert.equal(services.length, 2);
      all.push(...services);
      try {
        for (const route of ["/", "/api/health"])
          assert.equal(
            (await fetch(`http://127.0.0.1:${port}${route}`, { headers: { Connection: "close" } }))
              .status,
            200,
          );
        const closed = once(child, "exit");
        const killedAt = Date.now();
        assert.equal(child.kill("SIGKILL"), true);
        await closed;
        await waitGone(services, killedAt);
        t.diagnostic(
          `Cycle ${i + 1}: SIGKILL launcher PID ${child.pid}; ${services.map((s) => `${s.name} PID ${s.pid}`).join(", ")} exited and both ports closed within ${Date.now() - killedAt}ms (limit 5000ms)`,
        );
        for (const previous of all) assert.equal(await gone(previous.pid), true);
      } finally {
        child.kill("SIGKILL");
      }
    }
  } finally {
    for (const s of all)
      try {
        process.kill(s.pid, "SIGKILL");
      } catch {}
  }
});

test(
  "Linux real SIGTERM and SIGHUP stop managed children",
  { skip: process.platform !== "linux" },
  async () => {
    for (const signal of ["SIGTERM", "SIGHUP"]) {
      const { child, services } = await start({ TEST_FIXTURE: "1", TEST_MODE: "managed" });
      try {
        const closed = once(child, "exit");
        child.kill(signal);
        await closed;
        await waitGone(services);
      } finally {
        child.kill("SIGKILL");
        for (const s of services)
          try {
            process.kill(s.pid, "SIGKILL");
          } catch {}
      }
    }
  },
);
test("abrupt parent kill probe; POSIX expects surviving children, Windows job behavior is reported", async (t) => {
  const { child, services } = await start({ TEST_FIXTURE: "1", TEST_MODE: "children" });
  try {
    const closed = once(child, "exit");
    child.kill("SIGKILL");
    await closed;
    for (const s of services) {
      const alive = await listening(s.port);
      if (process.platform === "win32")
        t.diagnostic(`Windows abrupt kill: service port alive=${alive}; not a POSIX orphan test`);
      else {
        process.kill(s.pid, 0);
        assert.equal(alive, true);
      }
    }
  } finally {
    for (const s of services)
      try {
        process.kill(s.pid, "SIGKILL");
      } catch {}
  }
});
