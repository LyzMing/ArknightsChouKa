// 拉包模拟器本地服务器：静态文件 + 校准数据写回 calibrations.json（可随 git 提交）
// 运行：node server.mjs   然后访问 http://127.0.0.1:8765/
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, normalize, extname } from "node:path";

const ROOT = fileURLToPath(new URL(".", import.meta.url)); // 本文件所在目录（ChouKaMoNi/）
const PORT = 8765;
const CAL_FILE = join(ROOT, "calibrations.json");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, obj) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);

  if (path === "/api/ping") return sendJson(res, { ok: true });

  if (path === "/api/calibrations") {
    if (req.method === "GET") {
      try { return sendJson(res, JSON.parse(await readFile(CAL_FILE, "utf8"))); }
      catch { return sendJson(res, {}); } // 文件还不存在时当作空
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", c => { body += c; });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("bad shape");
          await writeFile(CAL_FILE, JSON.stringify(data, null, 2) + "\n");
          sendJson(res, { ok: true });
        } catch (e) {
          res.statusCode = 400;
          sendJson(res, { ok: false });
        }
      });
      return;
    }
  }

  // 静态文件（必须带 Content-Length / Accept-Ranges，否则 Chrome 会把视频当
  // "未知长度的流"，seekable 变成空区间，所有拖动校准都会失效）
  const rel = path === "/" ? "index.html" : path.replace(/^\//, "");
  const fp = normalize(join(ROOT, rel));
  if (!fp.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  let data;
  try {
    data = await readFile(fp);
  } catch {
    res.statusCode = 404;
    return res.end("404 Not Found");
  }
  const mime = MIME[extname(fp).toLowerCase()] || "application/octet-stream";
  const size = data.length;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (range) {
    let [, a, b] = range;
    let start = a === "" ? Math.max(0, size - +b) : +a;
    let end = a === "" ? size - 1 : (b === "" ? size - 1 : Math.min(+b, size - 1));
    if (!(start <= end) || start >= size) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${size}`);
      return res.end();
    }
    res.writeHead(206, {
      "Content-Type": mime,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
    });
    res.end(data.subarray(start, end + 1));
  } else {
    res.writeHead(200, { "Content-Type": mime, "Accept-Ranges": "bytes", "Content-Length": size });
    res.end(data);
  }
}).listen(PORT, () => {
  console.log(`拉包模拟器已启动: http://127.0.0.1:${PORT}/`);
  console.log("校准数据将保存到 calibrations.json（可提交到仓库）");
});
