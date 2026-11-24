// Optional single-process entry. Validate under the host's lsnode in staging first.
const path = require("node:path");
const { spawnWorkerService } = require("./worker-service.cjs");
const { startLauncher } = require("./launcher.cjs");
process.chdir(__dirname);
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
process.env.NODE_ENV = "production";
if (!process.env.DATABASE_URL || !process.env.APP_ORIGIN)
  throw Error("Set DATABASE_URL and APP_ORIGIN");
startLauncher({ root: __dirname, spawnService: spawnWorkerService });
