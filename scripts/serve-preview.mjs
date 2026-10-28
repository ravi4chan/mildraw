import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const headerText = await readFile(resolve(root, "_headers"), "utf8");
const headerRules = [];
for (const line of headerText.split("\n")) {
  if (line.startsWith("/"))
    headerRules.push({ pattern: line.trim(), values: {} });
  else if (line.startsWith("  ") && line.includes(":")) {
    const index = line.indexOf(":");
    headerRules.at(-1).values[line.slice(0, index).trim()] = line
      .slice(index + 1)
      .trim();
  }
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const path = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!(await stat(path)).isFile()) throw Error("Not a file");
    for (const rule of headerRules) {
      if (
        rule.pattern === "/*" ||
        rule.pattern === pathname ||
        (rule.pattern.endsWith("*") &&
          pathname.startsWith(rule.pattern.slice(0, -1)))
      )
        for (const [key, value] of Object.entries(rule.values))
          res.setHeader(key, value);
    }
    res.setHeader(
      "Content-Type",
      types[extname(path)] || "application/octet-stream",
    );
    res.writeHead(200);
    res.end(await readFile(path));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});
server.listen(5188, "127.0.0.1", () =>
  console.log(
    "MILDraw production preview with Cloudflare headers: http://127.0.0.1:5188/",
  ),
);
