/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 五线谱渲染：SMuFL（Bravura）字形 + 雕版度量 —— 纯函数，输入 groups/opts，输出 SVG 片段 */

/* 单位约定：1 步（相邻线/间）= HALF = 5 单位；1 间（两条线之间）= 2 步 = 1 sp = 10 单位。
   Bravura 的 em = 4 sp，所以字号 = 4*10 = 40；字形以「音符所在线/间」为基线。 */
const SP = 10, HALF = 5, FONT = 40;
const G = {
  gClef: "\uE050", fClef: "\uE062",
  sharp: "\uE262", flat: "\uE260", natural: "\uE261",
  nhBlack: "\uE0A4", nhHalf: "\uE0A3", nhWhole: "\uE0A2",
  brace: "\uE000",
  // 拍号数字（U+E080 起）与休止符、附点
  ts0: "\uE080", ts1: "\uE081", ts2: "\uE082", ts3: "\uE083", ts4: "\uE084",
  restWhole: "\uE4E3", restHalf: "\uE4E4", restQuarter: "\uE4E5",
  augDot: "\uE1E7",
};
const MET = {
  staffLine: 0.13 * SP, stem: 0.12 * SP, ledger: 0.16 * SP, ledgerExt: 0.4 * SP,
  noteW: 1.18 * SP, noteH: 0.5 * SP, stemLen: 3.5 * SP,
  accSharpW: 0.996 * SP, accFlatW: 0.904 * SP, accNatW: 0.672 * SP,
  braceW: 0.278 * SP, braceH: 3.997 * SP,
  // Bravura 实测：♭ 的墨迹重心在基线之上 0.52sp，而雕版要的是「碗」落在音符位置
  // （碗约占 -0.7sp…+0.9sp，中心 ≈ +0.1sp），所以只需下移 0.1sp
  flatDrop: 0.1 * SP,

};
const STAVES = {
  treble: {glyph: G.gClef, bot: 30, top: 38, anchor: 32, kshift: 0, clefW: 2.684 * SP},
  bass:   {glyph: G.fClef, bot: 18, top: 26, anchor: 24, kshift: -14, clefW: 2.736 * SP},
};

function staffShift(rootMidi, offs){
  const mid = rootMidi + (offs[0] + offs[offs.length-1]) / 2;
  return Math.round((67 - mid) / 12) * 12;
}

/* 一个音符要带几个记号、占多宽：调号里已有的不算，还原号单独一个宽度 */
function staffAccW(n, f){
  const ksAcc = keySigAcc(f, n.li), alt = n.nacc - ksAcc;
  if(alt === 0) return 0;
  if((alt === 1 && ksAcc === -1) || (alt === -1 && ksAcc === 1)) return MET.accNatW;
  return Math.abs(alt) * (alt > 0 ? MET.accSharpW : MET.accFlatW);
}

