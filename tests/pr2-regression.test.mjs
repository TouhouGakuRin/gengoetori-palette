/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// PR #1 合并后的第二轮深度审查回归测试（2026-11-14）
// 跑法：node tests/pr2-regression.test.mjs
// 每条都对应 深度审查-PR1合并后-2026-11-14.md 里的 AUD-* 编号。
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
  "04-core-midi.js",
  "07-core-satb.js",
  "08-core-rhythm.js",
  "09-core-borrow.js",
  "10-audio-engine.js",
  "48-url-codec.js",
  "50-ui-export.js",
  "44-ui-compare.js",
];

const SHIM = `
const __el = () => ({ classList:{add(){},remove(){},toggle(){}}, style:{}, dataset:{},
  innerHTML:"", textContent:"", value:"", clientWidth:900, setAttribute(){},
  getBoundingClientRect(){return {top:0,left:0,width:900,height:200};} });
const $ = () => __el();
const document = { documentElement:{dataset:{theme:"dark"}}, getElementById:()=>__el(),
  querySelector:()=>__el(), querySelectorAll:()=>[], addEventListener(){}, createElement:()=>__el() };
const window = { history:null, addEventListener(){} };
const location = { hash:"" };
const localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
let state = { voicing:"7", oct:0, a4:440, inv:0, spread:"close", A:"ion", B:"dor",
  tone:0, chord:0, b4:0, b7:0, pentaChord:"tertian", tuning:"et", drone:false, timbre:"tri" };
const byId = id => MODES.find(m => m.id === id);
const tonicObj = () => TONICS[state.tone];
const baseMode = () => byId(state.A);
/* 让测试能模拟「变形滑杆把两个级数滑到同一个音高」：activeMode 临时换成合成调式 */
let __amOverride = null;
const activeMode = () => (__amOverride || byId(state.A));
const uiRegister = () => {};
const store = { set(k,v){ state[k]=v; return v; }, get(k){ return state[k]; } };
`;

function load(){
  const code = SHIM + FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n")
    + "\nreturn { MODES, TONICS, state, setTuning, freqFor, freqOf, justFreq, satbCheck, satbViolations, seventhOf,"
    + " chordOf, chordVoicing, chordDegrees, quintalDegrees, romanShape, durationLabel, vlq,"
    + " urlExFromParam, urlDeckFromParam, EXPORT_CSS,"
    + " escapeHtml: (typeof escapeHtml === 'function' ? escapeHtml : null),"
    + " compareModeA, setActiveOverride: v => { __amOverride = v; },"
    + " clampDeg: (typeof clampDeg === 'function' ? clampDeg : null) };";
  return new Function(code)();
}

const ML = load();
const pen = ML.MODES.find(m => m.pentRot != null);

/* ---------- AUD-H4：平行五/八度必须判运动方向 ---------- */

test("AUD-H4 静止声部不报平行五度", () => {
  const prev = {S:67, A:60, T:55, B:48};
  const cur  = {S:67, A:60, T:57, B:50};   // S/A 完全不动
  const r = ML.satbCheck(prev, cur, {tonic:0, seven:null, nextTones:[0,4,7]});
  assert.equal(r.some(x => x.kind === "平行五度" && x.voices === "S/A"), false,
    "静止声部被误判：" + JSON.stringify(r));
});

test("AUD-H4 反行进行不报平行五度", () => {
  const prev = {S:67, A:60, T:55, B:48};   // S/A 相隔纯五度
  const cur  = {S:79, A:48, T:55, B:48};   // S 上八度、A 下八度 → 仍是纯五度，但反行
  const r = ML.satbCheck(prev, cur, {tonic:0, seven:null, nextTones:[0,4,7]});
  assert.equal(r.some(x => x.kind === "平行五度" && x.voices === "S/A"), false,
    "S/A 反行被误判：" + JSON.stringify(r));
});

test("AUD-H4 真的同向平行仍要检出（原有测试口径不回退）", () => {
  const a = {S:72, A:67, T:60, B:48};
  const b = {S:74, A:69, T:62, B:50};
  const r = ML.satbCheck(a, b);
  assert.ok(r.filter(x => x.kind === "平行五度" || x.kind === "平行八度").length >= 2,
    "真平行漏检：" + JSON.stringify(r));
});

/* ---------- AUD-H5 / H2：级数按音阶长度收敛 ---------- */

