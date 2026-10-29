/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 幻歌鸟调色盘 · 节拍与时值测试
// 跑法：node tests/rhythm.test.mjs
// 只管纯函数：拍号、时值分解、跨小节切分、休止、速度换算
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "src", "js");
const FILES = ["08-core-rhythm.js"];

function load() {
  const code = FILES.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");
  const factory = new Function(
    code +
      "\nreturn {METERS,meterOf,barBeats,noteValueOf,durationLabel,decomposeBeats,planMeter,restOfValue,beatSeconds};"
  );
  return factory();
}
const R = load();

test("拍号：三种基本拍与一小节拍数", () => {
  assert.deepEqual(R.METERS.map(m => m.id), ["4/4", "3/4", "2/4"]);
  assert.equal(R.barBeats(R.meterOf("4/4")), 4);
  assert.equal(R.barBeats(R.meterOf("3/4")), 3);
  assert.equal(R.barBeats(R.meterOf("2/4")), 2);
  assert.equal(R.meterOf("不存在").id, "4/4");
});

test("时值：拍数 → 记谱时值", () => {
  assert.equal(R.noteValueOf(4).n, "whole");
  assert.equal(R.noteValueOf(3).dots, 1);
  assert.equal(R.noteValueOf(2).n, "half");
  assert.equal(R.noteValueOf(1).n, "quarter");
  assert.ok(R.durationLabel(3).includes("附点"));
});

test("切分：附点二分只在小节头，其余位置拆成二分 + 四分", () => {
  const a = R.decomposeBeats(0, 3, 4).map(p => p.len);
  assert.deepEqual(a, [3], "小节头的三拍可以用附点二分");
  const b = R.decomposeBeats(2, 3, 4).map(p => p.len);
  assert.deepEqual(b, [2, 1], "从小节第 3 拍起的音不能用附点，要拆开");
  const c = R.decomposeBeats(3, 6, 4).map(p => p.len);
  assert.deepEqual(c, [1, 4, 1], "跨小节：先补满本小节，整小节记全音符，余数另记");
});

test("切分：全音符只在整小节", () => {
  const p = R.decomposeBeats(1, 4, 4).map(x => x.len);
  assert.ok(!p.includes(4) || p[0] === 4, "小节中间的 4 拍不能写成全音符：" + p.join("+"));
  assert.deepEqual(R.decomposeBeats(0, 4, 4).map(x => x.len), [4]);
});

test("切分：休止符不用附点值", () => {
  assert.deepEqual(R.decomposeBeats(0, 3, 4, {noDot: true}).map(p => p.len), [2, 1]);
  assert.deepEqual(R.decomposeBeats(0, 4, 4, {noDot: true}).map(p => p.len), [4]);
});

test("切分：任何片段都不跨小节线，且总长守恒", () => {
  for (const meter of R.METERS) {
    const bar = R.barBeats(meter);
    for (let pos = 0; pos < bar * 4; pos++) {
      for (let len = 1; len <= bar * 3; len++) {
        const ps = R.decomposeBeats(pos, len, bar);
        assert.equal(ps.reduce((s, p) => s + p.len, 0), len, `${meter.id} ${pos}+${len} 总长不等`);
        for (const p of ps) {
          assert.ok(p.pos + p.len <= Math.ceil((p.pos + 1) / bar) * bar,
            `${meter.id} ${pos}+${len}: 片段 ${p.pos}+${p.len} 越过小节线`);
          assert.ok([1, 2, 3, 4].includes(p.len), "出现了不可记谱的时值 " + p.len);
          assert.ok(p.len !== 3 || p.pos % bar === 0, "附点二分出现在小节中间");
          assert.ok(p.len !== 4 || p.pos % bar === 0, "全音符不在小节头");
        }
      }
    }
  }
});

test("planMeter：长音被小节线切断后前后两片互相标记延音线", () => {
  const plan = R.planMeter([{dur: 6}], R.meterOf("4/4"));
  assert.deepEqual(plan.items.map(i => [i.pos, i.len]), [[0, 4], [4, 2]]);
  assert.equal(plan.items[0].tieOut, true);
  assert.equal(plan.items[1].tieIn, true);
  assert.equal(plan.total, 6);
  assert.equal(plan.bars, 2);
  // 不跨小节的长音不该有延音线
  const p2 = R.planMeter([{dur: 2}, {dur: 2}], R.meterOf("4/4"));
  assert.equal(p2.items.every(i => !i.tieIn && !i.tieOut), true);
  // 三个小节的长音：中间那片两头都要连
  const p3 = R.planMeter([{dur: 12}], R.meterOf("4/4"));
  assert.deepEqual(p3.items.map(i => [i.tieIn, i.tieOut]),
    [[false, true], [true, true], [true, false]]);
});

test("planMeter：休止槽位原样保留，位置按时值累加", () => {
  const plan = R.planMeter([{dur: 2}, {dur: 2, rest: true}, {dur: 1}], R.meterOf("4/4"));
  assert.deepEqual(plan.items.map(i => [i.pos, i.len, !!i.rest]), [[0, 2, false], [2, 2, true], [4, 1, false]]);
  assert.equal(plan.items[1].g.rest, true);
});

test("速度换算", () => {
  assert.equal(R.beatSeconds(60), 1);
  assert.equal(R.beatSeconds(120), 0.5);
  assert.equal(R.beatSeconds(0), 60 / 96, "非法速度退回 96");
});
