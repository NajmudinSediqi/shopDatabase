# cPanel deployment

The archive is a built application, not a database backup. It requires a cPanel host that supports Node.js 22.12 or later, persistent Node processes, child processes, loopback connections, and MySQL 8.0.16+ or MariaDB 10.4+. Confirm these features with your host. Passenger must run the application outside public_html; only the domain's Passenger entry should be public. Never expose this folder, `.env`, backend files, or node_modules as static files.

1. Create a MySQL database and a dedicated database user in cPanel and grant that user privileges on that database. Note the actual cPanel-prefixed database and user names.
2. Upload and extract the archive into a private application directory. In Setup Node.js App select Node 22.12+, production mode, that directory as the application root, `app.cjs` as the startup file, and the HTTPS domain `noordb.com` as the application URL. Enable a valid SSL certificate.
3. Copy `.env.example` to `.env` in the application root and set `DATABASE_URL` and `APP_ORIGIN=https://noordb.com`. URL-encode special characters in the database username and password. Configure SMTP if inviting staff; AI is optional. Keep `ALLOW_SIGNUP=false`.
4. In the cPanel terminal, activate the application's Node environment if cPanel provides one, enter the application root, run `npm install --omit=dev`, then run `npm run migrate`. The database user needs permissions for the migration's tables, views, indexes and triggers. Some MariaDB versions require triggers to enforce payment constraints. Do not import SQL files manually in place of this migration runner.
5. Start or restart the application in cPanel. Open `https://noordb.com/api/health`, then register the first owner immediately over HTTPS. On a fresh database the first signup becomes the administrator even when later signup is disabled. Never leave an uninitialized public installation accessible to others.
6. Check login, inventory, sales and purchases, SMTP invitations, and backups on the actual host. Establish and test database backups before entering real data. Existing data is not included and must be migrated and reconciled separately.

The application uses two loopback-only child services behind the Passenger entry. The operating system chooses their ports. Reverse proxy authentication limits are process-local and all requests may appear to come from the proxy; ask your hosting provider to configure per-client rate limiting at the edge. The www hostname must redirect to the configured origin before requests reach the app, or its POST requests will be rejected. Do not run migrations automatically on startup.

## Process lifecycle fix (2026-11-24)

Confirmed owner settings: Application root `noordb.com`, Application URL `noordb.com`, Application startup file `app.cjs`, Node.js 24. The source template is `deploy/cpanel/app.cjs`; it must be copied into the application root, alongside `launcher.cjs` and `managed-service.cjs`. Files in `output/cpanel-candidate` and existing deployment ZIPs are stale generated artifacts and do not contain this fix. `.output/server/index.mjs` is generated frontend output, not the startup setting to use for the combined app.

The original entry spawned `backend/src/server.mjs` and `.output/server/index.mjs` directly with Node. No shell wrapper, detached launch or internal restart/retry loop was found. It killed children and immediately exited without waiting. Startup exceptions and proxy-listener errors could bypass child cleanup. These are source-level leak paths; without production supervisor logs, the precise cause of the reported 24-hour accumulation is unconfirmed.

`launcher.cjs` now tracks each service immediately, installs handlers before launching, waits for both loopback listeners (30-second startup deadline), and stops both services on startup failure, unexpected service exit, fatal launcher error, SIGINT, SIGTERM or SIGHUP. Shutdown stops accepting requests, sends SIGTERM, waits up to 5 seconds, sends SIGKILL to remaining children, waits at most 2 more seconds, closes proxy sockets and exits. It never automatically restarts a child: cPanel owns restart policy. A failure to confirm termination is logged and returns failure. Existing public PORT behavior, `/api` routing, loopback ports and per-service environment overrides remain unchanged. No schema, dependency or generated frontend changes are required.

### Deploy and rollback

