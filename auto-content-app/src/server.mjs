// HTTP server: POST /generate (cho Make/Drive goi vao), GET /health
import http from "node:http";
import fs from "node:fs";
import { generateWithFallback } from "./orchestrator.mjs";
import { log } from "./util.mjs";

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.APP_TOKEN;

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });

  if (req.method === "POST" && req.url === "/generate") {
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
      return json(res, 401, { error: "unauthorized" });
    }
    let body = "";
    for await (const c of req) body += c;
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "body khong phai JSON hop le" });
    }
    if (!data.filePath && !data.fileUrl && !data.driveFileId) {
      return json(res, 400, { error: "can filePath | fileUrl | driveFileId" });
    }
    const outDir = process.env.OUT_DIR || "./out";
    fs.mkdirSync(outDir, { recursive: true });
    try {
      const result = await generateWithFallback({
        filePath: data.filePath,
        fileUrl: data.fileUrl,
        driveFileId: data.driveFileId,
        title: data.title || "content",
        outDir,
      });
      return json(res, 200, result);
    } catch (e) {
      return json(res, 500, { error: e.message, details: e.details });
    }
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => log(`auto-content-app nghe o :${PORT}`));
