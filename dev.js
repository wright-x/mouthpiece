// Tiny local server that mimics Vercel: `GEMINI_API_KEY=... node dev.js` → http://localhost:3000
import http from "node:http";
import fs from "node:fs/promises";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3000");
  try {
    if (url.pathname.startsWith("/api/")) {
      const mod = await import(`./api/${url.pathname.slice(5)}.js`);
      const fn = mod[req.method];
      if (!fn) { res.writeHead(405).end(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const request = new Request(url, {
        method: req.method, headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const out = await fn(request);
      res.writeHead(out.status, Object.fromEntries(out.headers));
      if (out.body) for await (const c of out.body) res.write(c);
      res.end();
    } else {
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const data = await fs.readFile(`./public/${file}`);
      res.writeHead(200, { "Content-Type": file.endsWith(".html") ? "text/html" : "application/octet-stream" }).end(data);
    }
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(String(e));
  }
});
server.listen(3000, () => console.log("http://localhost:3000"));
