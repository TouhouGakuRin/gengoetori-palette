/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 幻歌鸟调色盘 · 全局设置的纯函数测试（音色表 / 新持久化键）
// 跑法：node tests/settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "src", "js");
const FILES = ["00-core-pitch.js", "01-core-scales.js", "05-store.js", "10-audio-engine.js"];

// localStorage 桩：只记内存，读写都过一遍
const LS = new Map();
const localStorageStub = {
  getItem: k => (LS.has(k) ? LS.get(k) : null),
  setItem: (k, v) => { LS.set(k, String(v)); },
  removeItem: k => { LS.delete(k); },
};

function load() {
  const code = FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");
  const factory = new Function(
    "state", "localStorage",
    code +
      "\nreturn {TIMBRES,timbreOf,setTimbre,timbreName,createStore,PERSIST_ENUM,PERSIST_KEY,read};"
  );
  return factory({ voicing: "7", inv: 0, spread: "close", oct: 0, a4: 440 }, localStorageStub);
}
const ML = load();

/* ---------- 音色表 ---------- */

test("音色表：五种都在，且每种的字段齐全", () => {
  for(const k of ["tri", "piano", "ep", "organ", "sine"]){
    const T = ML.TIMBRES[k];
    assert.ok(T, `缺音色 ${k}`);
    assert.ok(T.cn && T.en && T.hint, `${k} 缺名字或说明`);
    assert.ok(T.oscs.length >= 1, `${k} 至少一个分音`);
    assert.ok(T.attack >= 0 && T.decay > 0 && T.release > 0, `${k} 包络参数不合法`);
    assert.ok(T.hold >= 0 && T.hold <= 1, `${k} 的 hold 应在 0..1`);
    assert.ok(T.gain > 0 && T.gain <= 0.3, `${k} 的 gain 应在 (0, 0.3]`);
  }
});

test("音色表：分音从基频开始、逐级递增、幅度递减", () => {
  for(const k in ML.TIMBRES){
    const oscs = ML.TIMBRES[k].oscs;
    assert.equal(oscs[0][0], 1, `${k} 第一个分音必须是基频`);
    let prevRatio = 0, prevAmp = 2;
    for(const [ratio, amp, type] of oscs){
      assert.ok(ratio > prevRatio, `${k} 的分音倍频要递增`);
      assert.ok(amp > 0 && amp <= 1, `${k} 的幅度应在 (0, 1]`);
      assert.ok(amp <= prevAmp, `${k} 的幅度要递减`);
      assert.ok(["sine", "triangle", "square", "sawtooth"].includes(type), `${k} 波形不认识：${type}`);
      prevRatio = ratio; prevAmp = amp;
    }
  }
});

test("音色：未知名字回落到三角波，setTimbre 也只认表里的", () => {
  assert.equal(ML.timbreOf("nope").cn, ML.TIMBRES.tri.cn);
  assert.equal(ML.timbreName("piano"), "钢琴");
  ML.setTimbre("piano");
  assert.equal(ML.timbreName("piano"), "钢琴");
  ML.setTimbre("没有这个");
  assert.equal(ML.timbreOf("tri").cn, "三角波");
});

/* ---------- 持久化键 ---------- */

test("持久化：timbre / accent 两个新键的枚举与存储名", () => {
  assert.deepEqual(ML.PERSIST_ENUM.timbre, ["tri", "piano", "ep", "organ", "sine"]);
  assert.deepEqual(ML.PERSIST_ENUM.accent, ["ice", "violet", "mint", "amber", "rose"]);
  assert.equal(ML.PERSIST_KEY.timbre, "mlab-timbre");
  assert.equal(ML.PERSIST_KEY.accent, "mlab-accent");
});

test("持久化：写进去能读回来，非法的值读回来是 undefined", () => {
  const st = ML.createStore({ timbre: "tri", accent: "ice", a4: 440 });
  st.set("timbre", "organ");
  st.set("accent", "mint");
  assert.equal(LS.get("mlab-timbre"), "organ");
  assert.equal(LS.get("mlab-accent"), "mint");
  assert.equal(ML.read("timbre"), "organ");
  assert.equal(ML.read("accent"), "mint");

  LS.set("mlab-timbre", "guitar");
  assert.equal(ML.read("timbre"), undefined, "枚举外的音色要当没存过");
});

test("持久化：load() 把两个键读回来，越界的值被忽略", () => {
  LS.set("mlab-timbre", "ep");
  LS.set("mlab-accent", "rose");
  LS.set("mlab-a4", "999");
  const st = ML.createStore({ timbre: "tri", accent: "ice", a4: 440 });
  st.load();
  assert.equal(st.get("timbre"), "ep");
  assert.equal(st.get("accent"), "rose");
  assert.equal(st.get("a4"), 440, "A4 超出 400..480 应保持默认");
});
