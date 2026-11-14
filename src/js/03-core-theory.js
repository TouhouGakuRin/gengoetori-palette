/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 调号、三全音、调式距离 */

function tritones(pcs){
  let c = 0;
  for(let i=0;i<pcs.length;i++)
    for(let j=i+1;j<pcs.length;j++)
      if(((pcs[j]-pcs[i])%12+12)%12 === 6) c++;
  return c;
}

function distance(a, b){
  const sa = new Set(a.pcs), sb = new Set(b.pcs);
  let onlyA = 0, onlyB = 0;
  sa.forEach(p => { if(!sb.has(p)) onlyA++; });
  sb.forEach(p => { if(!sa.has(p)) onlyB++; });
  const ta = tritones(a.pcs), tb = tritones(b.pcs);
  const qa = chordOf(a,0).sym, qb = chordOf(b,0).sym;
  const qDiff = (qa === qb) ? 0 : 0.5;
  const score = onlyA + onlyB + Math.abs(ta-tb)*0.5 + qDiff;
  /* pct 以 8 分为满分是经验口径，极端对（全音阶两种移位、半音阶对五声）会冲破 100，
     界面上写的是「/ 100」，这里封顶免得出现 150/100。 */
  return {onlyA, onlyB, ta, tb, qa, qb, score, pct: Math.min(100, Math.round(score/8*100))};
}

const SHARP_ORDER = [3,0,4,1,5,2,6];

const FLAT_ORDER  = [6,2,5,1,4,0,3];

const SHARP_STEP  = {3:38,0:35,4:39,1:36,5:33,2:37,6:34};

const FLAT_STEP   = {6:34,2:37,5:33,1:36,4:32,0:35,3:31};

function keySigAcc(f, li){
  if(f > 0) return SHARP_ORDER.slice(0, f).includes(li) ? 1 : 0;
  if(f < 0) return FLAT_ORDER.slice(0, -f).includes(li) ? -1 : 0;
  return 0;
}

function bestKeySig(notes){
  let best = null;
  for(let f = -7; f <= 7; f++){
    let cost = 0;
    for(const n of notes) cost += Math.abs(n.nacc - keySigAcc(f, n.li));
    const score = cost * 100 + Math.abs(f);
    if(!best || score < best.score) best = {f, cost, score};
  }
  return best;
}

function keySigName(f){
  if(f === 0) return "无升降号";
  return f > 0 ? `${f} 个升号` : `${-f} 个降号`;
}

/* ── 非七声音阶的调号：以调式根音为准，再按大小调色彩定型 ────────
   用户的决定（2026-10-26）：非七声不再一律「无调号」，改成照主音挂一个
   大调或小调的调号；色彩由调式定 —— 五声旋宫里宫、商、徵为大，角、羽为小。
   七声照旧（音阶本身就是某个调的关系调，取临时记号最少的那个）。 */

// 七个字母在五度圈上的位置：C=0、G=1、D=2、A=3、E=4、B=5、F=−1
const FIFTHS_OF_LETTER = {0: 0, 1: 2, 2: 4, 3: -1, 4: 1, 5: 3, 6: 5};

// 拼写出来的主音 → 大调调号的升降数（C♯=7、D♭=−5，超出 ±7 的夹回来）
function fifthsOfTonic(tonic){
  const f = FIFTHS_OF_LETTER[tonic.li] + 7 * (tonic.acc || 0);
  return Math.max(-7, Math.min(7, f));
}

/* 五声的「宫」：宫 = 主音按旋宫号往下推（商 −2、角 −4、徵 −7、羽 −9 半音），
   字母也要跟着退（商退 1 个字母、角退 2、徵退 4 再进 3、羽退 5 再进 2）。
   五声的升降号体系按宫所在的调走 —— 商调式主音 C 的宫是 Bb，第七个音就得写 Bb。 */
