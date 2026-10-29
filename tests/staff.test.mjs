/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 幻歌鸟调色盘 · 五线谱引擎测试
// 跑法：node tests/staff.test.mjs
// 基线：tests/staff.golden.json（删除它或 UPDATE_GOLDEN=1 时重建）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
  "08-core-rhythm.js",
  "20-render-staff.js",
];
const stateStub = { voicing: "7", inv: 0, spread: "close" };

function load() {
  const code = FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");
  const factory = new Function(
    "state",
    code +
      "\nreturn {MODES,TONICS,spell,chordOf,chordVoicing,chordDegrees,chordSize,drawStaff,drawGrand,planMeter,meterOf,staffShift,octaveFor,IONIAN};"
  );
  return factory(stateStub);
}
const ML = load();

// 与界面里 staffChordGroups 同构：把某个调式某级的和弦摆到谱上
function chordGroups(mode, tonic, inv, spread) {
  const sp = ML.spell(mode, tonic);
  const base = 60 + tonic.pc;
  const gs = [];
  for (let i = 0; i < mode.pcs.length; i++) {
    const v = ML.chordVoicing(mode, i, { inv, spread, voicing: "7" });
    const r0 = base + mode.pcs[i];
    const sh = ML.staffShift(r0, v.off);
    const notes = v.degs.map((j, k) => {
      const midi = r0 + v.off[k] + sh;
      const oct = ML.octaveFor(sp[j].li, midi);
      return { step: sp[j].li + 7 * oct, li: sp[j].li, nacc: sp[j].nacc };
    });
    gs.push({ label: sp[i].roman, sub: sp[i].name + ML.chordOf(mode, i, "7").sym, notes });
  }
  return gs;
}

function scaleGroups(mode, tonic) {
  const sp = ML.spell(mode, tonic);
  const base = 60 + tonic.pc;
  const gs = [];
  for (let i = 0; i < mode.pcs.length; i++) {
    const midi = base + mode.pcs[i];
    const oct = ML.octaveFor(sp[i].li, midi);
    gs.push({ label: sp[i].roman, sub: sp[i].name,
      notes: [{ step: sp[i].li + 7 * oct, li: sp[i].li, nacc: sp[i].nacc }] });
  }
  const oct2 = ML.octaveFor(sp[0].li, base + 12);
  gs.push({ label: sp[0].roman + "′", sub: sp[0].name,
    notes: [{ step: sp[0].li + 7 * oct2, li: sp[0].li, nacc: sp[0].nacc }] });
  return gs;
}

test("五线谱：每个调式 × 主音都画得出来（不抛错、SVG 结构完整）", () => {
  for (const m of ML.MODES) {
    for (const t of ML.TONICS) {
      const n = m.pcs.length;
      const cs = ML.chordSize(m, 0, "7");
      for (const [kind, groups, heads, stems] of [
        ["scale", scaleGroups(m, t), n + 1, n + 1],
        ["chord", chordGroups(m, t, 0, "close"), cs * n, n],
      ]) {
        const r = ML.drawStaff(groups, { slotW: kind === "scale" ? 46 : 120, scale: 1.75 });
        assert.ok(r.markup.startsWith("<g transform=\"scale("), `${m.id}/${t.pc}/${kind} 缺外层 g`);
        assert.ok(r.W > 0 && r.H > 0);
        const h = r.markup.match(/class="nh"/g) || [];
        assert.equal(h.length, heads, `${m.id}/${t.pc}/${kind} 符头数不对`);
        const s = r.markup.match(/class="st"/g) || [];
        assert.equal(s.length, stems, `${m.id}/${t.pc}/${kind} 符干数不对`);
      }
    }
  }
});

