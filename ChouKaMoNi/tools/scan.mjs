// 扫描美术素材库中的抽卡视频，生成 videos.js 供 index.html 读取（file:// 下 fetch 不可用）
import { readdirSync, writeFileSync } from "fs";
import { join, extname } from "path";

const DIR = "美术素材库/抽卡视频";
const EXT = [".mp4", ".webm", ".mov", ".m4v"];

function scan(dir, parts = []) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const next = [...parts, entry.name];
    if (entry.isDirectory()) return scan(join(dir, entry.name), next);
    return entry.isFile() && EXT.includes(extname(entry.name).toLowerCase())
      ? [next.join("/")]
      : [];
  });
}

const order = ["六星", "五星", "四星", "白光"];
// 拉链完全拉开的画面时间。四星素材的动作比其他三段稍长。
const pullEnd = { "六星": 4.65, "五星": 4.65, "四星": 5.0, "白光": 4.65 };
const files = scan(DIR).sort((a, b) => {
  const aRank = order.indexOf(a.split("/")[0]);
  const bRank = order.indexOf(b.split("/")[0]);
  return (aRank < 0 ? order.length : aRank) - (bRank < 0 ? order.length : bRank)
    || a.localeCompare(b, "zh-CN");
});

const list = files.map(f => ({
  file: `${DIR}/${f}`,
  name: f.split("/").at(-1).replace(/\.[^.]+$/, ""),
  start: 2.9,  // 默认拉包起点（秒），可在此按视频单独修改
  end: pullEnd[f.split("/")[0]] ?? 4.65, // 拉到底后自动播放
}));

writeFileSync("videos.js", "window.AK_VIDEOS = " + JSON.stringify(list, null, 2) + ";\n");
console.log(`videos.js 已生成，共 ${list.length} 个视频`);

/* ---------------- 奖品素材：生成 prizes.js ---------------- */
import { readdirSync as rd } from "fs";
const PRIZE_DIR = "美术素材库/奖品素材";
const UI_DIR = "美术素材库/干员展示UI";
const IMG_EXT = [".png", ".jpg", ".jpeg", ".webp"];
const TIER_BY_FOLDER = [["特等奖", "grand"], ["一等奖", "first"], ["二等奖", "second"], ["三等奖", "third"]];

function scanImages(dir, parts = []) {
  return rd(dir, { withFileTypes: true }).flatMap(entry => {
    const next = [...parts, entry.name];
    if (entry.isDirectory()) return scanImages(join(dir, entry.name), next);
    return entry.isFile() && !entry.name.startsWith(".")
      && IMG_EXT.includes(extname(entry.name).toLowerCase())
      ? [next.join("/")]
      : [];
  });
}

// 文件名约定：中文名-英文名.png（按第一个半角连字符切分）
function prizeEntry(relPath) {
  const base = relPath.split("/").at(-1).replace(/\.[^.]+$/, "");
  const dash = base.indexOf("-");
  return {
    file: `${PRIZE_DIR}/${relPath}`,
    cn: dash < 0 ? base : base.slice(0, dash),
    en: dash < 0 ? "" : base.slice(dash + 1).trim(),
  };
}

const prizes = {};
for (const [word, id] of TIER_BY_FOLDER) {
  prizes[id] = scanImages(PRIZE_DIR)
    .filter(rel => rel.split("/")[0].startsWith(word))
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .map(prizeEntry);
}

// 展示卡 UI 素材按前缀定位（文件名里的打包哈希变了也不怕）
const uiFiles = rd(UI_DIR).filter(f => !f.startsWith("."));
const findUi = (prefix, ext) => {
  const hit = uiFiles.find(f => f.startsWith(prefix) && f.endsWith(ext));
  return hit ? `${UI_DIR}/${hit}` : null;
};
const assets = {
  bg: findUi("bg-", ".webp"),
  logo: findUi("Rhodes_Island-", ".webp"),
  vanguard: findUi("Vanguard-", ".webp"),
  star: findUi("inline_0", ".svg"),
  newBadge: findUi("inline_1", ".webp"),
  voucher: findUi("seniorVoucherIcon-", ".webp"),
  fontEn: findUi("Novecento", ".woff2"),
  fontSans: findUi("SourceHanSansSC", ".woff2"),
  fontSerif: findUi("SourceHanSerifCN", ".woff2"),
};

writeFileSync("prizes.js",
  "window.AK_PRIZES = " + JSON.stringify(prizes, null, 2) + ";\n" +
  "window.AK_RESULT_ASSETS = " + JSON.stringify(assets, null, 2) + ";\n");
console.log(`prizes.js 已生成：` +
  TIER_BY_FOLDER.map(([w, id]) => `${id}=${prizes[id].length}`).join(" "));
