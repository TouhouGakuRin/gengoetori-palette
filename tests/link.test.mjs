/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 分享链接编解码的测试（48-url-codec.js：不碰 DOM，直接 new Function 加载）
// 跑法：node tests/link.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, "..", "src", "js", "48-url-codec.js"), "utf8");
const API = new Function(
  code + "\nreturn {urlExToParam, urlExFromParam, urlDeckToParam, urlDeckFromParam, URL_CODEC_VERSION};"
)();

const isMode = id => id === "ion" || id === "dor";

const slot = (d, extra) => Object.assign(
  {m: null, d, n: null, inv: 0, spread: "close", beats: null, rest: false, ex: null}, extra);

test("编解码版本号是 2", () => {
  assert.equal(API.URL_CODEC_VERSION, 2);
});

test("普通槽位：级数 / 音数 / 转位 / 排列 / 拍数 原样回来", () => {
  const slots = [slot(0, {n: 4, inv: 2, spread: "open", beats: 3}), null, slot(5, {rest: true})];
  const back = API.urlDeckFromParam(API.urlDeckToParam(slots), isMode);
  assert.equal(back.length, 3);
  assert.deepEqual({d: back[0].d, n: back[0].n, inv: back[0].inv, sp: back[0].spread, b: back[0].beats},
    {d: 0, n: 4, inv: 2, sp: "open", b: 3});
  assert.equal(back[1], null);
  assert.equal(back[2].rest, true);
});

test("借来的和弦：根音 / 音高 / 拼写都保住，不会被还原成级数和弦", () => {
  const ex = {root: 1, tones: [1, 5, 8], ivs: [0, 4, 7], names: ["D♭", "F", "A♭"],
    kind: "borrow", roman: "♭II", symbol: ""};
  const back = API.urlDeckFromParam(API.urlDeckToParam([{...slot(0), ex}]), isMode);
  assert.equal(back[0].ex.root, 1);
  assert.deepEqual(back[0].ex.tones, [1, 5, 8]);
  assert.deepEqual(back[0].ex.ivs, [0, 4, 7]);
  assert.equal(back[0].ex.roman, "♭II");
  assert.equal(back[0].m, null, "ex 槽不能带级数，否则会被当成级数和弦读");
});

test("副属和弦的 kind 也能往返", () => {
  const ex = {root: 7, tones: [7, 11, 2], ivs: [0, 4, 7], names: [], kind: "secondary", roman: "V/V", symbol: "7"};
  const back = API.urlExFromParam(API.urlExToParam(ex));
  assert.equal(back.kind, "secondary");
  assert.equal(back.roman, "V/V");
});

test("坏数据丢掉那一格，不猜近似和弦", () => {
  assert.equal(API.urlDeckFromParam([{d: 99}], isMode)[0], null);
  assert.equal(API.urlDeckFromParam([{d: "x"}], isMode)[0], null);
  assert.equal(API.urlDeckFromParam([{x: {r: 0, t: []}}], isMode)[0], null);
  assert.equal(API.urlExFromParam({r: 0, t: []}), null);
});

test("不认识的调式 id 不写进槽位（否则渲染时找不到音阶）", () => {
  const back = API.urlDeckFromParam([{m: "no-such-mode", d: 0}], isMode);
  assert.equal(back[0].m, null);
  const ok = API.urlDeckFromParam([{m: "dor", d: 0}], isMode);
  assert.equal(ok[0].m, "dor");
});
