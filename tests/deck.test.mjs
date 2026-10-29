/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 进行台：和弦音高必须跟着主音走（回归测试）
// 跑法：node tests/deck.test.mjs
//
// 起因：v17 的 deckMidis() 用 base = 60 + oct 当根音，漏掉了主音音级，
// 结果只有 C 调是对的 —— 主音选 Eb 时，谱面和 .mid 全都整体低了三个半音
// （I 级 Eb 被画成 C，IV 级 Ab 被画成 F）。这个文件锁住这条。
//
// 47-ui-deck.js 在装载时会挂事件，所以给一个极简的 DOM 壳。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "src", "js");

globalThis.localStorage = {
  d: {},
  getItem(k){ return Object.prototype.hasOwnProperty.call(this.d, k) ? this.d[k] : null; },
  setItem(k, v){ this.d[k] = String(v); },
  removeItem(k){ delete this.d[k]; },
  clear(){ this.d = {}; },
};

const FILES = [
  "00-core-pitch.js",
  "01-core-scales.js",
  "02-core-chords.js",
  "03-core-theory.js",
  "04-core-midi.js",
  "07-core-satb.js",
  "08-core-rhythm.js",
  "20-render-staff.js",
  "47-ui-deck.js",
];

// 装载壳：\$ / document / uiRegister 都是桩；tonicObj 用参数里的主音
const SHIM = `
const __el = () => ({ classList: {add(){}, remove(){}, toggle(){}}, style: {}, dataset: {},
  innerHTML: "", textContent: "", value: "", clientWidth: 900,
  setAttribute(){}, getBoundingClientRect(){ return {top:0,left:0,width:900,height:200}; }});
const $ = () => __el();
const document = { getElementById: () => __el(), querySelectorAll: () => [] };
const uiRegister = () => {};
let staffView = "scale";
const byId = (id) => MODES.find(m => m.id === id);
const tonicObj = () => TONICS[__TONIC__];
const curTonicName = () => TONICS[__TONIC__].li === 3 ? "Eb" : "?";
const curBpm = () => 96;
const activeMode = () => MODES[0];
`;

function load(tonicIdx, stateStub){
  const code = SHIM.replace("__TONIC__", String(tonicIdx))
    + FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n")
    + "\nreturn {deck, deckMidis, slotVoicing, deckStaffGroups, deckSatbAudit, TONICS, LETTERS};";
  const factory = new Function("state", code);
  return factory(stateStub || { voicing: "7", oct: 0, a4: 440, inv: 0, spread: "close", A: "ion", tone: tonicIdx });
}

const EL = load(0).TONICS.findIndex(t => t.pc === 3);   // Eb
const CI = load(0).TONICS.findIndex(t => t.pc === 0);   // C

const slot = (d, extra) => Object.assign(
  { m: "ion", d: d, n: 4, inv: 0, spread: "close", beats: 4, rest: false }, extra || {});

const pcs = arr => arr.map(x => ((Math.round(x) % 12) + 12) % 12);

test("进行台：主音 Eb 上的 I–IV–V–VI 音高跟着主音走", () => {
  const ML = load(EL);
  ML.deck.slots = [slot(0), slot(3), slot(4), slot(5), null, null, null, null];
  const mid = ML.deckMidis();
  assert.deepEqual(pcs(mid[0]), [3, 7, 10, 2], "I 级应该是 Eb G Bb D");
  assert.deepEqual(pcs(mid[1]), [8, 0, 3, 7], "IV 级应该是 Ab C Eb G");
  assert.deepEqual(pcs(mid[2]), [10, 2, 5, 8], "V 级应该是 Bb D F Ab");
  assert.deepEqual(pcs(mid[3]), [0, 3, 7, 10], "VI 级应该是 C Eb G Bb");
});

test("进行台：C 调仍然对（别为了修 Eb 把 C 弄坏）", () => {
  const ML = load(CI);
  ML.deck.slots = [slot(0), slot(3), slot(4), null, null, null, null, null];
  const mid = ML.deckMidis();
  assert.deepEqual(pcs(mid[0]), [0, 4, 7, 11]);
  assert.deepEqual(pcs(mid[1]), [5, 9, 0, 4]);
  assert.deepEqual(pcs(mid[2]), [7, 11, 2, 5]);
});

test("进行台：谱面音名与和弦名对得上（Eb 的 I 级画成 Eb G Bb D）", () => {
  const ML = load(EL);
  ML.deck.slots = [slot(0), slot(3), null, null, null, null, null, null];
  const g = ML.deckStaffGroups();
  const name = n => "CDEFGAB"[n.li] + (n.nacc > 0 ? "#".repeat(n.nacc) : n.nacc < 0 ? "b".repeat(-n.nacc) : "");
  assert.equal(g.tre[0].notes.map(name).join(" "), "Eb G Bb D", "右手是 Ebmaj7");
  assert.equal(g.bas[0].notes.map(name).join(" "), "Eb", "左手是根音 Eb");
});

test("进行台：休止槽位不发音，其余槽位序号不变", () => {
  const ML = load(EL);
  ML.deck.slots = [slot(0), slot(0, { rest: true }), slot(4), null, null, null, null, null];
  const mid = ML.deckMidis();
  assert.equal(mid[1], null, "休止槽位应该是 null");
  assert.deepEqual(pcs(mid[2]), [10, 2, 5, 8], "休止后面的槽位不能错位");
});

