import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

export const quote = (value) => "\x60" + value.replaceAll("\x60", "\x60\x60") + "\x60";
const jsonFields = new Set(["metadata", "permissions", "bill_settings"]);
const booleanFields = new Set(["active", "is_system"]);
function normalize(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (jsonFields.has(key) && typeof value === "string") value = JSON.parse(value);
        if (booleanFields.has(key) && value !== null) value = Boolean(value);
        if (key.endsWith("_at") && typeof value === "string" && /^\d{4}-\d{2}-\d{2} /.test(value))
          value = value.replace(" ", "T") + "Z";
        return [key, value];
      }),
    ),
  );
}
function facade(executor) {
  const sql = async (strings, ...values) => sql.unsafe(strings.join("?"), values);
  sql.unsafe = async (text, values = []) => {
    const method =
      values.length && !/^\s*(CREATE|ALTER|DROP|GRANT|REVOKE)\b/i.test(text) ? "execute" : "query";
    return normalize((await executor[method](text, values))[0]);
  };
  sql.json = (value) => JSON.stringify(value);
  return sql;
}
export function connectDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw Error("DATABASE_URL is required in backend/.env");
  const parsed = new URL(url);
  if (parsed.protocol !== "mysql:") throw Error("DATABASE_URL must use mysql://");
  const pool = mysql.createPool({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1) || undefined,
    connectionLimit: 10,
    waitForConnections: true,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    decimalNumbers: true,
    supportBigNumbers: true,
    multipleStatements: false,
  });
  pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
    connection.query("SET SESSION sql_mode = CONCAT_WS(',', @@sql_mode, 'STRICT_TRANS_TABLES')");
  });
  const sql = facade(pool);
  sql.connection = async (callback) => {
    const connection = await pool.getConnection();
    try {
      return await callback(facade(connection));
    } finally {
      connection.release();
    }
  };
  sql.begin = async (callback) => {
    const connection = await pool.getConnection();
    try {
      await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await connection.beginTransaction();
      const result = await callback(facade(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
  sql.end = () => pool.end();
  return sql;
}
export async function asUser(sql, userId, callback) {
  // MySQL has no PostgreSQL RLS: data.mjs applies the authenticated row scope.
  if (!userId) throw Error("Authenticated user is required");
  return sql.begin(callback);
}
export async function lockIdentity(tx) {
  await tx.unsafe("SELECT name FROM app_locks WHERE name='identity' FOR UPDATE");
}
export async function lockProducts(tx, ids) {
  for (const id of [...new Set(ids)].sort()) {
    if (typeof id !== "string" || !/^[a-f\d-]{36}$/i.test(id)) {
      const e = Error("Invalid product");
      e.status = 400;
      throw e;
    }
    const rows = await tx.unsafe("SELECT id FROM products WHERE id=? FOR UPDATE", [id]);
    if (!rows.length) {
      const e = Error("Product not found");
      e.status = 400;
      throw e;
    }
  }
}
export async function insertRecord(tx, table, values) {
  const data = { ...values };
  if (
    data.id === undefined &&
    !["settings", "permissions", "auth_sessions", "auth_invitations", "app_locks"].includes(table)
  )
    data.id = randomUUID();
  const keys = Object.keys(data);
  await tx.unsafe(
    "INSERT INTO " +
      quote(table) +
      " (" +
      keys.map(quote).join(",") +
      ") VALUES (" +
      keys.map(() => "?").join(",") +
      ")",
    keys.map((k) => fieldValue(k, data[k])),
  );
  const key =
    table === "permissions"
      ? "code"
      : table.startsWith("auth_") && table !== "auth_users"
        ? "token_hash"
        : "id";
  const [row] = await tx.unsafe("SELECT * FROM " + quote(table) + " WHERE " + quote(key) + "=?", [
    data[key],
  ]);
  return row;
}

export function fieldValue(key, value) {
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  if (key.endsWith("_at") && typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value))
    return value.replace("T", " ").replace(/Z$/, "");
  return value;
}