function drawStaff(groups, opts){
  opts = opts || {};
  if(opts.meter && groups.some(g => g.dur)) return drawStaffMetered(groups, opts);
  const SV = STAVES[opts.clef || "treble"];
  const K = opts.scale || 1.75;
  const slotW = opts.slotW || 46;
  const TOP = SV.top, BOT = SV.bot;
  const all = groups.flatMap(g => g.notes);
  const ks = bestKeySig(opts.keyNotes || all), f = ks.f;
  const nAcc = Math.abs(f);
  const ksGap = 16, ksStep = f > 0 ? 10 : 11.2;
  const clefW = opts.clefW || SV.clefW;
  const left = 14 + clefW + ksGap + nAcc * ksStep + 16;
  const right = 20;

  /* 间距按「这一组有多少个临时记号」伸缩：记号多的和弦自动占更宽的位置，
     否则半音阶这类每级都要 2–4 个记号的谱面会挤成一团。 */
  const accWOf = n => staffAccW(n, f);
  const geo = groups.map(g => {
    const accTotal = (g.notes || []).reduce((s, n) => s + (accWOf(n) ? accWOf(n) + 0.22 * SP : 0), 0);
    return {w: Math.max(slotW, MET.noteW + 0.9 * SP + accTotal + 10), cx0: 0};
  });
  let curW = left;
  for(const it of geo){ it.cx0 = curW + it.w / 2; curW += it.w; }
  const W = curW + right;
  const minS = Math.min(...all.map(n => n.step), BOT);
  const maxS = Math.max(...all.map(n => n.step), TOP);
  const lo = minS - 3, hi = maxS + 3;
  const padT = opts.padTop != null ? opts.padTop : 25;
  const padB = opts.padBot != null ? opts.padBot : 27;
  const H = (hi - lo) * HALF + padT + padB;
  const y = s => (hi - s) * HALF + padT;
  let o = "";

  /* 谱线 + 两端小节线 */
  for(let s = BOT; s <= TOP; s += 2)
    o += `<line class="sl" x1="12" y1="${y(s)}" x2="${W-12}" y2="${y(s)}"/>`;
  o += `<line class="bl" x1="${W-12}" y1="${y(TOP)}" x2="${W-12}" y2="${y(BOT)}"/>`;

  /* 谱号：基线落在 G 线（高音）/ F 线（低音） */
  o += `<text class="clef" x="14" y="${y(SV.anchor)}">${SV.glyph}</text>`;

  /* 调号：高音谱位置；低音谱整体下移 14 步（两个八度） */
  for(let i = 0; i < nAcc; i++){
    const li = f > 0 ? SHARP_ORDER[i] : FLAT_ORDER[i];
    const st = f > 0 ? SHARP_STEP[li] : FLAT_STEP[li];
    const gx = 14 + clefW + ksGap + i * ksStep;
    const ky = y(st + SV.kshift) + (f < 0 ? MET.flatDrop : 0);
    o += `<text class="ksig" x="${gx}" y="${ky}">${f > 0 ? G.sharp : G.flat}</text>`;
  }

  groups.forEach((g, gi) => {
    const cx = geo[gi].cx0;
    const body = paintChord(g, cx, {BOT: BOT, TOP: TOP, y: y, f: f});
    // mark：给每组包一个带序号的 <g>，播放时按序号高亮。不传就不包，保持基线不变。
    o += opts.mark ? `<g class="ch" data-gi="${gi}">${body}</g>` : body;
    if(g.label) o += `<text class="lab" x="${cx}" y="15">${g.label}</text>`;
    if(g.sub) o += `<text class="cnm" x="${cx}" y="${H - 9}">${g.sub}</text>`;
    // 声部进行违规：在标签上方点一个小红点（只有进行台的四声部会传 warn）
    if(g.warn) o += `<circle class="warn" cx="${cx}" cy="${(g.label ? 3 : 8)}" r="2.6"/>`;
  });

  return {markup: `<g transform="scale(${K})">${o}</g>`, W: W * K, H: H * K, f, cost: ks.cost,
    lineTop: y(TOP), lineBot: y(BOT), x0: 12};
}

/* 一个和弦（同一列的所有符头）画成一串 SVG。顺序是硬性的：加线 → 符头 → 临时记号 → 符干，
   否则后画的线会压在符头或记号上。ctx = {BOT, TOP, y(step), f, stem, dots}。 */
