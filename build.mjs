/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 幻歌鸟调色盘 · 零依赖构建
// 用法：node build.mjs
// 作用：把 src/shell.html 里的 /*@JS*/ 占位替换成 src/js/ 下所有 .js 的顺序拼接，
//       输出单文件 index.html（file:// 双击可开，不需要服务器）。
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const shell = await readFile(join(here, "src/shell.html"), "utf8");
const version = (await readFile(join(here, "VERSION"), "utf8")).trim();
const dir = join(here, "src/js");
const files = (await readdir(dir)).filter(f => f.endsWith(".js")).sort();

const parts = [];
for (const f of files) {
  const code = await readFile(join(dir, f), "utf8");
  parts.push(`/* ===== ${f} ===== */\n${code.trimEnd()}`);
}
const banner = `/* built ${new Date().toISOString()} · ${files.length} modules */`;
const out = shell.replace("/*@JS*/", () => [banner, ...parts].join("\n\n"))
  .replaceAll("__VERSION__", version);

if (!out.includes("ML_BOOT")) {
  // 兜底：先不做整体自检，只提示
  console.warn("⚠ 输出里没找到 ML_BOOT 标记（正常，等主模块接入后再加）");
}
await writeFile(join(here, "index.html"), out, "utf8");
console.log(`built index.html · ${files.length} module(s) · ${out.length} chars`);
console.log(files.map(f => "  - " + f).join("\n"));
