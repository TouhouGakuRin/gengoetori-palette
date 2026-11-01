/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 幻歌鸟调色盘 · core 层测试
// 跑法：node --test tests/
// 更新基线：node --test tests/ 前先删掉 tests/golden.json，或用 UPDATE_GOLDEN=1
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "src", "js");
const CORE = [
  "00-core-pitch.js",
  "01-core-scales.js",
  "02-core-chords.js",
  "03-core-theory.js",
  "04-core-midi.js",
];

// core 层只在函数体里读 state（默认值），这里给一个只读桩
const stateStub = { voicing: "7", inv: 0, spread: "close" };

export function loadCore() {
  const code = CORE.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");
  const factory = new Function(
    "state",
    code +
      "\nreturn {MODES,TONICS,spell,chordOf,chordVoicing,chordDegrees,chordSize,distance,brightness," +
      "pentaMode,PENTA_NAMES,PENTA_BASE,PENTA_IDS,bestKeySig,keySigName,tritones,buildMidi,octaveFor,noteName,INV_LABEL,IONIAN,degLabel,sizeCap,chordDegreeMax};"
  );
  return factory(stateStub);
}

const ML = loadCore();
const GOLDEN = join(here, "golden.json");

const HEPT = () => ML.MODES.filter(m => m.pcs.length === 7);

function table() {
  const rows = [];
  for (const m of HEPT()) {
    for (const t of ML.TONICS) {
      const sp = ML.spell(m, t);
      const chords = [];
      for (let i = 0; i < 7; i++) chords.push(sp[i].name + ML.chordOf(m, i, "7").sym);
      rows.push([
        m.id,
        t.pc,
        sp.map(s => s.name).join(" "),
        sp.map(s => s.roman).join(" "),
        chords.join(" "),
      ].join(" | "));
    }
  }
  return rows;
}

test("七声调式 × 12 主音的拼写与和弦（golden）", () => {
  const rows = table();
  assert.equal(rows.length, HEPT().length * 12);
  if (!existsSync(GOLDEN) || process.env.UPDATE_GOLDEN === "1") {
    writeFileSync(GOLDEN, rows.join("\n") + "\n", "utf8");
    console.log(`已写入基线 tests/golden.json（${rows.length} 行）`);
    return;
  }
  const want = readFileSync(GOLDEN, "utf8").trimEnd().split("\n");
  assert.equal(rows.length, want.length, "行数变了");
  const diff = rows.map((r, i) => (r === want[i] ? null : `${i}: ${want[i]}  →  ${r}`)).filter(Boolean);
  assert.equal(diff.length, 0, "与基线不一致：\n" + diff.slice(0, 8).join("\n"));
});

test("拼写：级数与音名自洽（七声）", () => {
  for (const m of HEPT()) {
    for (const t of ML.TONICS) {
      const sp = ML.spell(m, t);
      assert.equal(sp.length, 7);
      sp.forEach((s, i) => {
        // 字母必须顺次递进（C D E F G A B）
        assert.equal(s.li, (t.li + i) % 7, `${m.id}/${t.pc} 第 ${i + 1} 级字母错位`);
        // 级数升降 = 相对同主音大调
        assert.equal(s.acc, m.pcs[i] - ML.IONIAN[i], `${m.id}/${t.pc} 第 ${i + 1} 级升降错`);
        // 音名算出来的音高类必须等于目标音高类
        const pc = (t.pc + m.pcs[i]) % 12;
        assert.equal(s.abs, pc);
      });
    }
  }
});

test("和弦：七声调式的和弦音数与性质", () => {
  for (const m of HEPT()) {
    for (let i = 0; i < 7; i++) {
      const c3 = ML.chordOf(m, i, "3");
      const c7 = ML.chordOf(m, i, "7");
      assert.equal(c3.tones.length, 3, `${m.id} 第 ${i + 1} 级三和弦音数`);
      assert.equal(c7.tones.length, 4, `${m.id} 第 ${i + 1} 级七和弦音数`);
      assert.ok(c3.sym !== undefined && c7.sym !== undefined);
      // 根音必须在最前
      assert.equal(c7.tones[0], m.pcs[i]);
    }
  }
});