test("AUD-H5 clampDeg 把越界/负数级数收敛到音阶内", () => {
  assert.equal(typeof ML.clampDeg, "function", "缺少 clampDeg()");
  assert.equal(ML.clampDeg(10, pen), pen.pcs.length - 1);
  assert.equal(ML.clampDeg(-1, pen), pen.pcs.length - 1);
  assert.equal(ML.clampDeg(2, pen), 2);
});

test("AUD-H5 chordOf/chordVoicing 对越界 idx 不产 NaN", () => {
  const c = ML.chordOf(pen, 10, "7", 3);
  assert.ok(c.iv.length >= 2 && c.iv.every(Number.isFinite), "iv 含 NaN：" + JSON.stringify(c.iv));
  assert.equal(c.sym.includes("NaN"), false, "和弦记号含 NaN：" + c.sym);
  const v = ML.chordVoicing(pen, 10, {voicing:"7", size:3});
  assert.ok(v.off.every(Number.isFinite), "off 含 NaN：" + JSON.stringify(v.off));
});

test("AUD-H2 URL 解码按槽位音阶长度拒绝越界 d", () => {
  const modeLen = id => (ML.MODES.find(m => m.id === id) || pen).pcs.length;
  const r = ML.urlDeckFromParam([{m:pen.id, d:9, n:3}], id => !!modeLen(id), modeLen);
  assert.equal(r[0], null, "越界 d 未被拒绝");
  const ok = ML.urlDeckFromParam([{m:pen.id, d:4, n:3}], id => !!modeLen(id), modeLen);
  assert.ok(ok[0] && ok[0].d === 4, "合法 d 被误杀");
});

/* ---------- AUD-M9：五度叠置 fallback 不截断成单音和弦 ---------- */

test("AUD-M9 非中国五声走五度叠置时至少给出三音和弦", () => {
  ML.state.pentaChord = "quintal";
  try{
    for(const id of ["in", "hira", "iwato"]){
      const m = ML.MODES.find(x => x.id === id);
      if(!m) continue;
      const c = ML.chordOf(m, 0, "7", 5);
      assert.ok(c.iv.length >= 3, id + " 被截成 " + c.iv.length + " 音：" + c.sym);
      assert.ok(c.iv.every(Number.isFinite), id + " 产出 NaN");
    }
  }finally{ ML.state.pentaChord = "tertian"; }
});

/* ---------- AUD-H3 / M4：纯律参照主音与 A4 回退 ---------- */

test("AUD-H3 freqFor 支持按播放主音覆盖纯律参照", () => {
  ML.setTuning("just", 0);
  const byC = ML.freqFor(56, 440, 0);
  const byE = ML.freqFor(56, 440, 4);
  assert.notEqual(byC, byE, "tonicPc 覆盖未生效");
  assert.ok(Math.abs(byE - 206.017) < 0.01, "以 E 为主音的 G# 频率不对：" + byE);
  ML.setTuning("et", 0);
});

test("AUD-M4 justFreq 在 a4 缺省时与 freqOf 一样读 state.a4", () => {
  const old = ML.state.a4;
  ML.state.a4 = 415;
  try{
    assert.equal(ML.justFreq(60, 0, undefined), ML.justFreq(60, 0, 415),
      "纯律路径忽略了 state.a4");
  }finally{ ML.state.a4 = old; }
});

/* ---------- AUD-M7 / M8 / M3：记号、拍值、导出样式 ---------- */

test("AUD-M7 romanShape 不把属七降五/挂二和弦标成减和弦", () => {
  assert.equal(ML.romanShape("V", [0,2,7]).includes("°"), false, "挂二和弦被标 °");
  assert.equal(ML.romanShape("V", [0,4,6,10]).includes("°"), false, "属七降五被标 °");
  assert.equal(ML.romanShape("V", [0,3,6]).includes("°"), true, "减三和弦应保留 °");
});

test("AUD-M8 6/8 拍不再误标成四分音符", () => {
  assert.equal(ML.durationLabel(6).includes("四分音符"), false, ML.durationLabel(6));
  assert.equal(ML.durationLabel(8).includes("四分音符"), false, ML.durationLabel(8));
});

test("AUD-M3 导出样式包含特征音暖色 .hi", () => {
  assert.ok(ML.EXPORT_CSS.includes(".hi"), "EXPORT_CSS 缺 .hi");
});

/* ---------- AUD-H1：外部文本入口清洗 ---------- */

