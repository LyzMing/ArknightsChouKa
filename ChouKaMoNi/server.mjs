// 拉包模拟器本地服务器：静态文件 + 校准数据写回 calibrations.json（可随 git 提交）
// 运行：node server.mjs   然后访问 http://127.0.0.1:8765/
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, normalize, extname, relative, isAbsolute } from "node:path";

const ROOT = fileURLToPath(new URL(".", import.meta.url)); // 本文件所在目录（ChouKaMoNi/）
const PORT = 8765;
const CAL_FILE = join(ROOT, "calibrations.json");
const FRAME_ROOT = join(ROOT, "美术素材库", "抽卡帧");
const FRAME_MANIFEST = join(ROOT, "pull-frames.js");
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

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeFrameFolder(value) {
  return typeof value === "string" && /^[\p{L}\p{N}_-]{1,40}$/u.test(value) ? value : null;
}

function insideRoot(root, target) {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith("..\\") && !rel.startsWith("../") && !isAbsolute(rel));
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

  // 开发工具使用：把视频的可拖动区间导出为 WebP 帧。
  // 只能写入固定的「美术素材库/抽卡帧」目录，避免接口触及其他文件。
  if (path === "/api/frame-reset" && req.method === "POST") {
    try {
      const { folder } = JSON.parse((await readBody(req, 64 * 1024)).toString("utf8"));
      const safe = safeFrameFolder(folder);
      if (!safe) throw new Error("bad folder");
      const target = join(FRAME_ROOT, safe);
      await rm(target, { recursive: true, force: true });
      await mkdir(target, { recursive: true });
      return sendJson(res, { ok: true });
    } catch {
      res.statusCode = 400;
      return sendJson(res, { ok: false });
    }
  }

  if (path === "/api/frame" && req.method === "POST") {
    try {
      const url = new URL(req.url, "http://x");
      const folder = safeFrameFolder(url.searchParams.get("folder"));
      const name = url.searchParams.get("name");
      if (!folder || !/^frame_\d{4}\.webp$/.test(name || "")) throw new Error("bad path");
      const target = join(FRAME_ROOT, folder, name);
      if (!insideRoot(FRAME_ROOT, target)) throw new Error("outside frame root");
      await mkdir(join(FRAME_ROOT, folder), { recursive: true });
      await writeFile(target, await readBody(req));
      return sendJson(res, { ok: true });
    } catch {
      res.statusCode = 400;
      return sendJson(res, { ok: false });
    }
  }

  if (path === "/api/frame-manifest" && req.method === "POST") {
    try {
      const data = JSON.parse((await readBody(req, 512 * 1024)).toString("utf8"));
      if (!data || data.version !== 1 || data.fps !== 60 || typeof data.items !== "object")
        throw new Error("bad manifest");
      await writeFile(FRAME_MANIFEST,
        "window.AK_PULL_FRAMES = " + JSON.stringify(data, null, 2) + ";\n");
      return sendJson(res, { ok: true });
    } catch {
      res.statusCode = 400;
      return sendJson(res, { ok: false });
    }
  }

  // 静态文件（必须带 Content-Length / Accept-Ranges，否则 Chrome 会把视频当
  // "未知长度的流"，seekable 变成空区间，所有拖动校准都会失效）
  const rel = path === "/" ? "index.html" : path.replace(/^\//, "");
  const fp = normalize(join(ROOT, rel));
  if (!insideRoot(ROOT, fp)) { res.statusCode = 403; return res.end(); }
  let info;
  try {
    info = await stat(fp);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    res.statusCode = 404;
    return res.end("404 Not Found");
  }
  const mime = MIME[extname(fp).toLowerCase()] || "application/octet-stream";
  const size = info.size;
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
    createReadStream(fp, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Length": size,
      "Cache-Control": extname(fp).toLowerCase() === ".html" ? "no-cache" : "public, max-age=3600",
    });
    createReadStream(fp).pipe(res);
  }
}).listen(PORT, () => {
  console.log(`拉包模拟器已启动: http://127.0.0.1:${PORT}/`);
  console.log("校准数据将保存到 calibrations.json（可提交到仓库）");
});