test("排列：任何转位/开闭都不一样，但音高严格递增且低音是第 inv 个音", () => {
  for (const m of HEPT()) {
    for (let i = 0; i < 7; i++) {
      for (const spread of ["close", "open"]) {
        for (let inv = 0; inv < 4; inv++) {
          const v = ML.chordVoicing(m, i, { inv, spread });
          if (inv > v.n - 1) continue;
          // 相对根音的偏移必须递增（不能有并列或倒挂）
          for (let k = 1; k < v.off.length; k++) {
            assert.ok(v.off[k] > v.off[k - 1], `${m.id}/${i + 1}/${spread}/${inv} 偏移没递增`);
          }
          // 低音 = 第 inv 个和弦音（mod 12）
          const bassShould = (m.pcs[ML.chordDegrees(i, "7")[inv]] - m.pcs[i] + 12) % 12;
          assert.equal(v.off[0] % 12, bassShould, `${m.id}/${i + 1}/${inv} 低音不对`);
          // 音名跟着级数走
          assert.equal(v.degs.length, v.off.length);
        }
      }
    }
  }
});

test("调号：12 个主音 = 大调标准调号", () => {
  const want = { 0: 0, 1: 7, 2: 2, 3: -3, 4: 4, 5: -1, 6: 6, 7: 1, 8: -4, 9: 3, 10: -2, 11: 5 };
  const ion = ML.MODES.find(m => m.id === "ion");
  for (const t of ML.TONICS) {
    const sp = ML.spell(ion, t);
    const notes = sp.map(s => ({ li: s.li, nacc: s.nacc }));
    const f = ML.bestKeySig(notes).f;
    assert.equal(f, want[t.pc], `主音 ${t.pc} 的调号应为 ${want[t.pc]}，实际 ${f}`);
  }
});

test("距离：同调为 0、对称、上界合理", () => {
  for (const a of ML.MODES) {
    assert.equal(ML.distance(a, a).score, 0, `${a.id} 自身距离应为 0`);
    for (const b of ML.MODES) {
      const ab = ML.distance(a, b).score, ba = ML.distance(b, a).score;
      assert.equal(ab, ba, `${a.id}↔${b.id} 不对称`);
      assert.ok(ab >= 0 && ab <= 12, `${a.id}↔${b.id} 分数越界 ${ab}`);
    }
  }
});

test("亮度：按变化音数量单调（仅七声）", () => {
  for (const m of HEPT()) {
    const b = ML.brightness(m);
    const changes = m.pcs.filter((p, i) => p !== ML.IONIAN[i]).length;
    assert.equal(b.marks.length, changes, `${m.id} 变化音数量不对`);
  }
});

test("MIDI：format 0、单轨、音数匹配", () => {
  const notes = [{ m: 60, beat: 0, dur: 1 }, { m: 64, beat: 1, dur: 1 }, { m: 67, beat: 2, dur: 2 }];
  const bytes = ML.buildMidi(notes, 96, "test");
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "MThd");
  assert.equal(bytes[9], 0); // format 0
  assert.equal(bytes[11], 1); // 1 轨
  const ev = parseTrack(bytes);
  const on = ev.filter(e => e.hi === 0x90 && e.data[1] > 0).length;
  const off = ev.filter(e => e.hi === 0x80).length;
  assert.equal(on, notes.length, "note-on 数量");
  assert.equal(off, notes.length, "note-off 数量");
  // 每个 note-on 的音高要对
  assert.deepEqual(ev.filter(e => e.hi === 0x90).map(e => e.data[0]), notes.map(n => n.m));
});

// 极简 SMF 事件扫描：够验证 status 与数据，不处理多字节长度（本工程不会出现）
function parseTrack(bytes) {
  const tag = [0x4d, 0x54, 0x72, 0x6b];
  let i = 0;
  for (; i < bytes.length - 4; i++) {
    if (tag.every((b, k) => bytes[i + k] === b)) break;
  }
  let p = i + 8;
  const out = [];
  while (p < bytes.length) {
    let b;
    do { b = bytes[p++]; } while (b & 0x80); // 跳过 delta
    const st = bytes[p];
    if (st === 0xff) {
      p++;
      const type = bytes[p++];
      const len = bytes[p++];
      p += len;
      if (type === 0x2f) break;
      continue;
    }
    p++;
    const hi = st & 0xf0;
    const n = hi === 0xc0 || hi === 0xd0 ? 1 : 2;
    out.push({ hi, data: bytes.slice(p, p + n) });
    p += n;
  }
  return out;
}