1. Save a private backup of the currently deployed `app.cjs` outside the public web directory. If `launcher.cjs` and `managed-service.cjs` already exist, back them up too.
2. Upload these source files into the existing `noordb.com` application root:
   - `deploy/cpanel/app.cjs` → `app.cjs`
   - `deploy/cpanel/launcher.cjs` → `launcher.cjs`
3. Keep startup file **`app.cjs`**, application root **`noordb.com`**, production mode and Node.js **24**. Keep existing environment values. Restart through cPanel once. No rebuild, dependency install or migration is needed for this patch.
4. Check `/`, `/auth`, `/api/health` and an authenticated page. Repeat stop/start in staging and check the exact recorded service PIDs disappear after each stop. Leave staging running through the host's recycling interval before declaring the production recurrence resolved.
5. Rollback: restore the saved `app.cjs` (and previous `launcher.cjs`, if any), keep startup `app.cjs`, and restart through cPanel. This restores the old behavior, including its lifecycle limitations.

### Abrupt termination and optional single-process mode

SIGKILL and a native SIGABRT cannot run launcher cleanup. The earlier bounded-shutdown patch alone was insufficient for this failure mode. The default launcher now starts each service through `managed-service.cjs` with a private Node IPC channel. Before importing the service, the bootstrap registers a disconnect handler and refuses to start without a connected parent. When the launcher disappears, the child observes IPC EOF and exits immediately, without waiting for database or HTTP graceful shutdown. Backend direct-entry detection is preserved by restoring its original argv. Public routes, PORT, HOST, BACKEND_URL and NITRO overrides are unchanged. No shell, new process supervisor, dependency, periodic poll or additional worker threads are introduced.

This is a cooperative child-side parent-loss solution: the child's event loop must be able to observe IPC disconnect. It cannot kill a SIGSTOP-frozen child or execute while a child is permanently blocked in native code. For a kernel-enforced guarantee in those cases, Namecheap must supervise/kill the whole process tree or provide parent-death signaling; a shared account cannot configure the host's cgroup/systemd policy. Otherwise use the optional one-process worker entry after staging validation, or move to hosting with a service/container supervisor that enforces process-group lifetime. Do not claim this fixes an independent per-instance thread exhaustion problem or proves what caused the initial abort.

The configured startup file was confirmed by the owner as `app.cjs`; the repository template alone cannot prove the current live cPanel value. Confirm it remains `app.cjs`, with root `/home/toefuqtn/noordb.com` (cPanel may display relative `noordb.com`), Node 24 and production mode. No production server was accessed. Old ZIPs including the 2026-11-22 release lack the new IPC bootstrap and must not be treated as the updated fix.

An optional `app-workers.cjs` entry uses Node worker threads for both existing services within the lsnode OS process. It retains the same proxy, generated frontend, database backend and environment behavior. There are no backend/frontend child PIDs to orphan when that OS process dies. This addresses orphan lifetime, not the account's overall thread/memory limit: workers still consume threads and memory. It introduces shared-process failure/resource coupling.

For **staging first**, upload `app-workers.cjs`, `worker-service.cjs` and `service-worker.cjs` from this directory alongside the patched `app.cjs` and `launcher.cjs`. Set Application startup file to **`app-workers.cjs`**. This is structurally compatible with Setup Node.js App's configurable CommonJS startup file and was verified with this project's real backend and built Nitro frontend on Node 24.19.0 locally. Worker support, resource limits and behavior under Namecheap's patched lsnode have **not** been verified remotely. Validate login, authenticated API/SSR, graceful restart, forced parent termination and host recycling in a separate staging app before production use. Roll back this option by setting startup back to `app.cjs` and restarting. For stronger isolation with process-tree enforcement, a host-managed service/container supervisor is another option, but shared cPanel does not give this project that control.