test("进行台：一条进行共用一个八度位置，不许逐个和弦上下跳", () => {
  // 以前每个和弦各自按「中点在 G4」挪八度：Eb 上 I 在 63–74、IV 掉到 56–67，
  // 听着就是音区乱跳。现在整条只挪一次。
  const ML = load(EL);
  ML.deck.slots = [slot(0), slot(3), slot(4), slot(5), null, null, null, null];
  const mid = ML.deckMidis().filter(Boolean);
  const all = mid.flat();
  assert.ok(Math.max(...all) - Math.min(...all) < 24,
    `整条进行的音域应该在一个八度左右，实测 ${Math.min(...all)}–${Math.max(...all)}`);
  // 相邻两个和弦之间，任何一个声部都不许跳出 ±12（同和弦内本来就跨到 11）
  for(let i = 1; i < mid.length; i++){
    const a = mid[i-1], b = mid[i];
    for(const x of a) for(const y of b){
      assert.ok(Math.abs(x - y) <= 17, `槽 ${i} → ${i+1} 有 ${x}→${y} 的跳进`);
    }
  }
});

test("进行台：八度开关整体 ±12，且不影响和弦本身", () => {
  const ML = load(EL);
  ML.deck.slots = [slot(0), slot(3), slot(4), null, null, null, null, null];
  ML.deck.oct = 0;
  const base = ML.deckMidis().filter(Boolean);
  ML.deck.oct = 1;
  const up = ML.deckMidis().filter(Boolean);
  ML.deck.oct = -2;
  const down = ML.deckMidis().filter(Boolean);
  ML.deck.oct = 0;
  for(let i = 0; i < base.length; i++){
    assert.deepEqual(up[i].map(v => v - 12), base[i], "升八度要整体 +12");
    assert.deepEqual(down[i].map(v => v + 24), base[i], "降两个八度要整体 −24");
  }
});

/* v18.5：借来的和弦 / 副属和弦可以进进行台 —— 槽位带 ex 字段，
   音高来自它自己带的 pcs，谱面按它自己的根音拼写 */
const exSlot = (root, tones, names, roman, symbol, kind) => ({
  m: null, d: 0, n: tones.length, inv: 0, spread: "close", beats: 4, rest: false,
  ex: { root: root, tones: tones, ivs: tones.map(t => ((t - root) % 12 + 12) % 12),
    names: names, roman: roman, symbol: symbol, kind: kind || "borrow" } });

test("进行台：借来的 bVII 按它自己的根音发声（C 调 ♭VII = Bb7）", () => {
  const ML = load(CI);
  ML.deck.oct = 0;
  ML.deck.slots = [exSlot(10, [10, 2, 5, 8], ["Bb", "D", "F", "Ab"], "bVII", "Bb7"),
    null, null, null, null, null, null, null];
  const mid = ML.deckMidis()[0];
  assert.deepEqual(pcs(mid), [10, 2, 5, 8], "应该是 Bb D F Ab");
});

test("进行台：副属和弦 V7/V 与邻槽连起来仍是同一套音高位置", () => {
  const ML = load(CI);
  ML.deck.oct = 0;
  ML.deck.slots = [exSlot(2, [2, 6, 9, 0], ["D", "F#", "A", "C"], "V7/V", "D7", "secondary"),
    slot(4), null, null, null, null, null, null];
  const mid = ML.deckMidis();
  assert.deepEqual(pcs(mid[0]), [2, 6, 9, 0], "V7/V = D F# A C");
  assert.deepEqual(pcs(mid[1]), [7, 11, 2, 5], "V 级仍是 G B D F");
  const all = mid.filter(Boolean).flat();
  assert.ok(Math.max(...all) - Math.min(...all) < 24, "两个和弦应该落在同一个八度里");
});

test("进行台：借来的和弦在谱面上按自己的根音拼写（Bb 不写成 A#）", () => {
  const ML = load(CI);
  ML.deck.oct = 0;
  ML.deck.slots = [exSlot(10, [10, 2, 5, 8], ["Bb", "D", "F", "Ab"], "bVII", "Bb7"),
    null, null, null, null, null, null, null];
  const g = ML.deckStaffGroups({});
  const ups = g.tre[0].notes.map(n => ML.LETTERS[n.li] + (n.nacc < 0 ? "b" : n.nacc > 0 ? "#" : ""));
  assert.deepEqual(ups.sort(), ["Ab", "Bb", "D", "F"], `拼写应该是 Bb D F Ab，实测 ${ups}`);
});

test("进行台：四行谱把 S/A/T/B 拆成四条单音声部", () => {
  const ML = load(CI);
  ML.deck.oct = 0;
  ML.deck.satb = true;
  ML.deck.slots = [slot(0), slot(3), slot(4), slot(0), null, null, null, null];
  const g = ML.deckStaffGroups({});
  for(const v of ["S", "A", "T", "B"]){
    assert.equal(g[v].length, 4, `${v} 应该有 4 列`);
    assert.ok(g[v].every(x => x.notes.length === 1), `${v} 每列只有一个音`);
  }
  // 四行合起来必须等于原来的两行谱：S/A 在高音行，T/B 在低音行
  for(let i = 0; i < 4; i++){
    assert.deepEqual(g.S[i].notes[0], g.tre[i].notes[0]);
    assert.deepEqual(g.A[i].notes[0], g.tre[i].notes[1]);
    assert.deepEqual(g.T[i].notes[0], g.bas[i].notes[0]);
    assert.deepEqual(g.B[i].notes[0], g.bas[i].notes[1]);
  }
  ML.deck.satb = false;
});
