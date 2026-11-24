import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { testDatabase } from "./database.mjs";
import { migrate } from "../src/migrate.mjs";
import { start, gone, waitGone, listening } from "./helpers/cpanel-processes.mjs";
test(
  "actual built website and API, children and worker modes; worker parent kill releases both service ports",
  { skip: process.env.RUN_CPANEL_SMOKE !== "1", timeout: 120000 },
  async () => {
    const db = await testDatabase({ triggers: true });
    try {
      await migrate(db.sql);
      const [row] = await db.sql.unsafe("SELECT DATABASE() AS name");
      const url = new URL(process.env.MYSQL_ADMIN_URL ?? "mysql://root@127.0.0.1:3306/");
      url.pathname = "/" + row.name;
      for (const mode of ["managed", "managed-kill", "workers-stop", "workers-kill"]) {
        const { child, services, port } = await start({
          TEST_MODE: mode.startsWith("workers") ? "workers" : "managed",
          TEST_FIXTURE: "",
          DATABASE_URL: url.href,
          APP_ORIGIN: "https://noordb.test",
          NODE_ENV: "production",
        });
        try {
          const response = await fetch(`http://127.0.0.1:${port}/api/health`);
          assert.equal(response.status, 200);
          assert.equal((await response.json()).data.status, "ok");
          const page = await fetch(`http://127.0.0.1:${port}/auth`);
          assert.equal(page.status, 200);
          assert.match(await page.text(), /<html/i);
          const closed = once(child, "exit");
          if (mode.endsWith("-kill")) child.kill("SIGKILL");
          else child.send("stop");
          await closed;
          if (mode === "managed-kill") await waitGone(services);
          for (const s of services) {
            assert.equal(await listening(s.port), false);
            if (s.pid) assert.equal(await gone(s.pid), true);
          }
        } finally {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
          for (const s of services)
            if (s.pid)
              try {
                process.kill(s.pid, "SIGKILL");
              } catch {}
        }
      }
    } finally {
      await db.close();
    }
  },
);
