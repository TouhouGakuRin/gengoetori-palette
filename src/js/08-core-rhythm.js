/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 节拍与时值：拍号、时值分解、跨小节切分、休止符 —— 纯函数，不碰 DOM。

   时值统一用「四分音符为 1 拍」的拍数（quarter-beat）：
   4/4 一小节 = 4，3/4 = 3，2/4 = 2。跟 MIDI 的 TPQ、播放的秒数都只差一个乘数。 */

const METERS = [
  {id: "4/4", beats: 4, unit: 4, cn: "4/4"},
  {id: "3/4", beats: 3, unit: 4, cn: "3/4"},
  {id: "2/4", beats: 2, unit: 4, cn: "2/4"},
];

function meterOf(id){
  return METERS.find(m => m.id === id) || METERS[0];
}

// 一小节多少拍（只有 x/4，所以就是 beats；留着这个函数是为了以后加 6/8）
function barBeats(meter){ return meter.beats * (4 / meter.unit); }

/* 拍数 → 记谱时值。这里只出现「不需要符尾」的时值（全音符 / 二分 / 四分 / 附点二分），
   所以谱面不用画符尾，符干仍然是一根直线。 */
function noteValueOf(beats){
  const v = Math.round(beats);
  if(v >= 4) return {v: 4, n: "whole", dots: 0};
  if(v === 3) return {v: 3, n: "half", dots: 1};
  if(v === 2) return {v: 2, n: "half", dots: 0};
  return {v: 1, n: "quarter", dots: 0};
}

const DUR_CN = {1: "四分音符", 2: "二分音符", 3: "附点二分", 4: "全音符"};
function durationLabel(beats){
  const v = Math.round(beats);
  return `${v} 拍 · ${DUR_CN[v] || "四分音符"}`;
}

/* 把一段 [pos, pos+len) 切成「能记谱」的片段。三条规则（记谱通例）：
     1. 绝不跨小节线 —— 跨了就前后各记一个、中间加连线；
     2. 附点二分（3 拍）只在小节头用，别在小节中间写附点；
     3. 全音符（4 拍）只在整小节。
   休止符另外不许用附点值（noDot），3 拍要写成「二分 + 四分」两个休止。 */
function decomposeBeats(pos, len, barLen, opts){
  const noDot = !!(opts && opts.noDot);
  const out = [];
  let p = pos, left = Math.max(1, Math.round(len));
  while(left > 0){
    const inBar = ((p % barLen) + barLen) % barLen;
    const n = Math.min(left, barLen - inBar);
    let v;
    if(n >= 4 && inBar === 0 && left >= 4) v = 4;          // 整小节全音符
    else if(n === 3 && inBar === 0 && !noDot) v = 3;        // 小节头的附点二分
    else if(n >= 2) v = 2;
    else v = 1;
    out.push({pos: p, len: v});
    p += v; left -= v;
  }
  return out;
}

/* 一串带时值的组 → 谱面事件。groups 每项要有 dur（拍数），可选 rest: true。
   tieIn / tieOut 标出「这一片是长音的中间段」，画谱时前后连线。 */
function planMeter(groups, meter){
  const bar = barBeats(meter);
  const items = [];
  let pos = 0;
  (groups || []).forEach((g, gi) => {
    const len = Math.max(1, Math.round(g.dur || 1));
    const pieces = decomposeBeats(pos, len, bar, {noDot: !!g.rest});
    pieces.forEach((p, k) => {
      items.push({
        g: g, gi: gi, pos: p.pos, len: p.len, rest: !!g.rest,
        tieIn: k > 0, tieOut: k < pieces.length - 1,
      });
    });
    pos += len;
  });
  return {items: items, total: pos, bar: bar, bars: Math.max(1, Math.ceil(pos / bar))};
}

// 休止符落在哪：全休止挂第四条线，二分/四分坐在第三条线（中线）
function restOfValue(len){
  if(len >= 4) return {kind: "whole", line: "top"};
  if(len === 2) return {kind: "half", line: "mid"};
  return {kind: "quarter", line: "mid"};
}

// 速度 → 一拍多少秒
function beatSeconds(bpm){ return 60 / Math.max(1, bpm || 96); }
