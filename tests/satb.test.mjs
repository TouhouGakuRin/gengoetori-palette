/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 四部和声：音域、顺序、低音、平行检测 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "js");
const code = ["07-core-satb.js"].map(f => readFileSync(join(src, f), "utf8")).join("\n");
const ML = new Function(code + "\nreturn {satbVoicing, satbCandidates, satbSequence, satbCheck, satbViolations, seventhOf, SATB_RANGE};")();

const R = ML.SATB_RANGE;

test("每个声部都落在音域里，且 S > A > T > B", () => {
  // Cmaj7 / G7 / Am7 / Fmaj7，各试原位与所有转位
  const chords = [[0,4,7,11], [7,11,2,5], [9,0,4,7], [5,9,0,4]];
  let checked = 0;
  for(const tones of chords){
    for(const bass of tones){
      const v = ML.satbVoicing(tones, bass);
      assert.ok(v, "应当解得出");
      assert.ok(v.S >= R.S[0] && v.S <= R.S[1], "S 越界 " + v.S);
      assert.ok(v.A >= R.A[0] && v.A <= R.A[1], "A 越界 " + v.A);
      assert.ok(v.T >= R.T[0] && v.T <= R.T[1], "T 越界 " + v.T);
      assert.ok(v.B >= R.B[0] && v.B <= R.B[1], "B 越界 " + v.B);
      assert.ok(v.S > v.A && v.A > v.T && v.T > v.B, "声部交叉 " + JSON.stringify(v));
      assert.equal(((v.B % 12) + 12) % 12, ((bass % 12) + 12) % 12, "低音不对 " + JSON.stringify(v));
      checked++;
    }
  }
  assert.ok(checked >= 16, "覆盖不足");
});

test("四音和弦用满四个声部，三音和弦允许重复但优先重复根音", () => {
  const v = ML.satbVoicing([0,4,7,11], 0);
  const pcs = [v.S, v.A, v.T, v.B].map(m => ((m % 12) + 12) % 12);
  // 允许省掉五音、重复根音（传统写法），但三音与七音不能重复
  assert.ok(pcs.every(p => [0,4,7,11].includes(p)), "出现了和弦外的音：" + pcs.join(","));
  assert.equal(pcs.filter(p => p === 11).length, 1, "七音应当只出现一次：" + pcs.join(","));
  assert.equal(pcs.filter(p => p === 4).length <= 1, true, "三音不该重复：" + pcs.join(","));

  const t = ML.satbVoicing([0,4,7], 0);
  const tp = [t.S, t.A, t.T, t.B].map(m => ((m % 12) + 12) % 12);
  const count = tp.filter(p => p === 0).length;
  assert.ok(count >= 2, "三和弦应该重复某音");
  assert.equal(tp.filter(p => p === 4).length <= 1 && tp.filter(p => p === 7).length <= 1, true, "不该重复三音或五音");
});

test("平行五/八度能被查出来，正常进行查不出", () => {
  const a = {S:72, A:67, T:60, B:48};   // C  C4 G4 C5
  const b = {S:74, A:69, T:62, B:50};   // 全部上行二度 → 满屏平行五/八
  const bad = ML.satbCheck(a, b);
  assert.ok(bad.length >= 2, "应当报出平行，实际 " + JSON.stringify(bad));

  const ok = [{S:72,A:64,T:55,B:48}, {S:71,A:62,T:55,B:43}, {S:69,A:60,T:52,B:45}];
  for(let i = 1; i < ok.length; i++){
    assert.deepEqual(ML.satbCheck(ok[i-1], ok[i]), [], "不该报：" + JSON.stringify(ok[i]));
  }
});

