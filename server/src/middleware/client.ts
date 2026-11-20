import { statSync } from "node:fs";
import { resolve, sep } from "node:path";
import express, { type Express } from "express";

/** Serve only the Vite output. Clean client routes receive the app shell; missing assets remain 404. */
export function mountClient(app: Express, directory: string) {
  const root = resolve(directory);
  if (!statSync(resolve(root, "index.html")).isFile())
    throw new Error("Build the client before starting with SERVE_CLIENT=true.");
  app.use(
    express.static(root, {
      dotfiles: "ignore",
      etag: false,
      lastModified: false,
      redirect: false,
      setHeaders(res, file) {
        // Only Vite's fingerprinted output is immutable. HTML/public files must
        // refresh after deploys, especially when updating the Turnstile site key.
        if (file.startsWith(resolve(root, "assets") + sep))
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-store");
      },
    }),
  );
  app.get(/^(?!\/api(?:\/|$)|\/assets(?:\/|$))(?!.*\.).*$/, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(resolve(root, "index.html"));
  });
}
