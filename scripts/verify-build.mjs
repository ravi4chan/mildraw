import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
const sw = await readFile("dist/sw.js", "utf8");
const html = await readFile("dist/index.html", "utf8");
const headers = await readFile("dist/_headers", "utf8");
const assets = await readdir("dist/assets");
assert(
  assets.some((f) => f.endsWith(".js")) &&
    assets.some((f) => f.endsWith(".css")),
  "Missing compiled JS or CSS",
);
for (const file of assets) {
  assert(sw.includes("/assets/" + file), `Offline cache misses ${file}`);
  assert(
    (await stat("dist/assets/" + file)).size < 25 * 1024 * 1024,
    `${file} exceeds Cloudflare limit`,
  );
}
assert(
  html.includes("MILDraw") && !html.includes("/src/"),
  "HTML is not production-ready",
);
assert(
  headers.includes("microphone=()") && headers.includes("object-src"),
  "Missing security headers",
);
assert(!sw.includes("mildraw-shell-v1"), "Offline cache has no build version");
console.log(
  "Deployment checks passed: compiled assets, initial offline precache, Cloudflare size limit, security headers.",
);
