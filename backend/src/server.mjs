import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { connectDatabase } from "./db.mjs";
import { assert, HttpError } from "./errors.mjs";
import {
  currentUser,
  register,
  login,
  logout,
  sessionCookie,
  invitationStatus,
  updatePassword,
  updateProfile,
  invite,
  assignRole,
} from "./auth.mjs";
import { actionPermissions, identity, loadColumns, queryData, runAction } from "./data.mjs";
import { askLedger } from "./ai.mjs";
import { chatHistory } from "./ai-chats.mjs";
import { assistantSettings } from "./ai-settings.mjs";
import { publicBranding, updateBranding, faviconResponse } from "./branding.mjs";

export function configFromEnv(env = process.env) {
  const appOrigin = new URL(env.APP_ORIGIN ?? "http://localhost:8080").origin;
  const production = env.NODE_ENV === "production";
  assert(
    !production || appOrigin.startsWith("https://"),
    500,
    "Production APP_ORIGIN must use HTTPS",
  );
  return {
    appOrigin,
    production,
    allowSignup: env.ALLOW_SIGNUP === "true",
    smtpHost: env.SMTP_HOST,
    smtpFrom: env.SMTP_FROM,
  };
}
async function readJson(request) {
  assert(
    (request.headers["content-type"] ?? "").startsWith("application/json"),
    415,
    "JSON content type required",
  );
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    assert(size <= 1024 * 1024, 413, "Request too large");
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert(body && typeof body === "object" && !Array.isArray(body), 400, "JSON object required");
    return body;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}