function paintChord(g, cx, ctx){
  const BOT = ctx.BOT, TOP = ctx.TOP, y = ctx.y, f = ctx.f;
  const off = MET.noteW / 2;                                // 符头半宽
  const steps = g.notes.map(n => n.step);
  const loS = Math.min(...steps), hiS = Math.max(...steps);
  const up = (loS + hiS) / 2 < (BOT + TOP) / 2;             // 重心在谱表上半 → 符干朝下
  let o = "";

  /* 相邻二度：规范 1.9.4.1「下面的符头总在符干左侧，上面的符头总在符干右侧」
     符干朝上时符干在符头右缘 → 上面的符头要移到符干右侧（+OFF）；
     符干朝下时符干在左缘 → 下面的符头要移到符干左侧（−OFF）。
     同一串连续二度（三音以上的音簇）左右交替，避免与另一枚同列符头打架。 */
  const OFF = MET.noteW + 0.12 * SP;
  const asc = g.notes.map((n, i) => ({n, i})).sort((a, b) => a.n.step - b.n.step);
  const dxs = new Array(g.notes.length).fill(0);
  for(let k = 0; k < asc.length; ){
    let j = k;
    while(j + 1 < asc.length && asc[j+1].n.step - asc[j].n.step === 1) j++;
    if(j > k){
      for(let q = k; q <= j; q++){
        const far = up ? ((q - k) % 2 === 1) : ((q - k) % 2 === 0);
        dxs[asc[q].i] = far ? (up ? OFF : -OFF) : 0;
      }
    }
    k = j + 1;
  }

  /* 加线：规范 1.1.4.2「除相邻二度可共用一条加线外，其余各画各的」
     所以每一级单独一条，只覆盖真正落在这一级（或更外侧）的符头。 */
  const need = new Set();
  for(const s of steps){
    if(s < BOT) for(let t = BOT - 2; t >= s; t -= 2) need.add(t);
    if(s > TOP) for(let t = TOP + 2; t <= s; t += 2) need.add(t);
  }
  for(const t of need){
    const xs = [];
    g.notes.forEach((n, i) => {
      if(t < BOT ? n.step <= t : n.step >= t) xs.push(cx + dxs[i]);
    });
    if(!xs.length) continue;
    const x1 = Math.min(...xs) - off - MET.ledgerExt;
    const x2 = Math.max(...xs) + off + MET.ledgerExt;
    o += `<line class="led" x1="${x1}" y1="${y(t)}" x2="${x2}" y2="${y(t)}"/>`;
  }

  /* 符头 */
  const nhCls = g.hi ? "nh hi" : "nh";                      // hi = 特征音，染暖色
  g.notes.forEach((n, i) => {
    const nx = cx + dxs[i], ny = y(n.step);
    const glyph = n.whole ? G.nhWhole : (n.half ? G.nhHalf : G.nhBlack);
    const w = n.whole ? 1.688 * SP : MET.noteW;
    o += `<text class="${nhCls}" x="${nx - w/2}" y="${ny}">${glyph}</text>`;
  });

  /* 附点：贴在符头右侧；符头骑在线上时，点落在它上方的间里。和弦里每个音各带一个点 */
  if(ctx.dots){
    g.notes.forEach((n, i) => {
      const w = n.whole ? 1.688 * SP : MET.noteW;
      const dx = cx + dxs[i] + w / 2 + 0.42 * SP;
      const dy = y(n.step + (n.step % 2 === 0 ? 1 : 0));
      for(let k = 0; k < ctx.dots; k++)
        o += `<text class="dot" x="${dx + k * 0.45 * SP}" y="${dy}">${G.augDot}</text>`;
    });
  }

  /* 临时记号：先贴自己符头左侧，撞到符头或别的记号就继续往左让 */
  const headBoxes = g.notes.map((n, i) => ({
    x0: cx + dxs[i] - off, x1: cx + dxs[i] + off,
    y0: y(n.step) - 0.5 * SP, y1: y(n.step) + 0.5 * SP,
    step: n.step, hx: cx + dxs[i]
  }));
  const accNeed = [];
  g.notes.forEach((n, i) => {
    const ksAcc = keySigAcc(f, n.li);
    const alt = n.nacc - ksAcc;
    if(alt === 0) return;
    let glyph, w;
    if((alt === 1 && ksAcc === -1) || (alt === -1 && ksAcc === 1)){ glyph = G.natural; w = MET.accNatW; }
    else if(alt > 0){ glyph = G.sharp.repeat(Math.abs(alt)); w = MET.accSharpW * Math.abs(alt); }
    else { glyph = G.flat.repeat(Math.abs(alt)); w = MET.accFlatW * Math.abs(alt); }
    const drop = alt < 0 ? MET.flatDrop : 0;
    accNeed.push({step: n.step, hx: cx + dxs[i], glyph, w, y: y(n.step) + drop});
  });
  // 高的先占内侧列（与实际雕版一致：上方记号的列更靠里）
  accNeed.sort((a, b) => b.step - a.step);
  const placed = [];
  for(const a of accNeed){
    const hTop = a.y - 1.35 * SP, hBot = a.y + 1.35 * SP;   // 记号墨迹高度约 ±1.35sp
    let x = a.hx - off - 0.45 * SP - a.w;
    for(let guard = 0; guard < 12; guard++){
      const self = headBoxes.find(h => h.hx === a.hx && h.step === a.step);
      const hitHead = headBoxes.some(h => h !== self && x < h.x1 + 0.1 * SP && x + a.w > h.x0 - 0.1 * SP
        && hBot > h.y0 && hTop < h.y1);
      const hitAcc = placed.some(p2 => x < p2.x1 && x + a.w > p2.x0 && hBot > p2.y0 && hTop < p2.y1);
      if(!hitHead && !hitAcc) break;
      x -= a.w + 0.22 * SP;
    }
    placed.push({x0: x, x1: x + a.w, y0: hTop, y1: hBot});
    o += `<text class="acc" x="${x}" y="${a.y}">${a.glyph}</text>`;
  }

  /* 符干：从最外侧符头起 3.5sp，附在符头边缘；全音符没有符干 */
  if(ctx.stem !== false){
    const stemX = up ? cx + off - MET.stem / 2 : cx - off + MET.stem / 2;
    o += up
      ? `<line class="st" x1="${stemX}" y1="${y(hiS) - MET.stemLen}" x2="${stemX}" y2="${y(loS)}"/>`
      : `<line class="st" x1="${stemX}" y1="${y(hiS)}" x2="${stemX}" y2="${y(loS) + MET.stemLen}"/>`;
  }
  return o;
}

