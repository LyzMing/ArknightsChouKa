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
