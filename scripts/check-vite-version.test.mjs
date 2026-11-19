import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPatchedVite } from "./check-vite-version.mjs";

test("blocks vulnerable Vite versions and unverified prereleases", () => {
  for (const version of ["8.0.5", "8.0.16", "8.1.6", "8.2.4", "8.3.6", "8.3.7-beta.1", "invalid"]) {
    assert.throws(() => assertPatchedVite(version), /patched development server/);
  }
});

test("allows the patched Vite 8 release lines", () => {
  for (const version of ["8.1.7", "8.2.5", "8.3.7", "8.3.8", "8.4.0"]) {
    assert.doesNotThrow(() => assertPatchedVite(version));
  }
});