test("AUD-H1 URL 解出的和弦文本不含可注入字符", () => {
  const ex = ML.urlExFromParam({r:0, t:[0,4,7], rm:'<img src=x onerror=alert(1)>', sy:'</text><script>x</script>'});
  assert.ok(ex, "合法和弦被整体丢掉了");
  assert.equal(/[<>"']/.test(ex.roman + ex.symbol), false,
    "危险字符未清洗：" + JSON.stringify({r:ex.roman, s:ex.symbol}));
});

test("AUD-H1 escapeHtml 对 HTML/SVG 文本上下文做转义", () => {
  assert.equal(typeof ML.escapeHtml, "function", "缺少 escapeHtml()");
  assert.equal(ML.escapeHtml('<b>&"\'</b>').includes("<"), false);
});

/* ---------- AUD-L12 / L13：减七与 VLQ 健壮性 ---------- */

test("AUD-L12 seventhOf 认得减七和弦的减七度", () => {
  assert.equal(ML.seventhOf([0,3,6,9]), 9, "减七和弦的七音被跳过");
});

test("AUD-L13 vlq 遇负数不挂死", () => {
  assert.deepEqual(Array.from(ML.vlq(-1)), [0], "负 delta 未做防御");
});

test("AUD-L11 整条体检会检查首和弦的间距（首尾对称）", () => {
  const bad = {S:81, A:60, T:55, B:40};      // S–A = 21 半音，超过八度
  const good = {S:72, A:64, T:57, B:48};
  const head = ML.satbViolations([bad, good], {tonic:0});
  assert.ok(head.some(x => x.kind === "间距过大" && x.from === 0),
    "首和弦间距漏检：" + JSON.stringify(head));
  const tail = ML.satbViolations([good, bad], {tonic:0});
  assert.ok(tail.some(x => x.kind === "间距过大" && x.to === 1),
    "末和弦间距漏检：" + JSON.stringify(tail));
});

test("AUD-H2 clampDeg 对任意槽位音阶都不会越界", () => {
  for(const m of ML.MODES){
    for(const d of [-3, 0, 3, 11, 99]){
      const i = ML.clampDeg(d, m);
      assert.ok(i >= 0 && i < m.pcs.length, m.id + " d=" + d + " → " + i);
    }
  }
});

/* ---------- AUD-L9：A/B 对比要看「耳朵听到的那条音阶」 ---------- */

test("AUD-L9 对比模式默认等于当前调式（含旋宫偏音）", () => {
  const old = ML.state.A;
  ML.state.A = "penG";
  const a = ML.compareModeA();
  ML.state.A = old;
  assert.equal(a.id, "penG");
  assert.deepEqual(a.pcs, ML.MODES.find(m => m.id === "penG").pcs, "对比音阶与当前调式不一致");
});

test("AUD-L9 变形撞音先按音高去重，不重复计数", () => {
  const pen = ML.MODES.find(m => m.id === "penG");
  ML.setActiveOverride(Object.assign({}, pen, {
    pcs: [0, 2, 2, 4, 7, 9],
    degNames: ["宫", "商", "商", "角", "徵", "羽"],
  }));
  const a = ML.compareModeA();
  ML.setActiveOverride(null);
  assert.deepEqual(a.pcs, [0, 2, 4, 7, 9], "重复音高未去重");
  assert.equal(a.degNames.length, 5, "级名未跟音高一起收窄");
});

/* ---------- AUD-L10：五度叠置只对纯五声成立 ---------- */

test("AUD-L10 加偏音成六声后不走五度叠置", () => {
  const pen = ML.MODES.find(m => m.id === "penG");
  const six = Object.assign({}, pen, {
    pcs: [0, 2, 4, 5, 7, 9],
    degNames: ["宫", "商", "角", "清角", "徵", "羽"],
  });
  const old = ML.state.pentaChord;
  ML.state.pentaChord = "quintal";
  const q = ML.chordDegrees(0, "7", six);
  ML.state.pentaChord = "tertian";
  const t = ML.chordDegrees(0, "7", six);
  ML.state.pentaChord = old;
  assert.deepEqual(q, t, "六声仍在走五度纵合链：" + JSON.stringify(q));
});

test("AUD-L10 纯五声仍走五度纵合链", () => {
  const pen = ML.MODES.find(m => m.id === "penG");
  const old = ML.state.pentaChord;
  ML.state.pentaChord = "quintal";
  const q = ML.chordDegrees(0, "7", pen);
  ML.state.pentaChord = "tertian";
  const t = ML.chordDegrees(0, "7", pen);
  ML.state.pentaChord = old;
  assert.deepEqual(q, [0, 3, 1, 4], "宫上的五度纵合应是 宫-徵-商-羽：" + JSON.stringify(q));
  assert.notDeepEqual(q, t, "五度叠置与三度叠置取了同一组音");
});