test("整条进行用 satbSequence 时，相邻两个和弦之间没有平行五八", () => {
  const seq = [
    {tones:[0,4,7,11], bassPc:0},
    {tones:[7,11,2,5], bassPc:7},
    {tones:[9,0,4,7], bassPc:9},
    {tones:[5,9,0,4], bassPc:5},
  ];
  const vs = ML.satbSequence(seq);
  assert.equal(vs.length, 4);
  for(let i = 1; i < vs.length; i++){
    assert.deepEqual(ML.satbCheck(vs[i-1], vs[i]), [], "第 " + i + " 个接缝有平行：" + JSON.stringify(ML.satbCheck(vs[i-1], vs[i])));
  }
});

/* ── 隐伏五八 ─────────────────────────────────────────── */

test("隐伏八度：外声部同向 + 高音跳进才会被查出来", () => {
  // S 从 G4 跳上去到 E5（+9），B 从 C3 上到 E3（+4）→ 同向、高音跳进、外声部成八度
  const leap = {S: 67, A: 64, T: 55, B: 48}, to = {S: 76, A: 64, T: 55, B: 52};
  const hit = ML.satbCheck(leap, to);
  assert.ok(hit.some(x => x.kind === "隐伏八度"), "该报隐伏八度：" + JSON.stringify(hit));

  // 同样的和声音程，但高音只走级进（G4→A4）—— 不算隐伏
  const step = {S: 69, A: 64, T: 55, B: 48};
  const calm = ML.satbCheck({S: 67, A: 64, T: 55, B: 48}, step);
  assert.equal(calm.some(x => x.kind === "隐伏八度"), false, "级进不该报隐伏：" + JSON.stringify(calm));
});

test("隐伏五度：外声部同向进入纯五度", () => {
  // S: G4 → C5（+5），B: C3 → F3（+5）→ 同向、高音跳进、外声部成五度
  const from = {S: 67, A: 64, T: 55, B: 48}, to = {S: 72, A: 65, T: 57, B: 53};
  const hit = ML.satbCheck(from, to);
  assert.ok(hit.some(x => x.kind === "隐伏五度" || x.kind === "隐伏八度"), "该报隐伏：" + JSON.stringify(hit));
});

test("内声部同向进纯五度不按隐伏算（只看外声部）", () => {
  // S 与 B 反向，中声部同向移动并构成五度
  const from = {S: 79, A: 64, T: 55, B: 48}, to = {S: 77, A: 67, T: 60, B: 43};
  const hit = ML.satbCheck(from, to);
  assert.equal(hit.some(x => x.kind === "隐伏五度" || x.kind === "隐伏八度"), false, "内声部不该报：" + JSON.stringify(hit));
});

/* ── 导音解决 ─────────────────────────────────────────── */

test("导音解决：外声部的导音要上行小二度到主音", () => {
  const tonic = 0;   // C 大调，导音是 B（11）
  const v = {S: 71, A: 64, T: 55, B: 48};          // 高音是导音 B4
  const up = {S: 72, A: 64, T: 55, B: 48};         // 上行半音到 C5 ✓
  assert.equal(ML.satbCheck(v, up, {tonic}).some(x => x.kind === "导音未解决"), false,
    "上行小二度不该报：" + JSON.stringify(ML.satbCheck(v, up, {tonic})));

  const down = {S: 69, A: 64, T: 55, B: 48};       // 下行到 A4 ✗
  assert.ok(ML.satbCheck(v, down, {tonic}).some(x => x.kind === "导音未解决"),
    "导音下行该报错：" + JSON.stringify(ML.satbCheck(v, down, {tonic})));

  // 低音上的导音同样要解决
  const vb = {S: 67, A: 64, T: 59, B: 47};         // 低音 B2
  const vb2 = {S: 67, A: 64, T: 60, B: 40};        // 低音跳到 E2 ✗
  assert.ok(ML.satbCheck(vb, vb2, {tonic}).some(x => x.kind === "导音未解决" && x.voices === "B"),
    "低音导音该报错：" + JSON.stringify(ML.satbCheck(vb, vb2, {tonic})));
});

