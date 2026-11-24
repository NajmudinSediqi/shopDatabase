# Isolated Linux process verification

The manual GitHub Actions workflow is `.github/workflows/process-lifecycle.yml`.
It uses Ubuntu 24.04 and Node.js 24, with a read-only repository token and no
production secrets, database, package installation, build or deployment step.
All HTTP requests are to local fixture servers using OS-selected ports.

After the workflow is pushed to the default branch, open **Actions → Isolated
Linux process lifecycle → Run workflow → main**. It does not run automatically
on pushes or pull requests. GitHub requires manual workflows to exist on the
default branch: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow.

The job runs:

```sh
node --test --test-concurrency=1 --test-timeout=60000 --test-reporter=tap \
  backend/test/cpanel-launcher.test.mjs \
  backend/test/cpanel-parent-loss.test.mjs
```

The managed-parent SIGKILL case verifies both named child PIDs and their closed
service ports within 5 seconds **from sending SIGKILL**, across five cycles. It
also checks that previously observed child PIDs are no longer running. Each cycle
records launcher/backend/frontend PIDs and elapsed time in the TAP log. On Linux,
an exited zombie awaiting init reaping counts as exited, since it has no running
service or worker threads. The separate unguarded baseline intentionally confirms
that children survive without the bootstrap, then terminates only its test PIDs.
Linux SIGTERM and SIGHUP checks must run rather than be skipped.

The job summary records the actual test-step outcome. A seven-day TAP artifact
is uploaded even when a test fails; `pipefail` ensures log collection cannot hide
a failing test exit code. A five-minute job deadline bounds the whole job.

A passing result confirms the isolated IPC parent-loss mechanism on the logged
Linux/Node version. It does not verify Namecheap's modified lsnode, production
load, account resource limits, or frozen/blocked child event loops. No production
server is involved. Record the run URL and commit SHA when reporting a result;
until a run completes, Linux verification remains pending.

## Verified run ? 2026-11-24

- Repository: https://github.com/NajmudinSediqi/shopDatabase
- Run: https://github.com/NajmudinSediqi/shopDatabase/actions/runs/45349455731
- Tested commit: `d23dc3ef32663dfc8e79794493876c360a98c8cb`
- Runner: Ubuntu 24.04; actual Node.js version: **24.22.3**.
- Actual result: **12 passed, 0 failed, 0 skipped**.
- Both managed children exited and both ports closed after launcher SIGKILL in
  **32, 31, 28, 28 and 28 milliseconds** over the five cycles (5000ms limit).
- Linux real SIGTERM/SIGHUP and the unguarded-survival baseline also passed.
- The run uploaded its TAP log. No production credentials or server were used.

This replaces the earlier pending Linux status. Native SIGABRT and behavior
inside Namecheap's modified lsnode were not directly tested by this run.
