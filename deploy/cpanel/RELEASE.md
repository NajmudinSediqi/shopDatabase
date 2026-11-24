# Deployment release — 2026-11-22

This release reduces repeated browser requests and includes bounded child-process cleanup.

- Page queries reuse fresh data for one minute; inactive cache stays in browser memory for 15 minutes. No default interval polling. Stale queries can refresh on navigation, focus or reconnect. Local mutations retain their existing invalidations.
- Session requests are shared between route guards and the user hook, with a five-minute freshness window. Session/role/profile checks run every five minutes while visible; backend permission checks remain authoritative for every API request. Permission changes from another device can take up to five minutes to appear in navigation.
- Assistant settings no longer poll every 15 seconds. Branding no longer polls every minute. These refresh when stale on mount/focus/reconnect or after local updates.
- Manual currency settings no longer poll. Automatic exchange rates still refresh every five minutes while visible. Only users with settings permission attempt to publish the live rate.
- Login/logout clears the browser query cache. Session request errors are reported as errors instead of being mistaken for a signed-out session.

The old access poll alone requested session, roles and profile every 15 seconds: about 720 requests/hour per active tab, excluding navigation and other polls. Its five-minute equivalent is about 36 requests/hour (95% fewer scheduled access requests). This is a code-based estimate, not a production CPU benchmark. Requests consume CPU/database resources, but do not by themselves create the orphaned Node process pairs reported earlier. Both fixes matter independently.

## Update existing production installation

1. Back up your current application files and database. Keep the existing private root `.env` and production `node_modules`.
2. Extract this archive into the existing private application root `noordb.com`. Ensure hidden `.output` is extracted. It contains no real `.env`, database dump, uploads or development dependencies. Do not copy `.env.example` over your existing `.env`.
3. This archive includes current backend source and the unchanged migration files for completeness. No new migration is required for this release if the existing installation is already current. Do not reset or seed your production database.
4. Keep cPanel Node.js 24, production mode, Application root `noordb.com`, URL `noordb.com`, startup **app.cjs**. Install dependencies with cPanel's npm install action or `npm install --omit=dev` only if needed. Restart once through cPanel.
5. Verify `/auth`, `/api/health`, login, navigation, saving an invoice and settings. Reload the browser to load the new assets. During an idle visible page, the previous 15-second session/role/settings request bursts should disappear. First visits, changed filters, saving data, stale focus refreshes and five-minute access checks still legitimately request data.

The worker-thread entry is optional and is not the default for this release. Its Namecheap staging requirements, SIGKILL limitations of the child launcher, and targeted process checks are documented in README.md.

Rollback: restore the previous application files including their matching `.output`, preserve `.env` and the database, keep startup `app.cjs`, and restart through cPanel.
