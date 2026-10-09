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

/* ---------------- 奖品素材：生成 prizes.js ----------------
   2026 秋季紧急换奖：供货变动，奖品整体换成「美术素材库/奖品素材新」里的实拍图，每档一张。
   抽奖仍按奖项等级计算库存与概率，不区分具体款式。 */
import { readdirSync as rd } from "fs";
const PRIZE_DIR = "美术素材库/奖品素材新";
const UI_DIR = "美术素材库/干员展示UI";
const IMG_EXT = [".png", ".jpg", ".jpeg", ".webp"];
const TIER_BY_FOLDER = [["特等奖", "grand"], ["一等奖", "first"], ["二等奖", "second"], ["三等奖", "third"]];

// 结果展示卡上的奖品名。grand 为 null = 沿用文件名里的奖品本名（「影之刃零」保持不变）；
// 其余三档按需求只显示奖项等级，并配对应的英文名。
const RESULT_NAME = {
  grand: null,
  first: { cn: "一等奖", en: "First Prize" },
  second: { cn: "二等奖", en: "Second Prize" },
  third: { cn: "三等奖", en: "Third Prize" },
};

// 主界面海报上的文案。那里设计成同时展示奖项等级和奖品种类，所以种类写全。
const TIER_LABEL = [
  { id: "grand", name: "特等奖", nameEn: "Grand Prize",
    category: "影之刃零", categoryEn: "PHANTOM BLADE ZERO" },
  { id: "first", name: "一等奖", nameEn: "First Prize",
    category: "徽章 · 木钥匙扣", categoryEn: "BADGE · WOODEN KEYCHAIN" },
  { id: "second", name: "二等奖", nameEn: "Second Prize",
    category: "大贴纸 · 明信片 · 亚克力钥匙扣", categoryEn: "STICKER · POSTCARD · ACRYLIC KEYCHAIN" },
  { id: "third", name: "三等奖", nameEn: "Third Prize",
    category: "小豆丁 · 社娘小贴纸 · UT小贴纸", categoryEn: "MINI CHARM · STICKER · UT STICKER" },
];

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

// 文件名约定：中文名-英文名.png（按第一个半角连字符切分）。
// 结果卡要按档位显示时，用 RESULT_NAME 覆盖解析出来的名字。
function prizeEntry(relPath, id) {
  const base = relPath.split("/").at(-1).replace(/\.[^.]+$/, "");
  const dash = base.indexOf("-");
  const fromFile = {
    cn: dash < 0 ? base : base.slice(0, dash),
    en: dash < 0 ? "" : base.slice(dash + 1).trim(),
  };
  return { file: `${PRIZE_DIR}/${relPath}`, ...(RESULT_NAME[id] || fromFile) };
}

const prizes = {};
for (const [word, id] of TIER_BY_FOLDER) {
  prizes[id] = scanImages(PRIZE_DIR)
    .filter(rel => rel.split("/")[0].startsWith(word))
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .map(rel => prizeEntry(rel, id));
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
  "window.AK_PRIZE_TIERS = " + JSON.stringify(TIER_LABEL, null, 2) + ";\n" +
  "window.AK_RESULT_ASSETS = " + JSON.stringify(assets, null, 2) + ";\n");
console.log(`prizes.js 已生成：` +
  TIER_BY_FOLDER.map(([w, id]) => `${id}=${prizes[id].length}`).join(" "));
