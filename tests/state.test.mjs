/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 状态仓库 + 音频计划 的测试
// 跑法：node tests/state.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "src", "js");

// --- 把 localStorage 换成内存版，测试才能检查“写了什么” ---
const LS = {
  d: {},
  getItem(k){ return Object.prototype.hasOwnProperty.call(this.d, k) ? this.d[k] : null; },
  setItem(k, v){ this.d[k] = String(v); },
  removeItem(k){ delete this.d[k]; },
  clear(){ this.d = {}; },
};
globalThis.localStorage = LS;

const FILES = [
  "00-core-pitch.js",
  "01-core-scales.js",
  "02-core-chords.js",
  "03-core-theory.js",
  "04-core-midi.js",
  "05-store.js",
  "10-audio-engine.js",
];

function load(stateStub) {
  const code = FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");
  const factory = new Function(
    "state",
    code +
      "\nreturn {createStore,planScale,planChord,planDegree,freqOf,A4_DEFAULT,chordVoicing,spell,MODES,TONICS,PERSIST_KEY};"
  );
  return factory(stateStub || { voicing: "7", oct: 0, a4: 440, inv: 0, spread: "close" });
}
const ML = load();

/* ---------------- store ---------------- */

test("store：set 改值并通知一次，同值不通知", () => {
  const s = ML.createStore({ a: 1 });
  let n = 0;
  s.subscribe(() => n++);
  s.set("a", 2);
  s.set("a", 2);
  assert.equal(s.get("a"), 2);
  assert.equal(n, 1, "同值不应该再通知");
  s.set("a", 3);
  assert.equal(n, 2);
});

test("store：all() 返回的就是 state 本体（老代码直接改也能读回来）", () => {
  const s = ML.createStore({ a: 1 });
  const data = s.all();
  data.a = 9;
  assert.equal(s.get("a"), 9);
});

test("store：按表持久化，键名与类型都对", () => {
  LS.clear();
  const s = ML.createStore({ oct: 0, a4: 440, voicing: "7" });
  s.set("oct", 1);
  s.set("a4", 442.5);
  s.set("voicing", "3");
  assert.equal(LS.getItem("mlab-oct"), "1");
  assert.equal(LS.getItem("mlab-a4"), "442.5");
  assert.equal(LS.getItem("mlab-voicing"), "3");
});

test("store：范围与枚举守卫生效", () => {
  const s = ML.createStore({ oct: 0, a4: 440, inv: 0, voicing: "7", spread: "close", theme: "dark" });
  s.set("oct", 9);   assert.equal(s.get("oct"), 2);
  s.set("oct", -9);  assert.equal(s.get("oct"), -2);
  s.set("a4", 999);  assert.equal(s.get("a4"), 480);
  s.set("a4", 100);  assert.equal(s.get("a4"), 400);
  s.set("inv", 7);   assert.equal(s.get("inv"), 3);
  s.set("voicing", "5"); assert.equal(s.get("voicing"), "7", "非法枚举应被忽略");
  s.set("spread", "wide"); assert.equal(s.get("spread"), "close");
});

test("store：load 只接受合法值", () => {
  LS.clear();
  const s1 = ML.createStore({ oct: 0, a4: 440, voicing: "7", spread: "close", inv: 0, theme: "dark" });
  s1.set("oct", 2); s1.set("a4", 432); s1.set("voicing", "3");
  const s2 = ML.createStore({ oct: 0, a4: 440, voicing: "7", spread: "close", inv: 0, theme: "dark" });
  s2.load();
  assert.deepEqual([s2.get("oct"), s2.get("a4"), s2.get("voicing")], [2, 432, "3"]);

  LS.clear();
  LS.setItem("mlab-oct", "9");        // 越界
  LS.setItem("mlab-a4", "abc");       // 非数字
  LS.setItem("mlab-voicing", "5");    // 非法枚举
  LS.setItem("mlab-theme", "light");  // 合法
  const s3 = ML.createStore({ oct: 0, a4: 440, voicing: "7", spread: "close", inv: 0, theme: "dark" });
  s3.load();
  assert.deepEqual([s3.get("oct"), s3.get("a4"), s3.get("voicing")], [0, 440, "7"]);
  assert.equal(s3.get("theme"), "light");
});

/* ---------------- 音频计划 ---------------- */

