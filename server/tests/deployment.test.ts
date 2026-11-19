import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testConfig, testLogger } from "./helpers.js";

describe("single-origin deployment", () => {
  let directory: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "finchbound-client-test-"));
    await mkdir(join(directory, "assets"));
    await writeFile(join(directory, "index.html"), '<div id="root">built client</div>');
    await writeFile(join(directory, "assets", "index-fingerprint.js"), "export default 1;");
    await writeFile(join(directory, ".env"), "MUST_NOT_BE_SERVED=private");
  });
  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  const app = () =>
    createApp({
      config: testConfig({ SERVE_CLIENT: "true", TRUST_PROXY: "1" }),
      isDatabaseReady: () => true,
      clientDirectory: directory,
      logger: testLogger(),
    });

  it("serves the client with fresh HTML and immutable bundled assets", async () => {
    const server = app();
    const html = await request(server).get("/").expect(200);
    expect(html.text).toContain("built client");
    expect(html.headers["cache-control"]).toBe("no-store");
    const asset = await request(server).get("/assets/index-fingerprint.js").expect(200);
    expect(asset.headers["cache-control"]).toContain("immutable");
    await request(server).get("/api/health").expect(200, { ok: true });
    expect(server.get("trust proxy")).toBe(1);
  });

  it("keeps unknown APIs, assets, and dotfiles out of the HTML fallback", async () => {
    const server = app();
    for (const path of ["/api/not-real", "/assets/missing.js", "/.env"])
      expect((await request(server).get(path).expect(404)).body.error.code).toBe("NOT_FOUND");
    await request(server).post("/api/not-real").expect(403);
    await request(server).get("/api/books").expect(401);
  });

  it("permits the Turnstile widget without allowing inline application scripts", async () => {
    const response = await request(app()).get("/").expect(200);
    const policy = response.headers["content-security-policy"];
    expect(policy).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(policy).toContain("frame-src 'self' https://challenges.cloudflare.com");
    expect(policy).toContain("connect-src 'self' https://challenges.cloudflare.com");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("fails startup when the configured client build is missing", () => {
    expect(() =>
      createApp({
        config: testConfig({ SERVE_CLIENT: "true" }),
        isDatabaseReady: () => true,
        clientDirectory: join(directory, "missing"),
      }),
    ).toThrow();
  });
});
