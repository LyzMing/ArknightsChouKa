// 扫描 视频素材/ 目录，生成 videos.js 供 index.html 读取（file:// 下 fetch 不可用，所以用 js）
import { readdirSync, writeFileSync } from "fs";
import { join, extname } from "path";

const DIR = "视频素材";
const EXT = [".mp4", ".webm", ".mov", ".m4v"];

const files = readdirSync(DIR)
  .filter(f => EXT.includes(extname(f).toLowerCase()))
  .sort();

const list = files.map(f => ({
  file: `${DIR}/${f}`,
  name: f.replace(/\.[^.]+$/, ""),
  start: 2.9,  // 默认拉包起点（秒），可在此按视频单独修改
  end: 3.55,   // 默认拉包终点（秒），终点后自动播放
}));

writeFileSync("videos.js", "window.AK_VIDEOS = " + JSON.stringify(list, null, 2) + ";\n");
console.log(`videos.js 已生成，共 ${list.length} 个视频`);