/* ============ 带拍号的谱面 ============ */

/* 每组占多宽（只算临时记号造成的额外宽度）。两个谱表要对齐时取逐列的最大值。 */
function meterAccList(plan, f){
  return plan.items.map(it => {
    if(it.rest) return 0;
    return (it.g.notes || []).reduce((s, n) => s + (staffAccW(n, f) ? staffAccW(n, f) + 0.22 * SP : 0), 0);
  });
}

/* 列布局：拍号之后是各列圆心；小节线画在两列之间的空隙正中，不加额外宽度 ——
   这样每列宽度都严格跟时值成正比，等长的两小节视觉上就一样宽。
   o = {f, nAcc, ksStep, clefW, slotW, acc 可选（逐列额外宽度覆盖）} */
function meterLayout(plan, o){
  const digitW = 1.7 * SP, tsW = 2 * digitW;
  const tsX = 14 + o.clefW + 16 + o.nAcc * o.ksStep + 12 + 4;
  const x0 = 12;                                  // 起始小节线：贴谱表左端（连谱表另有括线）
  const left = tsX + tsW + 8;                     // 第一列从拍号右侧 8 处开始
  const unit = o.slotW * 0.55;                    // 每拍占多宽（比例记谱）
  const acc = o.acc || meterAccList(plan, o.f);
  const cols = [], bounds = [];
  let cur = left;
  plan.items.forEach((it, i) => {
    if(i > 0 && ((it.pos % plan.bar) + plan.bar) % plan.bar === 0) bounds.push(cur);
    const w = Math.max(it.len * unit, (it.rest ? 2.2 : 2.1) * SP + acc[i]);
    cols.push({w: w, cx: cur + w / 2});
    cur += w;
  });
  return {left: left, cols: cols, bounds: bounds, x0: x0, endX: cur,
    W: cur + 12, tsW: tsW, tsX: tsX, clefW: o.clefW, unit: unit};
}

/* 休止符：全休止挂在第四条线下方（Bravura 的 restWhole 基线以上只有 0.04sp），
   二分休止坐在第三条线上（restHalf 的墨迹在基线之上 0.57sp），四分休止以中线居中。 */
function paintRest(it, cx, ctx){
  const y = ctx.y, BOT = ctx.BOT, mid = BOT + 4;   // 中线＝第三条线
  let glyph, sy, w;
  if(it.len >= 4){ glyph = G.restWhole; sy = y(mid + 2); w = 1.7 * SP; }
  else if(it.len === 2){ glyph = G.restHalf; sy = y(mid); w = 1.35 * SP; }
  else { glyph = G.restQuarter; sy = y(mid); w = 1.35 * SP; }
  return `<text class="rst" x="${cx - w / 2}" y="${sy}">${glyph}</text>`;
}

/* 延音线：两端相接、中间鼓起的梭形（两条二次贝塞尔围成，端点细、中间粗） */
function tiePath(x1, x2, yy, sgn){
  const w = Math.max(14, x2 - x1), m = (x1 + x2) / 2;
  const d = 0.5 * SP * sgn, th = 0.16 * SP * sgn;
  const c1 = m - w * 0.24, c2 = m + w * 0.24;
  return `<path class="tie" d="M${x1} ${yy} C${c1} ${yy + d}, ${c2} ${yy + d}, ${x2} ${yy}`
    + ` C${c2} ${yy + d + th}, ${c1} ${yy + d + th}, ${x1} ${yy}Z"/>`;
}

