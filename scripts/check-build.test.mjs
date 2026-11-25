import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkBuild } from "./check-build.mjs";

test("checks lazy chunks as well as the valid entry module", () => {
  const directory = mkdtempSync(join(tmpdir(), "finchbound-build-check-"));
  try {
    mkdirSync(join(directory, "assets"));
    writeFileSync(
      join(directory, "assets", "entry.js"),
      'export const screen = () => import("./lazy.js");',
    );
    writeFileSync(join(directory, "assets", "lazy.js"), 'export default "ready";');
    assert.equal(checkBuild(directory), 2);
    writeFileSync(
      join(directory, "assets", "lazy.js"),
      "load(factory, __vite__mapDeps([0])70cfe363);",
    );
    assert.throws(() => checkBuild(directory), /Invalid generated JavaScript: assets[\\/]lazy.js/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects a missing JavaScript build", () => {
  const directory = mkdtempSync(join(tmpdir(), "finchbound-build-check-"));
  try {
    assert.throws(() => checkBuild(directory), /No built JavaScript/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
