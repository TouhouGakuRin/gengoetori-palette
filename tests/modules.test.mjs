/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 模块外壳的一致性检查：导航按钮、模块清单、目标区块三者不许走散
// 跑法：node tests/modules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "shell.html"), "utf8");
const modJs = readFileSync(join(here, "..", "src", "js", "06-ui-modules.js"), "utf8");

const declared = [...modJs.matchAll(/\{ id:\s*"([a-z]+)",\s*label:/g)].map(m => m[1]);
const targets = [...modJs.matchAll(/targets:\s*\[([^\]]*)\]/g)]
  .flatMap(m => [...m[1].matchAll(/"([A-Za-z]+)"/g)].map(x => x[1]));
const navs = [...html.matchAll(/data-mod="([a-z]+)"/g)].map(m => m[1]);

test("模块清单非空且 id 不重复", () => {
  assert.ok(declared.length >= 7, "模块数量不对: " + declared.length);
  assert.equal(new Set(declared).size, declared.length, "id 有重复");
});

test("每个导航按钮都对应一个已声明的模块", () => {
  assert.ok(navs.length >= 7, "导航按钮太少: " + navs.length);
  for(const n of navs) assert.ok(declared.includes(n), "导航按钮没有对应模块: " + n);
});

test("每个模块都被导航按钮覆盖", () => {
  for(const id of declared) assert.ok(navs.includes(id), "模块没有入口: " + id);
});

test("每个 targets 都存在于 shell.html", () => {
  assert.ok(targets.length >= 6, "目标区块太少: " + targets.length);
  for(const t of targets) assert.ok(html.includes('id="' + t + '"'), "缺少目标区块: " + t);
});

test("模块区块都落在 main.detail 里", () => {
  const a = html.indexOf('<main class="detail">');
  const b = html.indexOf("</main>");
  assert.ok(a > 0 && b > a, "找不到 main.detail");
  for(const t of targets){
    const i = html.indexOf('id="' + t + '"');
    assert.ok(i > a && i < b, "区块不在 detail 内: " + t);
  }
});

test("视图切换的样式与默认视图都在", () => {
  assert.ok(/<body data-view="scale">/.test(html), "body 少了默认视图");
  assert.ok(html.includes(".detail>section.on"), "缺 .detail>section.on 规则");
  assert.ok(/id:\s*"scale"[^}]*targets:\s*\[\]/.test(modJs), "scale 不该有 targets");
});