export function createApiServer({
  sql,
  columns,
  config = configFromEnv(),
  sendMail,
  aiEnv = process.env,
  clock = Date.now,
}) {
  let schemaColumns = columns;
  let schemaRefresh;
  async function queryWithCurrentSchema(user, data) {
    try {
      return await queryData(sql, schemaColumns, user, data);
    } catch (error) {
      // A migration can add columns while this process is running. queryData's
      // transaction has rolled back before retrying; retain all access checks.
      if (
        error.status !== 400 ||
        !/^(Cannot write column: |Unknown column$|Unknown filter column$|Unknown order column$)/.test(
          error.message,
        )
      )
        throw error;
      schemaRefresh ??= loadColumns(sql)
        .then((fresh) => {
          schemaColumns = fresh;
        })
        .finally(() => {
          schemaRefresh = undefined;
        });
      await schemaRefresh;
      return queryData(sql, schemaColumns, user, data);
    }
  }
  // In-memory rate limiting by network peer. A reverse proxy should also enforce limits.
  const attempts = new Map();
  const rateLimit = (key, limit) => {
    const now = clock();
    if (attempts.size > 10000)
      for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
    const entry = attempts.get(key);
    const current = entry && entry.until > now ? entry : { count: 0, until: now + 60000 };
    current.count++;
    attempts.set(key, current);
    assert(current.count <= limit, 429, "درخواست‌ها زیاد است، کمی بعد امتحان کنید");
  };
  return createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    const send = (status, payload) => {
      response.statusCode = status;
      response.end(JSON.stringify(payload));
    };
    try {
      const url = new URL(request.url, "http://localhost");
      const path = url.pathname;
      if (request.method === "GET" && path === "/api/branding") {
        send(200, { data: await publicBranding(sql) });
        return;
      }
      if (request.method === "GET" && path === "/api/branding/favicon") {
        const icon = await faviconResponse(sql);
        response.setHeader("Content-Type", icon.type);
        response.end(icon.bytes);
        return;
      }
      if (request.method === "GET" && path === "/api/health") {
        await sql`select 1`;
        send(200, { data: { status: "ok", actions: Object.keys(actionPermissions) } });
        return;
      }
      if (request.method === "GET" && path === "/api/auth/session") {
        send(200, { data: { user: await currentUser(sql, request) } });
        return;
      }
      assert(request.method === "POST", 404, "Endpoint not found");
      // Cookie sessions require an exact trusted browser origin on every mutation.
      assert(request.headers.origin === config.appOrigin, 403, "Untrusted request origin");
      const data = await readJson(request);
      const peer = request.socket.remoteAddress ?? "unknown";
      if (
        [
          "/api/auth/login",
          "/api/auth/register",
          "/api/auth/password",
          "/api/auth/invitation",
          "/api/profile/update",
        ].includes(path)
      )
        rateLimit(`auth:${peer}`, 20);
      if (path === "/api/auth/register" || path === "/api/auth/login") {
        const result = path.endsWith("register")
          ? await register(sql, data, config.allowSignup)
          : await login(sql, data);
        response.setHeader("Set-Cookie", sessionCookie(result.token, config.production));
        send(200, { data: { user: result.user } });
        return;
      }
      if (path === "/api/auth/logout") {
        await logout(sql, request);
        response.setHeader("Set-Cookie", sessionCookie("", config.production, true));
        send(200, { data: {} });
        return;
      }
      if (path === "/api/auth/invitation") {
        await invitationStatus(sql, data.token);
        send(200, { data: { valid: true } });
        return;
      }
      if (path === "/api/auth/password") {
        const result = await updatePassword(sql, request, data);
        response.setHeader("Set-Cookie", sessionCookie(result.token, config.production));
        send(200, { data: { user: result.user } });
        return;
      }
      if (path === "/api/profile/update") {
        send(200, { data: await updateProfile(sql, request, data) });
        return;
      }
      const account = await currentUser(sql, request);
      assert(account, 401, "ابتدا وارد شوید");
      const user = await identity(sql, account.id);
      rateLimit(`user:${user.id}`, 600);
      if (path === "/api/branding/update") {
        send(200, { data: await updateBranding(sql, user, data) });
        return;
      }
      if (path === "/api/data/query") send(200, { data: await queryWithCurrentSchema(user, data) });
      else if (path.startsWith("/api/actions/"))
        send(200, { data: await runAction(sql, user, path.slice("/api/actions/".length), data) });
      else if (path === "/api/users/invite") {
        rateLimit(`invite:${user.id}`, 10);
        send(200, { data: await invite(sql, user, data, config, sendMail) });
      } else if (path === "/api/users/role") {
        send(200, { data: await assignRole(sql, user, data) });
      } else if (path === "/api/assistant/settings") {
        send(200, { data: await assistantSettings(sql, user, data) });
      } else if (path === "/api/assistant/chats") {
        send(200, { data: await chatHistory(sql, user, data) });
      } else if (path === "/api/assistant") {
        rateLimit(`ai:${user.id}`, 10);
        send(200, { data: await askLedger(sql, schemaColumns, user, data, aiEnv) });
      } else throw new HttpError(404, "Endpoint not found");
    } catch (error) {
      const databaseMessages = {
        ER_DUP_ENTRY: "این مقدار قبلاً ثبت شده است",
        ER_ROW_IS_REFERENCED_2: "این رکورد به اطلاعات دیگر وابسته است",
        ER_NO_REFERENCED_ROW_2: "رکورد مرتبط پیدا نشد",
        ER_CHECK_CONSTRAINT_VIOLATED: "مقدار وارد شده نامعتبر است",
        ER_CONSTRAINT_FAILED: "مقدار وارد شده نامعتبر است",
        ER_BAD_NULL_ERROR: "مقدار ضروری وارد نشده است",
        ER_TRUNCATED_WRONG_VALUE: "تاریخ یا مقدار نامعتبر است",
        ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: "مقدار وارد شده نامعتبر است",
        ER_WARN_DATA_OUT_OF_RANGE: "مقدار بزرگ‌تر از حد مجاز است",
        ER_DATA_TOO_LONG: "متن وارد شده طولانی است",
        ER_LOCK_DEADLOCK: "تداخل درخواست‌ها؛ دوباره تلاش کنید",
      };
      const status = error.status ?? (databaseMessages[error.code] ? 400 : 500);
      if (status >= 500 && !error.status)
        console.error("API request failed", { code: error.code, name: error.name });
      send(status, {
        data: null,
        error: {
          message: error.status ? error.message : (databaseMessages[error.code] ?? "خطای سرور"),
          status,
        },
      });
    }
  });
}
export async function startServer() {
  const sql = connectDatabase();
  const columns = await loadColumns(sql);
  assert(
    columns.products && columns.roles,
    500,
    "Database is not migrated. Run npm run backend:migrate.",
  );
  assert(
    columns.salary_payments?.has("payment_type"),
    500,
    "Salary payment migration is missing. Run npm run backend:migrate before starting the API.",
  );
  const config = configFromEnv();
  assert(
    columns.expenses?.has("expense_type") && columns.expenses?.has("person_name"),
    500,
    "Expense withdrawal migration is missing. Run npm run backend:migrate before starting the API.",
  );
  assert(
    columns.suppliers?.has("supplier_type"),
    500,
    "Supplier type migration is missing. Run npm run backend:migrate before starting the API.",
  );
  let sendMail;
  if (config.smtpHost) {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
        : {}),
    });
    sendMail = (message) => transport.sendMail(message);
  }
  const server = createApiServer({ sql, columns, config, sendMail });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? "127.0.0.1", () =>
    console.info(`Node API listening on port ${process.env.PORT ?? 3001}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      server.close(async () => {
        await sql.end();
        process.exit(0);
      }),
    );
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
