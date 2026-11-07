// Dev static server: serves client-web/ at / and core/ at /core/. No dependencies.
// The Swift host serves the same layout in production. Usage: node tools/serve.js [port]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json" };
export function serveFile(req, res) {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/") p = "/index.html";
  const file = p.startsWith("/core/") ? path.join(root, p) : path.join(root, "client-web", p);
  if (!path.resolve(file).startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" }); fs.createReadStream(file).pipe(res);
}
export function serve(port = 8787) {
  const s = http.createServer(serveFile);
  return new Promise((r) => s.listen(port, "127.0.0.1", () => r(s)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await serve(Number(process.argv[2]) || 8787); console.log("http://127.0.0.1:" + (process.argv[2] || 8787)); }
