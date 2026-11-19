import { readdirSync, readFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Parse the actual output, including lazy chunks. No code is executed. */
export function checkBuild(directory = "dist") {
  const root = resolve(directory);
  const files = [];
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(file);
    }
  }
  visit(root);
  const invalid = files.filter((file) => {
    const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
      input: readFileSync(file, "utf8"),
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 10000,
    });
    return result.status !== 0;
  });
  if (!files.length) throw new Error("No built JavaScript found. Run the Vite build first.");
  if (invalid.length)
    throw new Error("Invalid generated JavaScript: " + invalid.map((file) => relative(root, file)).join(", "));
  return files.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(`Build syntax check: PASS (${checkBuild(process.argv[2] || "dist")} JavaScript files)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Build syntax check failed");
    process.exitCode = 1;
  }
}
