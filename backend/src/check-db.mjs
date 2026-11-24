import { connectDatabase } from "./db.mjs";

const sql = connectDatabase();
try {
  const [connection] = await sql`SELECT DATABASE() AS database_name, CURRENT_USER() AS account,
    VERSION() AS version, @@port AS port`;
  const [tables] = await sql`SELECT COUNT(*) AS table_count FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`;
  const [migrations] = await sql`SELECT COUNT(*) AS applied_migrations FROM backend_migrations
    WHERE applied_at IS NOT NULL`;
  console.info(JSON.stringify({ ...connection, ...tables, ...migrations }, null, 2));
} catch (error) {
  console.error("Database check failed:", error.code ?? "", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
