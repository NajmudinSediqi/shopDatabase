// Runs in each service process, before application imports or database startup.
// The IPC descriptor has one parent owner; EOF is observable even after SIGKILL.
const { pathToFileURL } = require("node:url");
const entry = process.argv[2];
if (!entry || !process.channel || !process.connected) process.exit(1);
process.once("disconnect", () => process.exit(1));
// Preserve the service's direct-entry detection and argv behavior.
process.argv.splice(1, 1);
import(pathToFileURL(entry).href).catch(() => {
  console.error("Service bootstrap: import failed");
  process.exit(1);
});