test("八度：B#/Cb 落在正确的八度", () => {
  assert.equal(ML.octaveFor(6, 72), 4, "C5 的七级 B 应是 B4");   // li=6(B), midi 72(C5) → B4
  assert.equal(ML.octaveFor(6, 71), 4, "B4 自己");
  assert.equal(ML.octaveFor(0, 60), 4, "C4");
  assert.equal(ML.octaveFor(0, 61), 4, "C#4 的 C 仍是 C4");
});

// ── 非七声音阶（5/6/8/9/10 声）──
test("多音阶：音数、拼写与级数标签", () => {
  for (const m of ML.MODES) {
    const n = m.pcs.length;
    for (const t of ML.TONICS) {
      const sp = ML.spell(m, t);
      assert.equal(sp.length, n, `${m.id} 拼写音数`);
      sp.forEach((s, i) => {
        assert.equal(s.abs, (t.pc + m.pcs[i]) % 12, `${m.id}/${t.pc} 第 ${i + 1} 音高`);
        assert.ok(s.name && s.name.length >= 1, `${m.id}/${t.pc} 第 ${i + 1} 没音名`);
        // 名字里第一个字母对应的字母序号必须一致（升号/降号都算）
        const li = "CDEFGAB".indexOf(s.name[0]);
        assert.equal(li, s.li, `${m.id}/${t.pc} 第 ${i + 1} 音名字母与 li 不符`);
      });
    }
  }
});

test("多音阶：和弦不会取到重复音，音数随音阶音数走", () => {
  for (const m of ML.MODES) {
    const n = m.pcs.length;
    for (let i = 0; i < n; i++) {
      for (const v of ["3", "7"]) {
        const ids = ML.chordDegrees(i, v, m);
        assert.equal(new Set(ids).size, ids.length, `${m.id} 第 ${i + 1} 级和弦有重复音`);
        assert.ok(ids.length >= 3 && ids.length <= 4, `${m.id} 和弦音数越界`);
        const c = ML.chordOf(m, i, v);
        assert.equal(c.tones.length, ids.length);
        assert.equal(c.tones[0], m.pcs[i], `${m.id}/${i + 1} 根音不在最前`);
      }
    }
  }
});

test("多音阶：五声的旋宫五个调式互为转位", () => {
  // 五个调式现在是五条独立条目（penG…penY），旋宫 = 换条目
  const penta = ML.MODES.filter(m => m.pentRot !== undefined);
  assert.equal(penta.length, 5, "应有五个五声调式条目");
  const base = penta[0];
  assert.ok(base, "缺少中国五声条目");
  const gong = base.pcs.slice().sort((a, b) => a - b).join(",");
  // 五个旋法同源：把各自的相对音集还原到同一组绝对音，应该完全一致
  const same = penta.every(m => {
    const abs = m.pcs.map(x => (x + ML.PENTA_BASE[m.pentRot]) % 12).sort((a, b) => a - b).join(",");
    return abs === "0,2,4,7,9";
  });
  assert.ok(same, "五个调式必须是同一组音的转位");
  for (const m of penta) {
    assert.equal(m.pcs.length, 5, `旋宫 ${m.cn} 音数`);
    assert.equal(m.pcs[0], 0, `旋宫 ${m.cn} 主音应为 0`);
    assert.equal(m.degNames.length, 5, "阶名个数");
  }
  // 加偏音：长度变 6 / 7，且音不重复
  const b4 = ML.pentaMode(base, { rot: 0, b4: 5 });
  assert.equal(b4.pcs.length, 6);
  const both = ML.pentaMode(base, { rot: 0, b4: 6, b7: 11 });
  assert.equal(both.pcs.length, 7);
  assert.equal(new Set(both.pcs).size, 7, "加偏音后不能有重复音");
  // 清乐七声：宫 商 角 清角 徵 羽 变宫
  assert.deepEqual(both.pcs, [0, 2, 4, 6, 7, 9, 11]);
});