function drawStaffMetered(groups, opts){
  const SV = STAVES[opts.clef || "treble"], TOP = SV.top, BOT = SV.bot;
  const K = opts.scale || 1.75, slotW = opts.slotW || 46;
  const meter = opts.meter || METERS[0];
  const all = groups.flatMap(g => g.notes || []);
  const ks = bestKeySig(opts.keyNotes || all), f = ks.f, nAcc = Math.abs(f);
  const ksGap = 16, ksStep = f > 0 ? 10 : 11.2;
  const plan = opts.plan || planMeter(groups, meter);
  const sh = opts.share || meterLayout(plan, {
    f: f, nAcc: nAcc, ksStep: ksStep, clefW: opts.clefW || SV.clefW, slotW: slotW});
  const clefW = sh.clefW, W = sh.W;

  const minS = all.length ? Math.min(...all.map(n => n.step), BOT) : BOT;
  const maxS = all.length ? Math.max(...all.map(n => n.step), TOP) : TOP;
  const lo = minS - 3, hi = maxS + 3;
  const padT = opts.padTop != null ? opts.padTop : 25;
  const padB = opts.padBot != null ? opts.padBot : 27;
  const H = (hi - lo) * HALF + padT + padB;
  const y = s => (hi - s) * HALF + padT;
  let o = "";

  /* 谱线贯通整行；起始、每小节、终止各一道小节线（终止＝细＋粗） */
  const clefX = 14;
  for(let s = BOT; s <= TOP; s += 2)
    o += `<line class="sl" x1="12" y1="${y(s)}" x2="${sh.endX - 3}" y2="${y(s)}"/>`;
  o += `<line class="bl" x1="${sh.x0}" y1="${y(TOP)}" x2="${sh.x0}" y2="${y(BOT)}"/>`;
  for(const bx of sh.bounds)
    o += `<line class="bl" x1="${bx}" y1="${y(TOP)}" x2="${bx}" y2="${y(BOT)}"/>`;
  o += `<line class="bl" x1="${sh.endX - 6.5}" y1="${y(TOP)}" x2="${sh.endX - 6.5}" y2="${y(BOT)}"/>`;
  o += `<line class="bl2" x1="${sh.endX - 3}" y1="${y(TOP)}" x2="${sh.endX - 3}" y2="${y(BOT)}"/>`;

  /* 谱号 */
  o += `<text class="clef" x="${clefX}" y="${y(SV.anchor)}">${SV.glyph}</text>`;

  /* 调号：高音谱位置；低音谱整体下移 14 步 */
  for(let i = 0; i < nAcc; i++){
    const li = f > 0 ? SHARP_ORDER[i] : FLAT_ORDER[i];
    const st = f > 0 ? SHARP_STEP[li] : FLAT_STEP[li];
    const gx = clefX + clefW + ksGap + i * ksStep;
    const ky = y(st + SV.kshift) + (f < 0 ? MET.flatDrop : 0);
    o += `<text class="ksig" x="${gx}" y="${ky}">${f > 0 ? G.sharp : G.flat}</text>`;
  }

  /* 拍号：分子占上半、分母占下半；字形自带 2sp 高、基线居中 */
  const tsX = sh.tsX;
  const tsGlyph = d => G["ts" + d] || G.ts4;
  o += `<text class="ts" x="${tsX}" y="${y(TOP - 2)}">${tsGlyph(meter.beats)}</text>`;
  o += `<text class="ts" x="${tsX}" y="${y(BOT + 2)}">${tsGlyph(meter.unit)}</text>`;

  /* 音符 / 休止 / 延音线 */
  plan.items.forEach((it, i) => {
    const cx = sh.cols[i].cx;
    if(it.rest){
      o += paintRest(it, cx, {BOT: BOT, TOP: TOP, y: y});
      return;
    }
    const whole = it.len >= 4, half = it.len === 2 || it.len === 3, dots = it.len === 3 ? 1 : 0;
    const g2 = {notes: it.g.notes.map(n => Object.assign({}, n, {whole: whole, half: half}))};
    o += paintChord(g2, cx, {BOT: BOT, TOP: TOP, y: y, f: f, stem: !whole, dots: dots});

    /* 被小节线切断的长音：前一片和这一片之间补一道延音线，弧在符干的反侧 */
    if(it.tieIn && i > 0){
      const prev = plan.items[i - 1];
      const pSteps = prev.g.notes.map(n => n.step);
      const upPrev = (Math.min(...pSteps) + Math.max(...pSteps)) / 2 < (BOT + TOP) / 2;
      const sgn = upPrev ? 1 : -1;
      /* 前一片带附点时，线要从附点右边起画，不然会穿过那个点 */
      const x1 = sh.cols[i - 1].cx + MET.noteW / 2 + 1.5 + (prev.len === 3 ? 0.95 * SP : 0);
      const pcx = x1;
      for(const n of it.g.notes){
        const yy = y(n.step) + 0.62 * SP * sgn;
        o += tiePath(pcx, cx - MET.noteW / 2 - 1.5, yy, sgn);
      }
    }
  });

  /* 组的标签 / 和弦记号 / 违规红点：与 drawStaff 同款，画在该组第一片的列上
     （跨小节被切成两片的长音只在首片画一次）。进行台全程走 metered 路径，
     以前这里什么都不画，级数标签与四部和声的违规红点全被吞掉。 */
  const firstPiece = {};
  plan.items.forEach((it, i) => {
    if(firstPiece[it.gi] === undefined) firstPiece[it.gi] = i;
  });
  groups.forEach((g, gi) => {
    const i = firstPiece[gi];
    if(i === undefined) return;
    const cx = sh.cols[i].cx;
    if(g.label) o += `<text class="lab" x="${cx}" y="15">${g.label}</text>`;
    if(g.sub) o += `<text class="cnm" x="${cx}" y="${H - 9}">${g.sub}</text>`;
    if(g.warn) o += `<circle class="warn" cx="${cx}" cy="${(g.label ? 3 : 8)}" r="2.6"/>`;
  });

  return {markup: `<g transform="scale(${K})">${o}</g>`, W: W * K, H: H * K, f, cost: ks.cost,
    lineTop: y(TOP), lineBot: y(BOT), x0: sh.x0, xEnd: sh.endX - 3};
}

