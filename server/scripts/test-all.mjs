// Runs every server test, including the MongoDB integration tests.
// Uses TEST_MONGODB_URI if set, otherwise the local replica set from the README (port 27018).
// Tests create and drop only their own finchbound_*_test_* databases.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const env = {
  ...process.env,
  TEST_MONGODB_URI: process.env.TEST_MONGODB_URI || "mongodb://localhost:27018/?replicaSet=rs0",
};
const result = spawnSync(process.execPath, [cli, "run", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});
process.exitCode = result.status ?? 1;
