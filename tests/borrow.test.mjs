/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 幻歌鸟调色盘 · 借用与副属和弦测试
// 跑法：node tests/borrow.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "src", "js");
const FILES = [
  "00-core-pitch.js",
  "01-core-scales.js",
  "02-core-chords.js",
  "03-core-theory.js",
  "09-core-borrow.js",
];
const stateStub = { voicing: "7", inv: 0, spread: "close" };

function load() {
  const code = FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");
  const factory = new Function(
    "state",
    code +
      "\nreturn {MODES,TONICS,borrowChords,secondaryDominants,outsideChords,parallelScale," +
      "romanShape,tertianNames,chordOf,spell};"
  );
  return factory(stateStub);
}
const ML = load();
const byId = id => ML.MODES.find(m => m.id === id);
const tonicOf = pc => ML.TONICS.find(t => t.pc === pc);
const ionian = byId("ion"), aeolian = byId("aeo");

test("C 大调借用小调：Cm7 · Dm7b5 · Ebmaj7 · Fm7 · Gm7 · Abmaj7 · Bb7", () => {
  const list = ML.borrowChords(ionian, tonicOf(0), 4);
  assert.equal(list.length, 7);
  const syms = list.map(x => x.symbol);
  assert.deepEqual(syms, ["Cm7", "Dm7b5", "Ebmaj7", "Fm7", "Gm7", "Abmaj7", "Bb7"]);
  // 级数记号：小写的 iv / v，降号的 bIII / bVI / bVII
  const romans = list.map(x => x.roman);
  assert.ok(romans.includes("iv") && romans.includes("v"), "小三和弦要小写");
  assert.ok(romans.includes("bIII") && romans.includes("bVI") && romans.includes("bVII"));
});

test("借来的和弦必须至少有一个音不在本音阶里", () => {
  for(const [mid, pc] of [["ion", 0], ["dor", 2], ["mix", 7], ["aeo", 9], ["hm", 2]]){
    const m = byId(mid), t = tonicOf(pc);
    for(const c of ML.borrowChords(m, t, 4)){
      const outside = c.tones.filter(p => m.pcs.indexOf((((p - t.pc) % 12) + 12) % 12) < 0);
      assert.ok(outside.length > 0, `${mid}/${pc} 的 ${c.symbol} 一个外音都没有`);
    }
  }
});

test("借用方向和特征音同一条规矩：有 ♭3 就去借大调", () => {
  assert.equal(ML.parallelScale(ionian).id, "aeo");
  assert.equal(ML.parallelScale(aeolian).id, "ion");
  assert.equal(ML.parallelScale(byId("dor")).id, "ion");     // 多利亚有小三度
  assert.equal(ML.parallelScale(byId("lyd")).id, "aeo");     // 利底亚没有
});

test("A 小调借大调：六个常用和弦都在，且都是外来的", () => {
  const list = ML.borrowChords(aeolian, tonicOf(9), 3);
  const syms = list.map(x => x.symbol);
  for(const s of ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"]){
    assert.ok(syms.includes(s), `A 小调的借用里应该有 ${s}，实际 ${syms.join(" ")}`);
  }
});

test("降号调里借来的和弦用降号写（Eb 大调的 ♭VI 是 Cb，不是 B）", () => {
  const t = tonicOf(3);   // Eb
  const list = ML.borrowChords(ionian, t, 3);
  const b6 = list.find(x => x.roman === "bVI");
  assert.ok(b6, "Eb 大调应该借得到 ♭VI");
  assert.ok(b6.symbol.startsWith("Cb"), `♭VI 的根音应写成 Cb，实际 ${b6.symbol}`);
});

test("C 大调的六个副属和弦：V7/ii … V7/vii", () => {
  const list = ML.secondaryDominants(ionian, tonicOf(0), 4);
  assert.equal(list.length, 6);
  assert.deepEqual(list.map(x => x.roman),
    ["V7/ii", "V7/iii", "V7/IV", "V7/V", "V7/vi", "V7/vii°"]);
  // 根音依次是 A B C D E F#
  assert.deepEqual(list.map(x => x.symbol), ["A7", "B7", "C7", "D7", "E7", "F#7"]);
});

test("V7/IV 要写成 C7 = C E G Bb（不能写成 A#）", () => {
  const list = ML.secondaryDominants(ionian, tonicOf(0), 4);
  const v4 = list.find(x => x.roman === "V7/IV");
  assert.equal(v4.symbol, "C7");
  assert.deepEqual(v4.names, ["C", "E", "G", "Bb"]);
  assert.deepEqual(v4.tones, [0, 4, 7, 10]);
});

test("V7/vii 是三全音关系的 F#7，四个音都在 C 大调之外", () => {
  const v7 = ML.secondaryDominants(ionian, tonicOf(0), 4).find(x => x.roman === "V7/vii°");
  assert.equal(v7.symbol, "F#7");
  assert.deepEqual(v7.names, ["F#", "A#", "C#", "E"]);
  assert.equal(v7.targetPc, 11);
});

test("大三和弦 / 属七和弦随音数切换", () => {
  const tri = ML.secondaryDominants(ionian, tonicOf(0), 3);
  assert.equal(tri[0].roman, "V/ii");
  assert.equal(tri[0].symbol, "A");
  assert.deepEqual(tri[0].tones, [9, 1, 4]);
  const b3 = ML.borrowChords(ionian, tonicOf(0), 3).map(x => x.symbol);
  assert.ok(b3.includes("Eb") && b3.includes("Fm") && b3.includes("Bb"));
});

test("五声/对称音阶不谈借用与副属", () => {
  for(const id of ["penG", "penS", "wt0", "blues"]){
    const m = byId(id);
    assert.equal(ML.borrowChords(m, tonicOf(0), 4).length, 0, id + " 不该有借用和弦");
    assert.equal(ML.secondaryDominants(m, tonicOf(0), 4).length, 0, id + " 不该有副属和弦");
  }
});

test("outsideChords 一次给齐两组，并带上平行调名字", () => {
  const o = ML.outsideChords(ionian, tonicOf(0), 4);
  assert.equal(o.borrow.length, 7);
  assert.equal(o.second.length, 6);
  assert.equal(o.parallel.cn, "同主音小调");
  assert.equal(ML.outsideChords(aeolian, tonicOf(9), 4).parallel.cn, "同主音大调");
});

test("三度拼写：d 小调的借用♭VI 是 Bb 大三和弦，不是 A#", () => {
  const d = tonicOf(2);
  const list = ML.borrowChords(ionian, d, 3);   // D 大调借 D 小调
  const b6 = list.find(x => x.roman === "bVI");
  assert.ok(b6, "D 大调应借得到 ♭VI");
  assert.equal(b6.symbol, "Bb");
  assert.deepEqual(b6.names, ["Bb", "D", "F"]);
});