/* 单谱表多行：一组放不下就折行（真正的乐谱一行不会塞下十个和弦） */
function drawRows(groups, opts){
  opts = opts || {};
  const max = opts.maxSlots || 7;
  if(groups.length <= max) return drawStaff(groups, opts);
  const K = opts.scale || 1.75;
  const parts = [];
  for(let i = 0; i < groups.length; i += max)
    parts.push(drawStaff(groups.slice(i, i + max), Object.assign({}, opts, {scale: 1})));
  const gap = 14;
  let yy = 0, body = "";
  for(const p of parts){
    body += `<g transform="translate(0,${yy})">${p.markup}</g>`;
    yy += p.H + gap;
  }
  const W = Math.max(...parts.map(p => p.W));
  const H = yy - gap;
  return {markup: `<g transform="scale(${K})">${body}</g>`, W: W * K, H: H * K, f: parts[0].f, cost: 0};
}

/* 一行放不下就把大谱表折成多行 —— 断点只落在小节线上（真正的乐谱绝不会从小节中间换行）。
   折行时按「列」切、不再按「组」切：跨小节的长音本来就被切成两片，正合适分到两行去。 */
function drawGrandSystems(tre, bas, opts, planT, planB, share){
  const maxW = opts.maxW, bar = planT.bar;
  const barW = {};
  planT.items.forEach((it, i) => {
    const b = Math.floor(it.pos / bar);
    barW[b] = (barW[b] || 0) + share.cols[i].w;
  });
  const budget = maxW - share.left - 12;
  const systems = [];
  let cur = [], curW = 0, curBar = -1;
  planT.items.forEach((it, i) => {
    const b = Math.floor(it.pos / bar);
    if(b !== curBar && cur.length && curW + (barW[b] || 0) > budget){
      systems.push(cur); cur = []; curW = 0;
    }
    curBar = b;
    cur.push(i);
    curW += share.cols[i].w;
  });
  if(cur.length) systems.push(cur);
  if(systems.length <= 1) return null;

  const pick = (plan, idx) => idx.map(i => {
    const it = plan.items[i];
    if(it.rest) return {dur: it.len, rest: true, notes: []};
    return {dur: it.len, notes: it.g.notes, label: it.g.label, sub: it.g.sub};
  });

  const K = opts.scale || 1.6, gap = 24;
  const parts = systems.map(idx =>
    drawGrand(pick(planT, idx), pick(planB, idx),
      Object.assign({}, opts, {maxW: 0, scale: 1, padTop: 22, padBot: 22})));
  let yy = 0, body = "";
  for(const p of parts){
    body += `<g transform="translate(0,${yy})">${p.markup}</g>`;
    yy += p.H + gap;
  }
  const W = Math.max(...parts.map(p => p.W));
  return {markup: `<g transform="scale(${K})">${body}</g>`, W: W * K, H: (yy - gap) * K, f: parts[0].f};
}

/* 多行谱（四声部 SATB 用）：每行一个谱表，共用一套列布局，左侧用直连谱号（1.2.2.3）
   —— 一条粗纵线 + 两端朝向谱表的短横，右边紧贴一条贯通到底的连谱线。 */