const GONG_SEMI   = [0, -2, -4, -7, -9];
const GONG_LETTER = [0, -1, -2, 3, 2];
function gongTonic(tonic, pentRot){
  const r = pentRot == null ? 0 : pentRot;
  const pc = ((tonic.pc + GONG_SEMI[r]) % 12 + 12) % 12;
  const li = ((tonic.li + GONG_LETTER[r]) % 7 + 7) % 7;
  let acc = ((pc - LPC[LETTERS[li]]) % 12 + 12) % 12;
  if(acc > 6) acc -= 12;
  return {pc, li, acc};
}
function gongFifths(tonic, pentRot){ return fifthsOfTonic(gongTonic(tonic, pentRot)); }

// 某个调号下七个字母各自的升降：喂给 bestKeySig 就能原样换回这个 f
function keyNotesOfFifths(f){
  const out = [];
  for(let li = 0; li < 7; li++) out.push({li: li, nacc: keySigAcc(f, li)});
  return out;}

/* 调式的色彩（大／小）。
   五声旋宫的判据是用户点的：宫(0)、商(1)、徵(3) 为大，角(2)、羽(4) 为小。
   其余按三级判：只有大三度 → 大，只有小三度 → 小；布鲁斯两者都有，按名字；
   连三级都没有的（全音阶、增音阶、梅西安、半音阶）退到亮度（≥0 算大）。 */
function keyColorOf(mode){
  if(mode.pentRot != null) return [0, 1, 3].includes(mode.pentRot) ? "major" : "minor";
  const has3 = mode.pcs.includes(3), has4 = mode.pcs.includes(4);
  if(has4 && !has3) return "major";
  if(has3 && !has4) return "minor";
  if(has3 && has4) return /major|大/i.test(mode.n + mode.cn) ? "major" : "minor";
  return (mode.bright >= 0) ? "major" : "minor";
}

/* 调式 + 主音 → 调号升降数。
   七声走「临时记号最少」的老办法（那本来就是标准答案）；
   非七声以主音为准：大调色彩取主音的大调，小调色彩取关系小调（主音小调）。
   半音阶十二个音哪个调号都装不下，固定不挂调号。 */
function keyFifthsFor(mode, tonic){
  if(mode.pcs.length === 7) return bestKeySig(spell(mode, tonic)).f;
  if(mode.pcs.length >= 11) return 0;
  const f = fifthsOfTonic(tonic);
  return keyColorOf(mode) === "minor" ? Math.max(-7, Math.min(7, f - 3)) : f;
}

// 给界面用的一句话：调号 + （非七声）按什么调
function keySigLabel(mode, f){
  const name = keySigName(f);
  if(mode.pcs.length === 7 || mode.pcs.length >= 11) return name;
  return `${name} · 按${keyColorOf(mode) === "minor" ? "小调" : "大调"}`;
}

/* ---------- 特征音：这条音阶比「本位」多出来的那个音 ---------- */

const REF_MAJOR = [0, 2, 4, 5, 7, 9, 11];   // 本位大调
const REF_MINOR = [0, 2, 3, 5, 7, 8, 10];   // 自然小调

/*
 * 拿「同主音的大调或自然小调」当底：有 ♭3 的跟小调比，没有的跟大调比。
 * 音阶里不在那条参照音阶上的音，就是这个调式的特征音 ——
 * 多利亚的 ♮6、利底亚的 ♯4、弗里几亚的 ♭2、和声小调的 ♮7，都是这么冒出来的。
 * 返回 {refName, hasMinor3, idx, pcs}：idx 是这些音在 mode.pcs 里的下标。
 */
function charNotes(mode){
  const pcs = mode.pcs || [];
  const hasMinor3 = pcs.indexOf(3) >= 0;
  const ref = hasMinor3 ? REF_MINOR : REF_MAJOR;
  const idx = [];
  for(let i = 0; i < pcs.length; i++) if(ref.indexOf(pcs[i]) < 0) idx.push(i);
  return {
    refName: hasMinor3 ? "自然小调" : "大调",
    hasMinor3,
    idx,
    pcs: idx.map(i => pcs[i]),
  };
}
