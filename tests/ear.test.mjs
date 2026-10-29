/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 幻歌鸟调色盘 · 「在调里听」的纯函数测试（特征音 / 纯律 / 状态仓库的布尔键）
// 跑法：node tests/ear.test.mjs
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
  "05-store.js",
  "10-audio-engine.js",
];
const stateStub = { voicing: "7", inv: 0, spread: "close", oct: 0, a4: 440 };

function load() {
  const code = FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");
  const factory = new Function(
    "state",
    code +
      "\nreturn {MODES,TONICS,charNotes,REF_MAJOR,REF_MINOR,justFreq,justCents,JUST_RATIO," +
      "freqOf,planScale,planChord,createStore,PERSIST_TYPE};"
  );
  return factory(stateStub);
}
const ML = load();
const byId = id => ML.MODES.find(m => m.id === id);

/* ---------- 特征音 ---------- */

test("特征音：本位大小调自己没有特征音", () => {
  assert.deepEqual(ML.charNotes(byId("ion")).pcs, []);
  assert.deepEqual(ML.charNotes(byId("aeo")).pcs, []);
  assert.equal(ML.charNotes(byId("ion")).refName, "大调");
  assert.equal(ML.charNotes(byId("aeo")).refName, "自然小调");
});

test("特征音：六个教会调式各差一个音", () => {
  // 多利亚比自然小调多一个大六度（A），利底亚比大调多升四（F#）
  const cases = { dor: [9], phr: [1], lyd: [6], mix: [10], loc: [1, 6] };
  for (const [id, want] of Object.entries(cases)) {
    assert.deepEqual(ML.charNotes(byId(id)).pcs, want, id);
  }
});

test("特征音：和声小调的特征是还原七级，和声大调是降六", () => {
  assert.deepEqual(ML.charNotes(byId("hm")).pcs, [11]);
  assert.deepEqual(ML.charNotes(byId("hma")).pcs, [8]);
});

test("特征音：布鲁斯的蓝调五级音、全音阶的三个音", () => {
  assert.deepEqual(ML.charNotes(byId("blues")).pcs, [6]);      // ♭5
  assert.deepEqual(ML.charNotes(byId("wt0")).pcs, [6, 8, 10]); // 没有三度，跟大调比
});

test("特征音：五声宫调式的音全在大调里，没有特征音", () => {
  const gong = ML.MODES.find(m => m.id === "penG");
  assert.deepEqual(ML.charNotes(gong).pcs, []);
  const shang = ML.MODES.find(m => m.id === "penS");   // 商调式有闰（♭7）
  assert.deepEqual(ML.charNotes(shang).pcs, [10]);
});

test("特征音：参照音阶的选择看有没有小三度", () => {
  for (const m of ML.MODES) {
    const ch = ML.charNotes(m);
    assert.equal(ch.hasMinor3, m.pcs.includes(3), `${m.id} 的参照选择`);
    assert.equal(ch.refName, ch.hasMinor3 ? "自然小调" : "大调");
    // 特征音一定不在参照音阶里
    const ref = ch.hasMinor3 ? ML.REF_MINOR : ML.REF_MAJOR;
    for (const pc of ch.pcs) assert.equal(ref.includes(pc), false, `${m.id} 的 ${pc}`);
  }
});

/* ---------- 纯律 ---------- */

test("纯律：主音本身不动，五度是 3/2", () => {
  const a = ML.justFreq(60, 0, 440), b = ML.justFreq(67, 0, 440);
  assert.equal(a, ML.freqOf(60, 440));
  assert.ok(Math.abs(b / a - 1.5) < 1e-12, "纯五度应当是 1.5");
});

test("纯律：大三度低 14 音分、小三度高 16 音分", () => {
  assert.ok(Math.abs(ML.justCents(4) - (-13.686)) < 0.01);
  assert.ok(Math.abs(ML.justCents(3) - 15.641) < 0.01);
  assert.ok(Math.abs(ML.justCents(7) - 1.955) < 0.01);
  assert.equal(ML.justCents(0), 0);
});

test("纯律：十二个比的音分都落在 ±25 以内（5-limit 的常识）", () => {
  for (let d = 0; d < 12; d++) {
    assert.ok(Math.abs(ML.justCents(d)) < 25, `${d} 半音差太多`);
    assert.ok(ML.JUST_RATIO[d] > 0);
  }
});

test("纯律：换主音只改参照，不改比值", () => {
  const d = 4;
  const c = ML.justFreq(64, 0, 440) / ML.justFreq(60, 0, 440);
  const e = ML.justFreq(67, 3, 440) / ML.justFreq(63, 3, 440);   // Eb 上的大三度
  assert.ok(Math.abs(c - e) < 1e-12);
});

/* ---------- 状态仓库的布尔键 ---------- */

test("仓库：bool 键能存能取，脏值变 false", () => {
  assert.equal(ML.PERSIST_TYPE.drone, "bool");
  const st = ML.createStore({ drone: false, tuning: "et" });
  assert.equal(st.set("drone", 1), true);
  assert.equal(st.get("drone"), true);
  assert.equal(st.set("drone", 0), false);
  assert.equal(st.set("drone", "yes"), true, "非空串当真");
  assert.equal(st.set("drone", null), false);
});

test("仓库：tuning 只收 et / just", () => {
  const st = ML.createStore({ tuning: "et" });
  assert.equal(st.set("tuning", "just"), "just");
  assert.equal(st.set("tuning", "meantone"), "just", "非法值应当被忽略");
});

/* ---------- 播放计划的时间轴（高亮靠它） ---------- */

test("音阶计划：时间严格递增，末音是主音的高八度", () => {
  const t = ML.TONICS[0];
  for (const m of ML.MODES.slice(0, 20)) {
    const plan = ML.planScale(m, t, {});
    assert.equal(plan.length, m.pcs.length + 1);
    for (let i = 1; i < plan.length; i++) assert.ok(plan[i].at > plan[i - 1].at, m.id);
    assert.equal(((plan[plan.length - 1].midi - t.pc) % 12 + 12) % 12, 0);
    for (const e of plan) assert.ok(e.dur > 0 && e.vel > 0);
  }
});

/* 音符别拖太长：跑音阶时相邻音要能听出「一颗一颗」，
   0.34 秒 + 0.23 秒的间隔是用户认可的「最开始那种短」。
   改这些默认值会直接影响听感，所以钉在这里。 */
test("播放计划的默认时值够短（音阶 0.34 秒、末音 0.62 秒、和弦 0.95 秒）", () => {
  const t = ML.TONICS[0];
  const sc = ML.planScale(ML.MODES[0], t, {});
  for (const e of sc.slice(0, -1)) assert.ok(e.dur <= 0.4, "音阶单音时值 " + e.dur);
  assert.ok(sc[sc.length - 1].dur <= 0.7, "末音时值 " + sc[sc.length - 1].dur);
  assert.ok(sc[1].at - sc[0].at <= 0.3, "相邻音间隔 " + (sc[1].at - sc[0].at));
  const ch = ML.planChord(0, [0, 4, 7, 11], {});
  for (const e of ch) assert.ok(e.dur <= 1.0, "和弦时值 " + e.dur);
});