test("五线谱：二度音必须左右错开（不能同 x）", () => {
  let checked = 0, worst = 0;
  for (const m of ML.MODES) {
    const t = ML.TONICS[0];
    const sp = ML.spell(m, t);
    for (let i = 0; i < m.pcs.length; i++) {
      for (const inv of [0, 1, 2, 3]) {
        for (const spread of ["close", "open"]) {
          const v = ML.chordVoicing(m, i, { inv, spread, voicing: "7" });
          const r0 = 60 + t.pc + m.pcs[i];
          const sh = ML.staffShift(r0, v.off);
          const notes = v.degs.map((j, k) => {
            const midi = r0 + v.off[k] + sh;
            const oct = ML.octaveFor(sp[j].li, midi);
            return { step: sp[j].li + 7 * oct, li: sp[j].li, nacc: sp[j].nacc };
          });
          const sorted = notes.slice().sort((a, b) => a.step - b.step);
          const hasSecond = sorted.some((n, k) => k && n.step - sorted[k - 1].step === 1);
          if (!hasSecond) continue;
          const r = ML.drawStaff([{ label: "x", sub: "x", notes }], { slotW: 200, scale: 1 });
          // 新版用 SMuFL 字形，符头是 <text x=...>（x 是字形左缘，符头宽 1.18sp = 11.8）
          const cols = [...r.markup.matchAll(/class="nh" x="(-?[\d.]+)"/g)]
            .map(m => +m[1] + 5.9);
          assert.equal(cols.length, notes.length);
          // 二度的那两枚必须落在不同的 cx 上，且「下左、上右」，符干从两枚之间穿过（规范 1.9.4.1）
          const stem = [...r.markup.matchAll(/class="st" x1="(-?[\d.]+)"/g)].map(m => +m[1])[0];
          const pairs = [];
          for (let k = 1; k < sorted.length; k++) {
            if (sorted[k].step - sorted[k - 1].step === 1) {
              const idxA = notes.indexOf(sorted[k - 1]);
              const idxB = notes.indexOf(sorted[k]);
              pairs.push([cols[idxA], cols[idxB]]);
            }
          }
          for (const [a, b] of pairs) {
            worst = Math.max(worst, Math.abs(a - b));
            assert.ok(Math.abs(a - b) >= 9, `${m.id}/${i}/inv${inv}/${spread} 二度没分开：${a} vs ${b}`);
            // 规范 1.9.4.1 只对「一对」二度要求下左上右；三音以上的音簇按 1.14.3.5 上下交替，
            // 所以「下左」只在整组正好两枚（单一一对）时才成立。
            if (notes.length === 2) {
              assert.ok(a < b, `${m.id}/${i}/inv${inv}/${spread} 下面的符头应当靠左：${a} vs ${b}`);
              if (stem != null) {
                assert.ok(a < stem && b > stem,
                  `${m.id}/${i}/inv${inv}/${spread} 符干应从两枚符头之间穿过：stem ${stem}，符头 ${a}/${b}`);
              }
            }
          }
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 20, `含二度的情形只有 ${checked} 个，测试覆盖不足`);
});

test("五线谱：与基线一致（golden）", () => {
  const rows = [];
  for (const m of ML.MODES.slice(0, 33)) {
    for (const t of ML.TONICS) {
      for (const [kind, groups, opt] of [
        ["S", scaleGroups(m, t), { slotW: 46, scale: 1.75 }],
        ["C0", chordGroups(m, t, 0, "close"), { slotW: 120, scale: 2 }],
        ["C2", chordGroups(m, t, 2, "open"), { slotW: 120, scale: 2 }],
      ]) {
        const r = ML.drawStaff(groups, opt);
        rows.push(`${m.id}|${t.pc}|${kind}|${r.W}x${r.H}|${hash(r.markup)}`);
      }
    }
  }
  const goldenPath = join(here, "staff.golden.json");
  if (!existsSync(goldenPath) || process.env.UPDATE_GOLDEN === "1") {
    writeFileSync(goldenPath, rows.join("\n") + "\n", "utf8");
    console.log(`已写入基线 tests/staff.golden.json（${rows.length} 行）`);
    return;
  }
  const want = readFileSync(goldenPath, "utf8").trimEnd().split("\n");
  assert.equal(rows.length, want.length, "基线行数变了");
  const diff = rows.map((r, i) => (r === want[i] ? null : `${want[i]}  →  ${r}`)).filter(Boolean);
  assert.equal(diff.length, 0, "谱面与基线不一致：\n" + diff.slice(0, 6).join("\n"));
});

/* ---------- 带拍号的谱面（v16 新增） ---------- */

const ONE = [{ step: 34, li: 2, nacc: 0 }];   // 随便一个音，够画就行

test("拍号谱面：拍号数字 / 小节线 / 全音符没有符干", () => {
  const meter = ML.meterOf("4/4");
  const r = ML.drawStaff([{ dur: 4, notes: ONE }], { meter, slotW: 104, scale: 1 });
  const ts = r.markup.match(/class="ts"/g) || [];
  assert.equal(ts.length, 2, "拍号应当有两个数字（分子 + 分母）");
  const bl = r.markup.match(/class="bl"/g) || [];
  assert.equal(bl.length, 2, "一小节只需要起、止两道小节线");
  assert.equal((r.markup.match(/class="st"/g) || []).length, 0, "全音符不该有符干");
  assert.ok(r.markup.includes("\uE0A2"), "全音符要用 Bravura 的全音符头");
});

test("拍号谱面：附点二分带附点、二分带符干", () => {
  const meter = ML.meterOf("4/4");
  const r = ML.drawStaff([{ dur: 3, notes: ONE }], { meter, slotW: 104, scale: 1 });
  assert.equal((r.markup.match(/class="dot"/g) || []).length, 1, "三拍应当画一个附点");
  assert.equal((r.markup.match(/class="st"/g) || []).length, 1);
  const q = ML.drawStaff([{ dur: 2, notes: ONE }], { meter, slotW: 104, scale: 1 });
  assert.equal((q.markup.match(/class="dot"/g) || []).length, 0, "二分音符没有附点");
});

test("拍号谱面：休止符按位置挂在线上", () => {
  const meter = ML.meterOf("4/4");
  const whole = ML.drawStaff([{ dur: 4, rest: true }], { meter, slotW: 104, scale: 1 });
  assert.equal((whole.markup.match(/class="rst"/g) || []).length, 1);
  assert.ok(whole.markup.includes("\uE4E3"), "四拍休止用全休止符");
  const half = ML.drawStaff([{ dur: 2, rest: true }, { dur: 2, rest: true }], { meter, slotW: 104, scale: 1 });
  assert.ok(half.markup.includes("\uE4E4"), "两拍休止用二分休止符");
  const qtr = ML.drawStaff([{ dur: 1, rest: true }], { meter, slotW: 104, scale: 1 });
  assert.ok(qtr.markup.includes("\uE4E5"), "一拍休止用四分休止符");
});

test("拍号谱面：跨小节的长音自动切分并加延音线", () => {
  const meter = ML.meterOf("4/4");
  const r = ML.drawStaff([{ dur: 6, notes: ONE }], { meter, slotW: 104, scale: 1 });
  assert.equal((r.markup.match(/class="bl"/g) || []).length, 3, "两小节＝起、中、止三道线");
  assert.equal((r.markup.match(/class="tie"/g) || []).length, 1, "被小节线切断处要有延音线");
  // 3/4 下的三拍刚好一小节，不该有延音线
  const r3 = ML.drawStaff([{ dur: 3, notes: ONE }], { meter: ML.meterOf("3/4"), slotW: 104, scale: 1 });
  assert.equal((r3.markup.match(/class="tie"/g) || []).length, 0);
  assert.equal((r3.markup.match(/class="bl"/g) || []).length, 2, "3/4 的三拍只占一小节");
});

test("拍号谱面：大谱表上下两行的小节线必须对齐", () => {
  const meter = ML.meterOf("4/4");
  const gs = scaleGroups(ML.MODES[0], ML.TONICS[0]);
  const tre = gs.slice(0, 3).map(g => ({ dur: 2, notes: g.notes }));
  const bas = gs.slice(3, 6).map(g => ({ dur: 2, notes: g.notes }));
  const r = ML.drawGrand(tre, bas, { meter, slotW: 104, scale: 1 });
  const bars = [...r.markup.matchAll(/class="bl" x1="([\d.]+)" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/g)]
    .map(m => ({ x: +m[1], y1: +m[2], y2: +m[3] }));
  // 连谱号那条纵线贯通上下两行，比单行谱表的小节线长得多
  const sys = bars.filter(b => b.y2 - b.y1 > 60);
  assert.equal(sys.length, 1, "大谱表左侧只该有一条连谱线");
  const inner = bars.filter(b => b.y2 - b.y1 < 60);
  const rows = {};
  for(const b of inner) (rows[b.y1] = rows[b.y1] || []).push(b.x);
  const ys = Object.keys(rows);
  assert.equal(ys.length, 2, "上下两行各三道线，共两组");
  assert.deepEqual(rows[ys[0]].sort((a, b) => a - b), rows[ys[1]].sort((a, b) => a - b),
    "上下两行的小节线 x 必须一致");
  assert.equal(rows[ys[0]].length, 3, "两小节＝起、中、止三道线");
});

test("大谱表用花连谱号（大括号），不是直连谱号", () => {
  const meter = ML.meterOf("4/4");
  const gs = scaleGroups(ML.MODES[0], ML.TONICS[0]);
  const tre = gs.slice(0, 2).map(g => ({ dur: 2, notes: g.notes }));
  const bas = gs.slice(2, 4).map(g => ({ dur: 2, notes: g.notes }));
  const r = ML.drawGrand(tre, bas, { meter, slotW: 104, scale: 1 });
  assert.equal((r.markup.match(/class="brc"/g) || []).length, 1, "一处花连谱号");
  assert.ok(r.markup.includes("\uE000"), "花连谱号用 Bravura 的 brace 字形");
  assert.ok(!/class="brk"/.test(r.markup), "大谱表不该再画直连谱号造型的短线");
  // 花括号的竖拉比例：竖向缩放 × 字形自然高度（4sp）要正好等于连谱线的长度
  const m = r.markup.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([\d.]+),([\d.]+)\)"><text class="brc"/);
  assert.ok(m, "花连谱号要带 translate + scale");
  const sysLine = r.markup.match(/class="bl" x1="([\d.]+)" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/);
  const top = +sysLine[2], bot = +sysLine[3];
  assert.equal(+m[2], bot, "花连谱号的基线要落在低音谱表底线上");
  assert.ok(Math.abs(40 * +m[4] - (bot - top)) < 0.5, "竖拉后正好贯通两行谱表：" + (40 * +m[4]) + " vs " + (bot - top));
  assert.ok(+m[3] > 1.5, "横向上也要放宽，不然拉长后会细成一根线");
});

// FNV-1a，够用来发现任何一像素的改动
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
