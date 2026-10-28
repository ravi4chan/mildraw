import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = (await readdir("dist/assets"))
  .filter((f) => !f.endsWith(".map"))
  .map((f) => "/assets/" + f);
files.push(
  "/cursors/target.svg",
  "/cursors/target-move.svg",
  "/mildraw-logo.png",
  "/mildraw-logo-dark.png",
  "/milsymbol-LICENSE.txt",
  "/THIRD-PARTY-NOTICES.txt",
);
let sw = await readFile("public/sw.js", "utf8");
const hash = createHash("sha256")
  .update(
    files.join("|") +
      sw +
      (await Promise.all(files.map((f) => readFile("dist" + f))))
        .map((b) => b.toString("base64"))
        .join("|"),
  )
  .digest("hex")
  .slice(0, 12);
sw = sw
  .replace(
    /const CACHE\s*=\s*['"]mildraw-shell-v1['"];\s*/,
    `const CACHE = 'mildraw-${hash}';\n`,
  )
  .replace(
    /const PRECACHE\s*=\s*\[[\s\S]*?\];/,
    `const PRECACHE = ${JSON.stringify(["/", "/favicon.svg", "/manifest.webmanifest", ...files])};`,
  );
await writeFile("dist/sw.js", sw);
console.log(`Offline shell: ${files.length} build assets precached (${hash})`);
