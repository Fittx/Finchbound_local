import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

if (!process.env.TEST_MONGODB_URI) {
  console.error(
    "Set TEST_MONGODB_URI to a local replica-set URI. Tests create and drop only a fresh finchbound_books_test_* database.",
  );
  process.exitCode = 1;
} else {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");
  const result = spawnSync(
    process.execPath,
    [cli, "run", "tests/books.foundation.test.ts", "tests/books.integration.test.ts"],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  process.exitCode = result.status ?? 1;
}