test("导音解决：中声部的导音不在硬规矩里，不报", () => {
  const tonic = 0;
  const v = {S: 67, A: 71, T: 55, B: 48};          // 中音是 B4
  const v2 = {S: 67, A: 69, T: 55, B: 48};         // 下行到 A4
  assert.equal(ML.satbCheck(v, v2, {tonic}).some(x => x.kind === "导音未解决"), false,
    "内声部不按导音硬规矩报：" + JSON.stringify(ML.satbCheck(v, v2, {tonic})));
});

/* ── 七音解决 ─────────────────────────────────────────── */

test("七音解决：和弦七音要下行级进", () => {
  const seven = 11;                                 // Cmaj7 的七音 B
  const v = {S: 71, A: 64, T: 55, B: 48};
  const good = {S: 72, A: 67, T: 55, B: 48};        // B→C 上行？不对，这是上行
  assert.ok(ML.satbCheck(v, good, {seven}).some(x => x.kind === "七音未解决"),
    "七音上行该报错：" + JSON.stringify(ML.satbCheck(v, good, {seven})));

  const down = {S: 69, A: 64, T: 55, B: 48};        // B→A 下行大二度 ✓
  assert.equal(ML.satbCheck(v, down, {seven}).some(x => x.kind === "七音未解决"), false,
    "七音下行级进不该报：" + JSON.stringify(ML.satbCheck(v, down, {seven})));
});

test("间距：上三声部超过八度、T–B 超过十二度要报", () => {
  const wide = {S: 79, A: 64, T: 55, B: 43};        // S–A 15 半音、T–B 12 ✓
  const hit = ML.satbCheck({S: 77, A: 64, T: 55, B: 43}, wide);
  assert.ok(hit.some(x => x.kind === "间距过大" && x.voices === "S/A"), "S/A 间距该报：" + JSON.stringify(hit));

  const low = {S: 72, A: 64, T: 55, B: 35};         // T–B 20 半音
  const hit2 = ML.satbCheck({S: 71, A: 64, T: 55, B: 36}, low);
  assert.ok(hit2.some(x => x.kind === "间距过大" && x.voices === "T/B"), "T/B 间距该报：" + JSON.stringify(hit2));
});

/* ── 整条进行的综合体检 ────────────────────────────── */

test("satbSequence 写出来的 I–IV–V–I：没有平行/隐伏五八，也没有导音与七音问题", () => {
  const tonic = 0;
  const specs = [
    {tones:[0,4,7], bassPc:0},
    {tones:[5,9,0], bassPc:5},
    {tones:[7,11,2], bassPc:7},
    {tones:[0,4,7], bassPc:0},
  ];
  const vs = ML.satbSequence(specs, {tonic});
  assert.equal(vs.length, 4);
  const tones = specs.map(s => s.tones);
  const sevens = tones.map(t => ML.seventhOf(t));
  const bad = ML.satbViolations(vs, {tonic, sevenths: sevens, tones});
  assert.deepEqual(bad, [], "自动写出来的进行不该有硬伤：" + JSON.stringify(bad));
});

test("seventhOf 认得出七音，三和弦与六和弦不误判", () => {
  assert.equal(ML.seventhOf([0,4,7,11]), 11, "Cmaj7 的七音是 B");
  assert.equal(ML.seventhOf([7,11,2,5]), 5, "G7 的七音是 F");
  assert.equal(ML.seventhOf([0,4,7]), null, "三和弦没有七音");
  assert.equal(ML.seventhOf([0,3,7]), null);
});

test("旋律里的三全音跳进要报出来", () => {
  const v = {S: 72, A: 64, T: 55, B: 48};
  const tri = {S: 66, A: 64, T: 55, B: 48};       // S 从 C5 跳到 F♯4，六半音
  assert.ok(ML.satbCheck(v, tri).some(x => x.kind === "三全音跳进" && x.voices === "S"),
    "该报三全音：" + JSON.stringify(ML.satbCheck(v, tri)));
  const ok = {S: 71, A: 64, T: 55, B: 48};        // 半音
  assert.equal(ML.satbCheck(v, ok).some(x => x.kind === "三全音跳进"), false);
});