test("freqOf：十二平均律，A4=440 与自定义参考都正确", () => {
  assert.equal(ML.freqOf(69, 440), 440);
  assert.equal(ML.freqOf(81, 440), 880);
  assert.equal(ML.freqOf(57, 440), 220);
  assert.ok(Math.abs(ML.freqOf(60, 440) - 261.6256) < 0.001);
  assert.equal(ML.freqOf(69, 442), 442);
  // 同一个音，A4 换成 442 时整条曲线上移同等比例
  assert.ok(Math.abs(ML.freqOf(69, 442) / ML.freqOf(69, 432) - 442 / 432) < 1e-12);
  assert.ok(Math.abs(ML.freqOf(60, 442) / ML.freqOf(60, 440) - 442 / 440) < 1e-12);
});

test("planScale：七级 + 高八度，严格递增，八度参数生效", () => {
  const ion = ML.MODES.find(m => m.id === "ion");
  const c = ML.TONICS[0];
  for (const oct of [-2, 0, 1]) {
    const ev = ML.planScale(ion, c, { oct });
    assert.equal(ev.length, 8);
    for (let i = 1; i < ev.length; i++) {
      assert.ok(ev[i].midi > ev[i - 1].midi, `oct=${oct} 第${i}个音没递增`);
      assert.ok(ev[i].at > ev[i - 1].at);
    }
    assert.equal(ev[0].midi, 48 + oct * 12);
    assert.equal(ev[7].midi, ev[0].midi + 12);
  }
});

test("planScale：跨小节的小调式也不乱（B 开始的和声小调）", () => {
  const hm = ML.MODES.find(m => m.id === "hm");
  const b = ML.TONICS.find(t => t.pc === 11);
  const ev = ML.planScale(hm, b, { oct: 0 });
  assert.equal(ev.length, 8);
  assert.equal(ev[0].midi % 12, 11);
  assert.equal(ev[7].midi, ev[0].midi + 12);
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].midi > ev[i - 1].midi);
});

test("planChord：根音是最低音，arp 只改时间不改音高", () => {
  const flat = ML.planChord(0, [0, 4, 7, 11], { oct: 0 });
  assert.equal(flat.length, 4);
  assert.equal(flat[0].midi, 48);
  assert.deepEqual(flat.map(e => e.midi), [48, 52, 55, 59]);
  assert.equal(new Set(flat.map(e => e.at)).size, 1, "不分解时应同时发声");

  const arp = ML.planChord(0, [0, 4, 7, 11], { oct: 0, arp: true, gap: 0.1 });
  assert.deepEqual(arp.map(e => e.midi), [48, 52, 55, 59]);
  assert.deepEqual(arp.map(e => +e.at.toFixed(3)), [0, 0.1, 0.2, 0.3]);
});

test("planChord：转位的根音会被抬到自身之上", () => {
  // 以 A(9) 为根，和弦音 C(0) 应在根音之上
  const ev = ML.planChord(9, [9, 0, 4], { oct: 0 });
  assert.equal(ev[0].midi, 57);            // A3
  assert.ok(ev.every(e => e.midi >= 57));
});

test("planDegree：voiced 与 chordVoicing 完全对应", () => {
  const dor = ML.MODES.find(m => m.id === "dor");
  const c = ML.TONICS[0];
  for (const inv of [0, 1, 2, 3]) {
    for (const spread of ["close", "open"]) {
      const v = ML.chordVoicing(dor, 3, { inv, spread, voicing: "7" });
      const ev = ML.planDegree(dor, 3, c, { voiced: true, inv, spread, oct: 0 });
      assert.deepEqual(ev.map(e => e.midi), v.off.map(o => 48 + ((c.pc + dor.pcs[3]) % 12) + o));
    }
  }
});

test("planDegree：非 voiced 时走密集叠三度，音高类与 chordOf 一致", () => {
  const ion = ML.MODES.find(m => m.id === "ion");
  const c = ML.TONICS[0];
  const ev = ML.planDegree(ion, 4, c, { oct: 0, voicing: "7" });
  assert.equal(ev.length, 4);
  assert.equal(ev[0].midi % 12, 7);                  // G
  const pcs = ev.map(e => e.midi % 12).sort((a, b) => a - b);
  assert.deepEqual(pcs, [2, 5, 7, 11]);              // G B D F
});