function drawStack(rows, opts){
  opts = opts || {};
  const K = opts.scale || 1.2, gap = 14;

  let extras = rows.map(() => ({}));
  if(opts.meter){
    const plans = rows.map(r => planMeter(r.groups, opts.meter));
    if(plans.length && plans.every(p => p.items.length === plans[0].items.length)){
      const nodes = rows.flatMap(r => r.groups).flatMap(g => g.notes || []);
      const f = bestKeySig(opts.keyNotes || nodes).f;
      const clefW = Math.max.apply(null, rows.map(r => STAVES[r.clef].clefW));
      const accs = plans.map(p => meterAccList(p, f));
      const acc = accs[0].map((_, i) => Math.max.apply(null, accs.map(a => a[i] || 0)));
      const share = meterLayout(plans[0], {
        f: f, nAcc: Math.abs(f), ksStep: f > 0 ? 10 : 11.2,
        clefW: clefW, slotW: opts.slotW || 46, acc: acc});
      extras = plans.map(p => ({plan: p, share: share}));
    }
  }

  const parts = rows.map((r, i) => drawStaff(r.groups,
    Object.assign({}, opts, {clef: r.clef, scale: 1, padTop: 10, padBot: 8}, extras[i])));

  let yy = 0, body = "";
  const tops = [];
  parts.forEach(p => {
    tops.push(yy);
    body += `<g transform="translate(0,${yy})">${p.markup}</g>`;
    /* 声部名放在每行左端上方 */
    yy += p.H + gap;
  });
  const W = Math.max.apply(null, parts.map(p => p.W)), H = yy - gap;

  /* 直连谱号：粗线在左、细线贴右，从第一行顶线贯通到最后一行底线 */
  const topLine = tops[0] + parts[0].lineTop;
  const lastPi = parts.length - 1;
  const botLine = tops[lastPi] + parts[lastPi].lineBot;
  const x0 = parts[0].x0;
  const bracket = `<line class="bl2" x1="${x0 - 4.6}" y1="${topLine}" x2="${x0 - 4.6}" y2="${botLine}" stroke-width="3.4"/>`
    + `<path class="brk" d="M${x0 - 5.2} ${topLine + 3} L${x0 - 1.4} ${topLine} M${x0 - 5.2} ${botLine - 3} L${x0 - 1.4} ${botLine}"/>`
    + `<line class="bl" x1="${x0}" y1="${topLine}" x2="${x0}" y2="${botLine}"/>`;

  return {markup: `<g transform="scale(${K})">${bracket}${body}</g>`, W: W * K, H: H * K, f: parts[0].f};
}

/* 大谱表：高音谱（S/A）叠在低音谱（T/B）上面，左侧连谱表用直线+两端小横（编排惯例）。 */
function drawGrand(trebleGroups, bassGroups, opts){
  opts = opts || {};
  const K = opts.scale || 1.6;

  /* 有拍号时上下两行必须共用同一套列布局，否则小节线会上下错开。
     逐列宽度取两行的最大值，谱号宽度取宽的（低音谱号略宽）。 */
  let extraT = {}, extraB = {};
  if(opts.meter && (trebleGroups.some(g => g.dur) || bassGroups.some(g => g.dur))){
    const planT = planMeter(trebleGroups, opts.meter), planB = planMeter(bassGroups, opts.meter);
    if(planT.items.length === planB.items.length){
      const nodes = trebleGroups.concat(bassGroups).flatMap(g => g.notes || []);
      const f = bestKeySig(opts.keyNotes || nodes).f;
      const clefW = Math.max(STAVES.treble.clefW, STAVES.bass.clefW);
      const aT = meterAccList(planT, f), aB = meterAccList(planB, f);
      const acc = aT.map((w, i) => Math.max(w, aB[i] || 0));
      const share = meterLayout(planT, {
        f: f, nAcc: Math.abs(f), ksStep: f > 0 ? 10 : 11.2,
        clefW: clefW, slotW: opts.slotW || 46, acc: acc});
      if(opts.maxW && share.W > opts.maxW){
        const multi = drawGrandSystems(trebleGroups, bassGroups, opts, planT, planB, share);
        if(multi) return multi;
      }
      extraT = {plan: planT, share: share};
      extraB = {plan: planB, share: share};
    }
  }

  const tg = drawStaff(trebleGroups, Object.assign({}, opts, {clef: "treble", scale: 1, padBot: 6}, extraT));
  const bg = drawStaff(bassGroups, Object.assign({}, opts, {clef: "bass", scale: 1, padTop: 6}, extraB));
  const gap = 16;
  const W = Math.max(tg.W, bg.W);
  const H = tg.H + gap + bg.H;

  /* 连谱号（规范 1.2.2）：大谱表用**花连谱号**——形状如大括号「{」，
     中间的尖角朝左、两个端角朝向连谱线；连谱线是左端一条细纵线，
     从高音谱表顶线一直贯通到低音谱表底线。
     Bravura 的 brace 字形自然尺寸 0.278sp 宽 × 4sp 高、坐在基线上；
     竖向拉到两行谱表的外框，横向同时放宽到 0.72 个间距（不然拉长后会细成一根线）。 */
  const topLine = tg.lineTop, botLine = tg.H + gap + bg.lineBot;
  const x0 = tg.x0, span = botLine - topLine;
  const bw = 1.0 * SP, sx = bw / MET.braceW, sy = span / MET.braceH;
  const bx = x0 - 1.8 - bw;
  const bracket = `<g transform="translate(${bx},${botLine}) scale(${sx},${sy})"><text class="brc" x="0" y="0">${G.brace}</text></g>`
    + `<line class="bl" x1="${x0}" y1="${topLine}" x2="${x0}" y2="${botLine}"/>`;
  const markup = `<g transform="scale(${K})">`
    + bracket
    + `<g>${tg.markup}</g>`
    + `<g transform="translate(0,${tg.H + gap})">${bg.markup}</g>`
    + `</g>`;
  return {markup, W: W * K, H: H * K, f: tg.f};
}

