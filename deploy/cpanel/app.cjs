// cPanel/lsnode loads this CommonJS entry. Keep .output as generated build output.
const path = require("node:path");
const { startLauncher } = require("./launcher.cjs");
process.chdir(__dirname);
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
process.env.NODE_ENV = "production";
if (!process.env.DATABASE_URL || !process.env.APP_ORIGIN)
  throw Error("Set DATABASE_URL and APP_ORIGIN in .env or cPanel environment variables");
startLauncher({ root: __dirname });