References: [Node child process lifecycle](https://nodejs.org/download/release/v24.19.0/docs/api/child_process.html), [Node worker threads](https://nodejs.org/download/release/v24.19.0/docs/api/worker_threads.html), [Namecheap startup-file configuration](https://www.namecheap.com/support/knowledgebase/article.aspx/10047/2182/how-to-work-with-nodejs-app/).

### Verification and targeted staging checks

Run from the repository root in PowerShell:

```powershell
$env:RUN_CPANEL_SMOKE='1'
node --test --test-concurrency=1 backend/test/cpanel-launcher.test.mjs backend/test/cpanel-parent-loss.test.mjs backend/test/cpanel-smoke.test.mjs
Remove-Item Env:RUN_CPANEL_SMOKE
```

The smoke test requires a local MySQL administrator (`MYSQL_ADMIN_URL`, default local root without password), creates a randomly named disposable database, applies the existing migrations there, and drops it afterward. It does not read the project's `.env` or access production. Never point its administrator URL at production. Without `RUN_CPANEL_SMOKE=1`, the real-database smoke case is skipped; fixture lifecycle tests still run.

Verified locally on Windows/Node 24.19.0: five start/stop cycles with exact child-PID checks; real website `/auth` and `/api/health` through the proxy in child and worker modes; synchronous second-spawn failure; readiness timeout; public-port bind failure; unexpected frontend death; shutdown during startup; synthetic SIGINT/SIGTERM/SIGHUP dispatch; mocked unresponsive children requiring TERM→KILL escalation; graceful actual worker shutdown; abrupt worker-parent kill releasing both internal service ports. An abrupt child-parent kill probe showed environment-dependent Windows process/job behavior, including a surviving service; the test explicitly cleans up only its recorded child PIDs. Real Linux signals, PPID-1 behavior and Namecheap recycling remain unverified; Windows signal dispatch and mocked escalation are not substitutes for those checks.

On staging, record the specific launcher/backend/frontend PIDs belonging to the application before each restart. Inspect only those PIDs:

```sh
ps -p <launcher-pid>,<backend-pid>,<frontend-pid> -o pid,ppid,nlwp,etime,comm
```

Confirm their executable paths and working directories match the staging application before any manual termination; do not dump environment variables or full command lines containing credentials. In worker mode there should be no separate backend/frontend process PIDs. Ask the host to inspect the application's process tree over 24 hours. Avoid `killall node`, broad `pkill`, or deleting account-wide processes. This investigation made no production requests or changes.

## Linux verification still required

A manual Ubuntu/Node 24 GitHub workflow is now prepared at `.github/workflows/process-lifecycle.yml`; see `docs/process-lifecycle-ci.md`. It runs the isolated fixtures without production credentials or a database and saves the actual TAP result. Preparing the workflow does not itself constitute a passing Linux test.

This workspace is Windows, has no installed WSL distribution and no Docker runtime. Linux SIGKILL, SIGABRT and real signal behavior have not been executed here. The fixture tests are portable and use only isolated child PIDs, OS-chosen ports and no database. On a separate Linux Node 24 checkout, no npm installation is needed for the following isolated tests:

```sh
node --test --test-concurrency=1 backend/test/cpanel-launcher.test.mjs backend/test/cpanel-parent-loss.test.mjs
```

The unguarded baseline should retain both children after parent SIGKILL; the managed tests must terminate both and close both ports across five abrupt cycles. Linux-only tests exercise real SIGTERM/SIGHUP. Exited zombies awaiting init/subreaper reaping are distinguished from running processes in `/proc`; they no longer serve ports or hold worker threads. The tests clean up only recorded test PIDs. For actual application smoke tests, use a disposable local/staging MySQL administrator and `RUN_CPANEL_SMOKE=1`; never use production database credentials. Linux tests are a release gate, not a completed result.

Windows validation on 2026-11-24 additionally exercised IPC disconnect while the parent was alive, five abrupt managed-parent kills, actual built `/auth` and `/api/health` with a disposable local database, and actual managed-parent kill followed by service-PID/port checks. Linux remains pending by owner agreement. The local database was isolated on loopback port 33360; production credentials and data were not used.
