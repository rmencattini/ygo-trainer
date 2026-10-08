// Serves ProjectIgnis card scripts (data/scripts) at /scripts: live in dev, copied into dist on build.
// Only the root helper scripts and official/ are needed by the engine.
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, normalize } from "node:path";
import type { Plugin } from "vite";

const SCRIPTS = join(import.meta.dirname, "..", "..", "data", "scripts");
const SAFE = /^(official\/c\d+|[a-z_]+)\.lua$/;

const rootScripts = () =>
  readdirSync(SCRIPTS)
    .filter((f) => f.endsWith(".lua"))
    .sort();

export function cardScripts(): Plugin {
  let outDir = "dist";
  return {
    name: "ygo-card-scripts",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use("/scripts/", (req, res, next) => {
        const path = normalize(
          decodeURIComponent((req.url ?? "").split("?")[0]),
        ).replace(/^\/+/, "");
        if (path === "index.json") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(rootScripts()));
          return;
        }
        const file = join(SCRIPTS, path);
        if (!SAFE.test(path) || !existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(readFileSync(file));
        void next;
      });
    },
    closeBundle() {
      const target = join(outDir, "scripts");
      mkdirSync(target, { recursive: true });
      for (const file of rootScripts())
        cpSync(join(SCRIPTS, file), join(target, file));
      cpSync(join(SCRIPTS, "official"), join(target, "official"), {
        recursive: true,
      });
      writeFileSync(join(target, "index.json"), JSON.stringify(rootScripts()));
    },
  };
}
