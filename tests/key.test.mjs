/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 幻歌鸟调色盘 · 调号测试（非七声：以调式根音为准 + 大小调色彩）
// 跑法：node tests/key.test.mjs
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
];
const stateStub = { voicing: "7", inv: 0, spread: "close" };

function load() {
  const code = FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");
  const factory = new Function(
    "state",
    code +
      "\nreturn {MODES,TONICS,spell,keySigAcc,bestKeySig,keyFifthsFor,keyColorOf,keyNotesOfFifths," +
      "fifthsOfTonic,keySigName,keySigLabel,pentaMode,PENTA_IDS,IONIAN};"
  );
  return factory(stateStub);
}
const ML = load();
const byId = id => ML.MODES.find(m => m.id === id);
const tonicOf = pc => ML.TONICS.find(t => t.pc === pc);

test("五声旋宫：宫商徵按大调、角羽按小调挂调号", () => {
  assert.equal(ML.keyColorOf(byId("penG")), "major");
  assert.equal(ML.keyColorOf(byId("penS")), "major");
  assert.equal(ML.keyColorOf(byId("penZ")), "major");
  assert.equal(ML.keyColorOf(byId("penJ")), "minor");
  assert.equal(ML.keyColorOf(byId("penY")), "minor");
});

test("五声旋宫在主音 C 上：宫商徵按大调、角羽按小调", () => {
  const C = tonicOf(0);
  assert.equal(ML.keyFifthsFor(byId("penG"), C), 0, "宫 = C 大调");
  assert.equal(ML.keyFifthsFor(byId("penS"), C), 0, "商的主音还是 C → C 大调");
  assert.equal(ML.keyFifthsFor(byId("penZ"), C), 0, "徵的主音还是 C → C 大调");
  assert.equal(ML.keyFifthsFor(byId("penJ"), C), -3, "角按小调 → C 小调三个降号");
  assert.equal(ML.keyFifthsFor(byId("penY"), C), -3, "羽按小调 → C 小调三个降号");
});

test("同一套五声音：调号跟着主音走，而不是跟着宫走", () => {
  // 商调式主音 D：按主音 D 的大调（2 个升号），不是按宫 C（0 个升号）
  assert.equal(ML.keyFifthsFor(byId("penS"), tonicOf(2)), 2);
  // 角调式主音 E：按 E 小调（1 个升号）
  assert.equal(ML.keyFifthsFor(byId("penJ"), tonicOf(4)), 1);
  // 羽调式主音 A：按 A 小调（无升降）
  assert.equal(ML.keyFifthsFor(byId("penY"), tonicOf(9)), 0);
  // 徵调式主音 G：按 G 大调（1 个升号）
  assert.equal(ML.keyFifthsFor(byId("penZ"), tonicOf(7)), 1);
  // 角调式主音 A：A 小调
  assert.equal(ML.keyFifthsFor(byId("penJ"), tonicOf(9)), 0);
});

test("调号由拼写出来的主音决定：C♯ 与 D♭ 不同号", () => {
  const Cs = ML.TONICS.find(t => t.pc === 1);     // C♯
  const Db = ML.TONICS.find(t => t.pc === 1) || {};
  assert.equal(ML.fifthsOfTonic({li: 0, acc: 1}), 7, "C♯ 大调七个升号");
  assert.equal(ML.fifthsOfTonic({li: 1, acc: -1}), -5, "D♭ 大调五个降号");
  // 主音 A♯ 的 C♯ 类极端情况夹在 ±7 之内
  assert.equal(ML.fifthsOfTonic({li: 6, acc: 1}), 7);
});

test("所有调式 × 所有主音：记号不会叠成重升重降", () => {
  // 挂上调号以后，每个音与调号的差只允许是 0 或 ±1（±2 就是重升/重降，谱面读不出来）
  for(const m of ML.MODES){
    for(const t of ML.TONICS){
      const f = ML.keyFifthsFor(m, t);
      const sp = ML.spell(m, t);
      for(const s of sp){
        const alt = s.nacc - ML.keySigAcc(f, s.li);
        assert.ok(Math.abs(alt) <= 1,
          `${m.id} 主音 ${t.pc}：${s.name} 与调号差 ${alt} 个记号（调号 ${ML.keySigName(f)}）`);
      }
    }
  }
});

test("大调布鲁斯在 E♭：按 E♭ 大调挂三个降号，只有 ♭5 要写降号", () => {
  const m = byId("mblues"), t = tonicOf(3);   // E♭ 主音（li=2, acc=-1）
  assert.equal(ML.keyColorOf(m), "major");
  assert.equal(ML.keyFifthsFor(m, t), -3, "E♭ 大调");
  const sp = ML.spell(m, t);
  assert.deepEqual(sp.map(s => s.name), ["Eb", "F", "Gb", "G", "Bb", "C"], "降号体系拼写");
  // E♭ 大调的调号是 B♭ E♭ A♭ —— 音阶里只有 G♭ 不在调号内，其余（包括 G♮、C♮）都是白键
  const acc = sp.filter(s => s.nacc !== ML.keySigAcc(-3, s.li)).map(s => s.name);
  assert.deepEqual(acc, ["Gb"], "只有 ♭5 要写降号");
});

test("半音阶不挂调号（十二个音塞不进任何调号）", () => {
  const m = byId("chrom");
  for(const t of ML.TONICS) assert.equal(ML.keyFifthsFor(m, t), 0);
});

test("keyNotesOfFifths 与 bestKeySig 互为反函数", () => {
  for(let f = -7; f <= 7; f++){
    const notes = ML.keyNotesOfFifths(f);
    const back = ML.bestKeySig(notes);
    assert.equal(back.f, f, `f=${f} 喂进 bestKeySig 应该原样换回来`);
    assert.equal(back.cost, 0, `f=${f} 的调号不需要额外临时记号`);
  }
});

test("调式色彩：布鲁斯按名字、无三级的按亮度", () => {
  assert.equal(ML.keyColorOf(byId("mblues")), "major", "大调布鲁斯");
  assert.equal(ML.keyColorOf(byId("blues")), "minor", "小调布鲁斯");
  assert.equal(ML.keyColorOf(byId("ion")), "major");
  assert.equal(ML.keyColorOf(byId("aeo")), "minor");
  assert.equal(ML.keyColorOf(byId("hm")), "minor");
});
