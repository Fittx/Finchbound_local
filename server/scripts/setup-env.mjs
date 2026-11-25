// Creates or completes server/.env from .env.example. Existing values are never changed,
// and no value is printed. Run: npm run setup:env (from the repository root).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "..");
const examplePath = resolve(dir, ".env.example");
const envPath = resolve(dir, ".env");
const keyOf = (line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1];
const example = readFileSync(examplePath, "utf8").split(/\r?\n/);
const created = !existsSync(envPath);
const current = created ? [] : readFileSync(envPath, "utf8").split(/\r?\n/);
const present = new Set(current.map(keyOf).filter(Boolean));
const placeholder = /replace|change.?me|example|placeholder/i;
const secret = () => randomBytes(48).toString("base64url");

const added = [];
const lines = current.map((line) => {
  // A missing or placeholder JWT secret is replaced with a generated one.
  if (keyOf(line) === "JWT_SECRET") {
    const value = line.slice("JWT_SECRET=".length).trim();
    if (!value || placeholder.test(value)) {
      added.push("JWT_SECRET (generated)");
      return "JWT_SECRET=" + secret();
    }
  }
  return line;
});
const missing = [];
for (const line of example) {
  const key = keyOf(line);
  if (!key || present.has(key)) continue;
  present.add(key);
  missing.push(key === "JWT_SECRET" ? "JWT_SECRET=" + secret() : line);
  added.push(key === "JWT_SECRET" ? "JWT_SECRET (generated)" : key);
}
if (missing.length) {
  if (lines.length && lines.at(-1) !== "") lines.push("");
  lines.push("# Added by setup:env from .env.example", ...missing, "");
}
writeFileSync(envPath, lines.join("\n"));
console.log(created ? "Created server/.env" : "Checked server/.env");
console.log(added.length ? "Added: " + added.join(", ") : "Nothing missing.");
console.log(
  "Next: fill in any empty values you need (SMTP_*, ADMIN_EMAILS), then run npm run check:env",
);
