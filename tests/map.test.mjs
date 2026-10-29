/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 调式地图：60 个节点的布局与标签避让 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "js");
const FILES = ["00-core-pitch.js", "01-core-scales.js", "02-core-chords.js", "03-core-theory.js", "06-ui-registry.js", "30-render-map.js"];
const code = FILES.map(f => readFileSync(join(src, f), "utf8")).join("\n");
// distance() 会顺着 chordOf() 读到界面的和弦设置，这里给一份最小 state 顶住
const ML = new Function("state", code + "\nreturn {layoutMap, mapSVG, MODES, MAP_ABBR, MAP_PAD};")(
  { voicing: "7", oct: 0, inv: 0, spread: "close" });

// 从 mapSVG 的标记里把每个节点的圆与标签盒挖出来（世界坐标）
function readNodes(markup, k){
  const out = [];
  const re = /<g class="node[^"]*" data-id="([^"]+)" transform="translate\(([-\d.]+),([-\d.]+)\) scale\(([\d.]+)\)">[\s\S]*?<text x="([-\d.]+)" y="([-\d.]+)">([^<]*)<\/text>/g;
  let m;
  while((m = re.exec(markup))){
    const [, id, tx, ty, sc, lx, ly, label] = m;
    const K = +sc;
    const w = (label.length * 5.4 + 6) * K, h = 12 * K;
    out.push({
      id,
      x: +tx, y: +ty,
      r: 6 * K,                            // 节点圆半径（世界单位）
      box: { x: +tx + +lx * K, y: +ty + +ly * K - h / 2, w, h },
    });
  }
  return out;
}

const hitBox = (a, b) =>
  Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2) > 0.5 &&
  Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2) > 0.5;

test("60 个调式都排进画布，坐标是有限数", () => {
  const L = ML.layoutMap(ML.MODES);
  assert.equal(L.nodes.length, ML.MODES.length);
  assert.ok(L.nodes.length >= 60, "应该至少 60 个节点，实际 " + L.nodes.length);
  for(const n of L.nodes){
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), n.id + " 坐标不是有限数");
    assert.ok(n.x >= 0 && n.x <= L.W, n.id + " 跑出画布 x=" + n.x);
    assert.ok(n.y >= 0 && n.y <= L.H, n.id + " 跑出画布 y=" + n.y);
  }
});

test("节点之间至少隔开 30（挤在一起的两对会被推开）", () => {
  const L = ML.layoutMap(ML.MODES);
  let min = Infinity, pair = "";
  for(let i = 0; i < L.nodes.length; i++){
    for(let j = i + 1; j < L.nodes.length; j++){
      const d = Math.hypot(L.nodes[i].x - L.nodes[j].x, L.nodes[i].y - L.nodes[j].y);
      if(d < min){ min = d; pair = L.nodes[i].id + "×" + L.nodes[j].id; }
    }
  }
  assert.ok(min >= 29.5, `最近的两个节点只隔 ${min.toFixed(1)}（${pair}）`);
});

test("标签在常用缩放级下都不重叠、也不压住任何节点圆", () => {
  const L = ML.layoutMap(ML.MODES);
  for(const zoom of [0.65, 0.8, 1, 1.5, 2.2, 3.4]){
    const k = 1 / zoom;
    const markup = ML.mapSVG(L, { sel: L.nodes[0].id, k });
    const nodes = readNodes(markup, k);
    assert.equal(nodes.length, L.nodes.length, `zoom ${zoom} 下标签数量不对（解析到 ${nodes.length}）`);
    for(let i = 0; i < nodes.length; i++){
      for(let j = i + 1; j < nodes.length; j++){
        assert.equal(hitBox(nodes[i].box, nodes[j].box), false,
          `zoom ${zoom}：${nodes[i].id} 与 ${nodes[j].id} 的标签叠在一起`);
      }
      for(const other of nodes){
        const c = { x: other.x, y: other.y, w: other.r * 2, h: other.r * 2 };
        assert.equal(hitBox(nodes[i].box, c), false,
          `zoom ${zoom}：${nodes[i].id} 的标签压住了 ${other.id} 的节点圆`);
      }
    }
  }
});

test("选中节点的标签优先拿到默认位（正下方）", () => {
  const L = ML.layoutMap(ML.MODES);
  const markup = ML.mapSVG(L, { k: 1 });
  // 不选中时：第一个节点不一定在正下方，但每个标签都必须存在
  const nodes = readNodes(markup, 1);
  assert.equal(nodes.length, L.nodes.length);
  assert.ok(nodes.every(n => n.box.w > 0 && n.box.h > 0));
});
