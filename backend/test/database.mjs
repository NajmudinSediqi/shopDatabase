import { connectDatabase, quote } from "../src/db.mjs";
import { randomBytes } from "node:crypto";
export async function testDatabase({ triggers = false } = {}) {
  const adminUrl = process.env.MYSQL_ADMIN_URL ?? "mysql://root@127.0.0.1:3306/";
  const admin = connectDatabase(adminUrl),
    suffix = randomBytes(5).toString("hex");
  const name = `persian_shop_test_${Date.now()}_${suffix}`,
    user = `ledger_test_${suffix}`,
    host = "127.0.0.1",
    password = randomBytes(24).toString("base64url");
  if (!/^persian_shop_test_\d+_[a-f0-9]{10}$/.test(name)) throw Error("Unsafe test database name");
  let created = false,
    sql;
  try {
    await admin.unsafe(
      `CREATE DATABASE ${quote(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await admin.unsafe("CREATE USER ?@? IDENTIFIED BY ?", [user, host, password]);
    created = true;
    await admin.unsafe(
      `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES,CREATE VIEW,SHOW VIEW${triggers ? ",TRIGGER" : ""} ON ${quote(name)}.* TO ?@?`,
      [user, host],
    );
    const url = new URL(adminUrl);
    url.pathname = "/" + name;
    url.username = user;
    url.password = password;
    sql = connectDatabase(url.href);
    console.info(`Testing real MySQL/MariaDB database with a restricted account: ${name}`);
    return {
      sql,
      close: async () => {
        await sql.end();
        try {
          await admin.unsafe(`DROP DATABASE ${quote(name)}`);
          await admin.unsafe("DROP USER ?@?", [user, host]);
        } finally {
          await admin.end();
        }
      },
    };
  } catch (error) {
    if (sql) await sql.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${quote(name)}`);
    if (created) await admin.unsafe("DROP USER ?@?", [user, host]);
    await admin.end();
    throw Error(`${error.code ?? ""}: ${error.message}`);
  }
}