test("音数上限：偶数音阶只能叠到 n/2 个音（全音阶 6 个音 → 三和弦）", () => {
  const wt = ML.MODES.find(m => m.id === "wt0");
  const oct12 = ML.MODES.find(m => m.id === "chrom");
  assert.equal(ML.chordDegreeMax(6), 3, "6 个音最多隔一个取 3 个");
  assert.equal(ML.chordDegreeMax(7), 7);
  assert.equal(ML.chordDegreeMax(8), 4);
  assert.equal(ML.chordDegreeMax(12), 6);
  assert.equal(ML.sizeCap(wt), 3, "全音阶的音数上限");
  assert.equal(ML.sizeCap(oct12), 6, "半音阶的音数上限");
  // 即便硬要 6 个音，也不能绕回来重复
  for (const size of [4, 5, 6, 7]) {
    const ids = ML.chordDegrees(0, "7", wt, size);
    assert.equal(new Set(ids).size, ids.length, `全音阶${size}音出现重复`);
    assert.equal(ids.length, 3);
  }
});

test("声部排列：任何音阶 / 音数 / 转位 / 排列方式都必须是自下而上的升序", () => {
  for (const m of ML.MODES) {
    const cap = ML.chordDegreeMax(m.pcs.length);
    for (let size = 2; size <= cap; size++) {
      for (let d = 0; d < m.pcs.length; d++) {
        for (const spread of ["close", "open"]) {
          for (let inv = 0; inv < size; inv++) {
            const v = ML.chordVoicing(m, d, { voicing: "7", size, inv, spread });
            for (let i = 1; i < v.off.length; i++) {
              assert.ok(v.off[i] > v.off[i - 1],
                `${m.id} 第${d + 1}级${size}音 ${spread} 第${inv}转位不是升序：${v.off.join(",")}`);
            }
          }
        }
      }
    }
  }
});

test("MIDI：超过 127 字节的中文轨道名用 VLQ 记长度（不能截断）", () => {
  const name = "伊奥尼亚自然大调".repeat(9); // 8 字 × 3 字节 × 9 ≈ 216 字节
  const bytes = ML.buildMidi([{ t: 0, d: 480, m: 60, v: 96 }], 96, name);
  const enc = new TextEncoder().encode(name);
  // 直接在字节里找 MTrk 与 FF 03
  const find = (pat, from = 0) => {
    for (let i = from; i + pat.length <= bytes.length; i++) {
      if (pat.every((b, k) => bytes[i + k] === b)) return i;
    }
    return -1;
  };
  const trk = find([0x4d, 0x54, 0x72, 0x6b]);
  assert.ok(trk > 0, "缺少轨道块");
  const len = (bytes[trk + 4] << 24) | (bytes[trk + 5] << 16) | (bytes[trk + 6] << 8) | bytes[trk + 7];
  assert.equal(len, bytes.length - trk - 8, "轨道长度与内容不符");
  assert.ok(enc.length > 127, "样本名字应当超过 127 字节");
  const ff = find([0xff, 0x03], trk);
  assert.ok(ff > trk, "缺少轨道名事件");
  let i = ff + 2, vlen = 0, n = 0, b;
  do { b = bytes[i++]; vlen = (vlen << 7) | (b & 0x7f); n++; } while (b & 0x80 && n < 4);
  assert.equal(vlen, enc.length, "轨道名长度字节不对（应当用 VLQ，不能 & 0x7f）");
  const got = bytes.slice(i, i + vlen);
  assert.deepEqual([...got], [...enc], "轨道名内容被截断");
});

/* ---------------- 五声偏音（pentaMode） ---------------- */

test("pentaMode：同时加清角与变宫，音集与阶名都是清乐商调，英文名把两个偏音都列出", () => {
  const penS = ML.MODES.find(m => m.id === "penS");
  const v = ML.pentaMode(penS, { rot: 1, b4: 5, b7: 11 });
  assert.deepEqual(v.pcs, [0, 2, 3, 5, 7, 9, 10], "商调式+清角+变宫应为 C D Eb F G A Bb");
  assert.equal(v.degNames.join(""), "商角清角徵羽变宫宫");
  assert.ok(v.n.includes("BianZhi"), `英文名应含 BianZhi：${v.n}`);
  assert.ok(v.n.includes("BianGong"), `英文名应含 BianGong：${v.n}`);
  // 单独加一个偏音时英文名照旧
  const only4 = ML.pentaMode(penS, { rot: 1, b4: 5 });
  assert.ok(only4.n.includes("BianZhi") && !only4.n.includes("BianGong"), only4.n);
  const only7 = ML.pentaMode(penS, { rot: 1, b7: 11 });
  assert.ok(only7.n.includes("BianGong") && !only7.n.includes("BianZhi"), only7.n);
});
