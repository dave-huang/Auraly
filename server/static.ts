import express, { type Express } from "express";
import fs from "fs";
import path from "path";

import { NOT_FOUND } from "./legal";

// Everything here is safe to run in production.
//
// It was split out of `server/vite.ts` because that module imports `vite` and
// `vite.config.ts` at the top level, and `vite` is a devDependency. Bundling
// them together meant the production bundle carried a static `import "vite"`,
// so a container built with production dependencies only would crash on the
// first line rather than start. Dev-only machinery is now behind a dynamic
// import in `index.ts` and cannot be reached from a production boot.

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  // API-only mode. The product is the mobile app; the web client in `client/`
  // is legacy and the deployed image is built with `build:server`, which skips
  // it. Refusing to boot without a web bundle would mean shipping React to
  // production purely to satisfy a file check, so serve the API and say so.
  if (!fs.existsSync(distPath)) {
    log("no web bundle at dist/public — serving API only");
    // The app gets JSON, a person gets a page. Anything outside /api is an
    // address someone typed or followed, and a bare JSON error is a dead end.
    app.use("*", (req, res) => {
      if (req.originalUrl.startsWith("/api/") || req.originalUrl === "/api") {
        res.status(404).json({ message: "Not found" });
        return;
      }
      res.status(404).type("html").send(NOT_FOUND);
    });
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