function staffScaleGroups(){
  const m = activeMode(), t = tonicObj(), sp = spell(m, t);
  const n = m.pcs.length, base = 60 + t.pc, gs = [];
  const ch = (typeof charNotes === "function") ? charNotes(m) : {idx: []};
  for(let i = 0; i < n; i++){
    const midi = base + m.pcs[i], oct = octaveFor(sp[i].li, midi);
    gs.push({label: sp[i].roman, sub: sp[i].name,
      hi: ch.idx.indexOf(i) >= 0,                       // 特征音：谱面上染暖色
      notes: [{step: sp[i].li + 7 * oct, li: sp[i].li, nacc: sp[i].nacc}]});
  }
  const oct2 = octaveFor(sp[0].li, base + 12);
  gs.push({label: sp[0].roman + "′", sub: sp[0].name,
    notes: [{step: sp[0].li + 7 * oct2, li: sp[0].li, nacc: sp[0].nacc}]});
  return gs;
}


/* 和弦音按「三度叠置」拼写：从根音字母出发，按音程类别推字母（TERTIAN_LETTER 在 00-core-pitch.js），
   再算升降号。这样 C 上的小三度写成 Eb 而不是 D#，不会在谱面上造出虚假的二度碰撞。 */
function spellTone(li0, rootMidi, midi){
  const pc = ((midi - rootMidi) % 12 + 12) % 12;
  const li = (li0 + TERTIAN_LETTER[pc]) % 7;
  const oct = octaveFor(li, midi);
  const nacc = midi - (12 * (oct + 1) + LPC[LETTERS[li]]);
  return {step: li + 7 * oct, li, nacc};
}

/* 优先用「临时记号更少」的写法：音阶自身的拼写 vs 三度拼写，谁少用谁；
   平手时取三度拼写（这样 Cm 写成 C-Eb-G 而不是 C-D#-G，谱面不会造出假二度）。 */
function pickSpelling(li0, rootMidi, midi, alt){
  const a = spellTone(li0, rootMidi, midi);
  if(!alt) return a;
  return Math.abs(alt.nacc) < Math.abs(a.nacc) ? alt : a;   // 平手时用三度拼写
}

function staffChordGroups(){
  const m = activeMode(), t = tonicObj(), sp = spell(m, t);
  const n = m.pcs.length, base = 60 + t.pc, gs = [];
  for(let i = 0; i < n; i++){
    const v = chordVoicing(m, i);
    const r0 = base + m.pcs[i];
    const sh = staffShift(r0, v.off);
    const li0 = sp[i].li;
    const notes = v.off.map((o, k) => {
      const midi = r0 + o + sh, j = v.degs[k];
      const octS = octaveFor(sp[j].li, midi);
      return pickSpelling(li0, r0, midi, {step: sp[j].li + 7*octS, li: sp[j].li, nacc: sp[j].nacc});
    });
    gs.push({label: sp[i].roman, sub: sp[i].name + (chordOf(m, i).sym || "") + (v.inv > 0 ? "/" + sp[v.degs[0]].name : ""), notes});
  }
  return gs;
}

/* 调号：七声照旧（音阶本身就是某个调的关系调）；
   非七声照用户定的规则——以调式根音为准，按大小调色彩挂大调或小调的调号。 */
function modeKeyNotes(){
  const m = activeMode(), t = tonicObj();
  if(m.pcs.length === 7) return spell(m, t).map(s => ({li: s.li, nacc: s.nacc}));
  return keyNotesOfFifths(keyFifthsFor(m, t));
}
