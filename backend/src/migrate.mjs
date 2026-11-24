import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { connectDatabase } from "./db.mjs";
export const migrationsDirectory = new URL("../migrations/", import.meta.url);
// Migration files contain ordinary SQL statements; no stored routines or DELIMITER blocks.
export function splitStatements(sql) {
  const result = [];
  let start = 0,
    quote = null,
    comment = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (comment) {
      if (c === "\n") comment = false;
      continue;
    }
    if (quote) {
      if (c === quote && sql[i + 1] === quote) {
        i++;
        continue;
      }
      if (c === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") {
      comment = true;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      continue;
    }
    if (c === ";") {
      const text = sql.slice(start, i).trim();
      if (text) result.push(text);
      start = i + 1;
    }
  }
  const rest = sql.slice(start).trim();
  if (rest) result.push(rest);
  return result;
}
export async function migrate(sql) {
  return sql.connection(async (tx) => {
    const [{ acquired }] =
      await tx`SELECT GET_LOCK(CONCAT(DATABASE(),':migrations'),30) AS acquired`;
    if (!acquired) throw Error("Could not acquire migration lock");
    try {
      const [{ version }] = await tx`SELECT VERSION() AS version`;
      const mariaDB = /mariadb/i.test(version);
      await tx.unsafe(
        "CREATE TABLE IF NOT EXISTS backend_migrations (name VARCHAR(255) PRIMARY KEY,checksum CHAR(64) NOT NULL,next_statement INT NOT NULL DEFAULT 0,applied_at DATETIME(3) NULL) ENGINE=InnoDB",
      );
      for (const name of (await readdir(migrationsDirectory))
        .filter((n) => n.endsWith(".sql"))
        .sort()) {
        const content = await readFile(new URL(name, migrationsDirectory), "utf8");
        const checksum = createHash("sha256").update(content).digest("hex");
        let [record] = await tx`SELECT * FROM backend_migrations WHERE name=${name}`;
        if (record && record.checksum !== checksum)
          throw Error(`Applied migration changed: ${name}`);
        if (record?.applied_at) continue;
        if (!record) {
          await tx`INSERT INTO backend_migrations(name,checksum) VALUES (${name},${checksum})`;
          record = { next_statement: 0 };
        }
        const statements = splitStatements(content);
        // MySQL DDL commits implicitly. Journal every statement; keep statements replay-safe.
        for (let i = record.next_statement; i < statements.length; i++) {
          const statement = statements[i];
          const payment = name === "0001_mysql_schema.sql" && mariaDB
            ? [
                ["customer_payments", "sale_id"],
                ["supplier_payments", "purchase_id"],
              ].find(([table]) => statement.includes("CREATE TABLE IF NOT EXISTS `" + table + "`"))
            : undefined;
          try {
            await tx.unsafe(statement);
          } catch (error) {
            if (!payment || error.errno !== 1901) throw error;
            const check = `,\n  CHECK (debt_id IS NULL OR ${payment[1]} IS NULL)`;
            if (!statement.includes(check)) throw error;
            await tx.unsafe(statement.replace(check, ""));
          }
          if (payment) {
            // Some MariaDB versions disallow CHECK on columns with SET NULL FKs.
            // Triggers preserve the same invariant and are replay-safe after interruption.
            const [table, invoice] = payment;
            const [definition] = await tx.unsafe(`SHOW CREATE TABLE \`${table}\``);
            const ddl = definition["Create Table"];
            const hasCheck = /CHECK\s*\([^\n]*debt_id[^\n]*(sale_id|purchase_id)/i.test(ddl);
            if (!hasCheck) for (const operation of ["INSERT", "UPDATE"]) {
              await tx.unsafe(`CREATE TRIGGER IF NOT EXISTS \`guard_${table}_${operation.toLowerCase()}\` BEFORE ${operation} ON \`${table}\` FOR EACH ROW BEGIN IF NEW.debt_id IS NOT NULL AND NEW.${invoice} IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A payment cannot reference both a debt and an invoice'; END IF; END`);
            }
          }
          await tx`UPDATE backend_migrations SET next_statement=${i + 1} WHERE name=${name}`;
        }
        await tx`UPDATE backend_migrations SET applied_at=UTC_TIMESTAMP(3) WHERE name=${name}`;
        console.info(`Applied ${name}`);
      }
    } finally {
      await tx`SELECT RELEASE_LOCK(CONCAT(DATABASE(),':migrations'))`;
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sql = connectDatabase();
  try {
    await migrate(sql);
  } finally {
    await sql.end();
  }
}
