import { connectDatabase, quote } from "./db.mjs";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const name = process.env.DB_NAME ?? "persian_shop",
  user = process.env.DB_APP_USER ?? "persian_shop_app";
if (!/^[a-z][a-z0-9_]{1,50}$/.test(name) || !/^[a-z][a-z0-9_]{1,30}$/.test(user))
  throw Error("Invalid database/user name");
const adminUrl = process.env.MYSQL_ADMIN_URL ?? "mysql://root@127.0.0.1:3306/";
const admin = connectDatabase(adminUrl);
function saveConfig(url) {
  const template = existsSync(envPath)
    ? readFileSync(envPath, "utf8")
    : readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  writeFileSync(
    envPath,
    /^DATABASE_URL=.*$/m.test(template)
      ? template.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`)
      : `DATABASE_URL=${url}\n${template}`,
  );
}
try {
  const [{ version, port }] = await admin`SELECT VERSION() AS version,@@port AS port`;
  if (process.env.DB_USE_LOCAL_ROOT === "true") {
    const parsed = new URL(adminUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
      throw Error("Local root fallback requires a loopback address");
    await admin.unsafe(
      `CREATE DATABASE IF NOT EXISTS ${quote(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    parsed.pathname = "/" + name;
    saveConfig(parsed.href);
    console.info(
      `Configured existing local database connection for ${name} on port ${port} (${version}). No server permission tables changed.`,
    );
  } else {
    const configured = existsSync(envPath)
      ? /^DATABASE_URL=(.*)$/m.exec(readFileSync(envPath, "utf8"))?.[1]?.trim()
      : null;
    if (configured) {
      const db = connectDatabase(configured);
      try {
        await db`SELECT 1`;
        console.info(`Database connection verified on port ${port} (${version}).`);
      } finally {
        await db.end();
      }
    } else {
      const databases =
        await admin`SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=${name}`;
      if (databases.length)
        throw Error(
          `Database ${name} already exists; set DATABASE_URL deliberately instead of modifying an existing database.`,
        );
      const [{ count }] = await admin`SELECT COUNT(*) AS count FROM mysql.user WHERE User=${user}`;
      if (Number(count) > 0)
        throw Error("Application database user already exists; configure it deliberately.");
      const password = randomBytes(24).toString("base64url");
      const parsed = new URL(adminUrl);
      parsed.username = user;
      parsed.password = password;
      parsed.pathname = "/" + name;
      // Save credentials before provisioning so a failed grant does not lose them.
      saveConfig(parsed.href);
      await admin.unsafe(
        `CREATE DATABASE ${quote(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      await admin.unsafe("CREATE USER ?@? IDENTIFIED BY ?", [user, "127.0.0.1", password]);
      await admin.unsafe(
        `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES,CREATE VIEW,SHOW VIEW ON ${quote(name)}.* TO ?@?`,
        [user, "127.0.0.1"],
      );
      console.info(
        `Created ${name} with a dedicated database user on port ${port} (${version}). Credentials saved only in ignored backend/.env.`,
      );
    }
  }
} catch (error) {
  console.error("Database setup failed:", error.code ?? "", error.message);
  process.exitCode = 1;
} finally {
  await admin.end();
}
