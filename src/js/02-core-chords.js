/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 叠三度、三/七和弦、转位与开放排列 */

const QUAL = {
  "0,4,7":"", "0,3,7":"m", "0,3,6":"dim", "0,4,8":"aug",
  "0,2,7":"sus2", "0,5,7":"sus4", "0,2,6":"dim(sus2)", "0,4,6":"(b5)", "0,3,8":"m(#5)",
  "0,1,7":"?", "0,1,6":"?", "0,5,6":"?", "0,4,9":"?",
  "0,4,7,11":"maj7", "0,3,7,11":"m(maj7)", "0,4,7,10":"7", "0,3,7,10":"m7",
  "0,3,6,10":"m7b5", "0,3,6,9":"dim7", "0,4,8,11":"maj7(#5)", "0,4,8,10":"7(#5)",
  "0,4,6,10":"7(b5)", "0,3,8,10":"m7(#5)", "0,5,7,10":"7sus4", "0,2,7,10":"7sus2",
  "0,4,7,9":"6", "0,3,7,9":"m6", "0,2,6,10":"?", "0,1,6,10":"?", "0,3,6,11":"?",
  "0,4,6,9":"?", "0,3,7,8":"?", "0,2,7,11":"?"
};

// 查不到现成名字时用的兜底：把音程写成 9 / 11 / 13 这类通用叫法
// 延伸音的叫法（9 / 11 / 13 才是和弦上的说法；b5 在这里其实是 #11）
const EXT_LABEL = { 1:"b9", 2:"9", 3:"#9", 5:"11", 6:"#11", 8:"b13", 9:"13" };
const IV_LABEL = { 1:"b9", 2:"9", 3:"m3", 4:"M3", 5:"11", 6:"b5", 7:"5", 8:"b13", 9:"13", 10:"b7", 11:"M7" };
function ivLabel(iv){
  return iv.slice(1).map(x => IV_LABEL[x] || x).join("·");
}

// 双音（只有两个音时）
const DYAD = { "0,7":"5", "0,4":"(3)", "0,3":"m(3)", "0,5":"(4)", "0,2":"(2)", "0,6":"(b5)", "0,1":"(b2)", "0,8":"(m6)" };

// 音数上限：最多叠到十三和弦（7 个音）
// 「隔一个音」能取到多少个不同的音：偶数音数 n 只有 n/2 个（全音阶 6 个音只能叠出 3 个），
// 奇数音数才有 n 个。超过这个数必然绕回来重复，所以上限得按这个算。
const CHORD_MAX = 7;
function chordDegreeMax(n){
  return Math.min(CHORD_MAX, n % 2 ? n : n / 2);
}
function sizeLabel(n){
  return ({2:"二音", 3:"三和弦", 4:"七和弦", 5:"九和弦", 6:"十一和弦", 7:"十三和弦"})[n] || (n + " 音");
}
function sizeCap(mode){
  return chordDegreeMax(mode ? mode.pcs.length : 7);
}

// 和弦音数：七声取 4（七和弦），五/六声只有 3 个不重复的「隔一音」位置
function chordSize(mode, voicing){
  const n = mode.pcs.length;
  const v = voicing || (typeof state !== "undefined" ? state.voicing : "7") || "7";
  if(v === "3") return Math.min(3, Math.ceil(n / 2));
  return Math.min(4, Math.max(3, Math.ceil(n / 2)));
}

// voicing: "3" = 三和弦，"7" = 七和弦；不传时取界面上的默认值
// 五声纵合：在音阶内按纯五度往上叠（宫 → 徵 → 商 → 羽）
// 三度叠置在五声音阶里会得到 1-3-6 这种「缺一个音」的和弦，五度叠置才是它的本色。
function quintalDegrees(m, idx, size){
  // 五度相生链：宫 → 徵 → 商 → 羽 → 角，在这个链上取相邻的三个音
  // （从 宫 起 C G D / G D A / D A E / A E C / E C G，每个都是站得住的三音和弦）
  const names = m.degNames || [];
  const chain = ["宫", "徵", "商", "羽", "角"].map(nm => names.indexOf(nm)).filter(i => i >= 0);
  if(chain.length === 5){
    const k = chain.indexOf(idx);
    if(k >= 0){
      const out = [];
      for(let i = 0; i < size; i++) out.push(chain[(k + i) % 5]);
      return out;
    }
  }
  // 兜底（没有宫商角徵羽标记的五声音阶）：按纯五度往上找
  const pcs = m.pcs, out = [idx];
  let cur = pcs[idx];
  for(let k = 1; k < size; k++){
    const j = pcs.indexOf(((cur + 7) % 12 + 12) % 12);
    if(j < 0 || out.indexOf(j) >= 0) break;
    out.push(j);
    cur = pcs[j];
  }
  return out;
}

// 取「隔一个音阶音」的 n 个下标：i, i+2, i+4 …（对任意音数都成立，偶数音数也不会重复）
// 五声且用户选了「五度叠置」时，改走 quintalDegrees
function chordDegrees(idx, voicing, mode, size){
  const m = mode
    || (typeof baseMode === "function" ? baseMode() : null)
    || (typeof byId === "function" && typeof state !== "undefined" ? byId(state.A) : null);
  const n = m ? m.pcs.length : 7;
  const cap = Math.min(CHORD_MAX, n);
  const want = size ? Math.max(2, Math.min(cap, Math.round(size))) : 0;
  const useQ = m && n === 5 && !want && typeof state !== "undefined" && state.pentaChord === "quintal";
  if(useQ){
    const s = voicing === "3" ? 3 : 4;
    return quintalDegrees(m, idx, s);
  }
  const s = want || chordSize(m || {pcs: new Array(7).fill(0)}, voicing);
  /* 隔一个音取和弦音：绕回同一个音就停（音阶只有 6 个音时，第 4 个音会绕回根音，
     以前会叠出 0-4-8-0 这种重复音的和弦）。 */
  const out = [];
  for(let k = 0; k < Math.min(s, chordDegreeMax(n)); k++){
    const j = (idx + 2 * k) % n;
    if(out.indexOf(j) >= 0) break;
    out.push(j);
  }
  return out;
}

// 从一堆音程里挑出「三度叠起来的那几个」当骨架，剩下的当延伸音
function splitCore(iv){
  const has = x => iv.indexOf(x) >= 0;
  const third = [4,3].find(has), fifth = [7,6,8].find(has), sev = [10,11,9].find(has);
  if(third !== undefined && fifth !== undefined && sev !== undefined){
    const core = [0, third, fifth, sev];
    const k = QUAL[core.join(",")];
    if(k !== undefined && k !== "?" && k.indexOf("?") < 0){
      return {core, rest: iv.filter(x => core.indexOf(x) < 0)};
    }
  }
  if(third !== undefined && fifth !== undefined){
    const core = [0, third, fifth];
    const k = QUAL[core.join(",")];
    if(k !== undefined && k !== "?" && k.indexOf("?") < 0){
      return {core, rest: iv.filter(x => core.indexOf(x) < 0)};
    }
  }
  return null;
}

// 音集 → 和弦名：3/4 音查表，2 音查双音表，5 音以上「基础和弦(延伸音)」
function symbolOf(iv){
  const key = iv.join(",");
  if(iv.length === 2){
    const d = DYAD[key];
    return d !== undefined ? d : "(" + ivLabel(iv) + ")";
  }
  if(iv.length >= 5){
    const sc = splitCore(iv);
    if(sc && sc.rest.length){
      return QUAL[sc.core.join(",")] + "(" + sc.rest.map(x => EXT_LABEL[x] || x).join("·") + ")";
    }
    if(sc) return QUAL[sc.core.join(",")];
    return "(" + ivLabel(iv) + ")";
  }
  let sym = QUAL[key];
  if(sym === undefined || sym === "?"){
    const tri = QUAL[iv.slice(0,3).join(",")];
    if(tri !== undefined && tri !== "?" && iv.length <= 4) sym = tri + (iv.length > 3 ? "+" : "");
    else sym = "(" + ivLabel(iv) + ")";
  } else if(sym.indexOf("?") >= 0){
    sym = sym.replace("?", ivLabel(iv));
  }
  return sym;
}

function chordOf(mode, idx, voicing, size){
  const v = voicing || state.voicing || "7";
  const pcs = mode.pcs;
  const idxs = chordDegrees(idx, v, mode, size);
  const iv = idxs.map(j => (pcs[j] - pcs[idx] + 12) % 12).sort((a,b)=>a-b);
  return {idx, tones: idxs.map(j => pcs[j]), iv, sym: symbolOf(iv), key: iv.join(","), degs: idxs};
}

function chordVoicing(mode, idx, opts){
  const o = opts || {};
  const degs = chordDegrees(idx, o.voicing, mode, o.size);
  const n = degs.length;
  const inv = Math.min(Math.max(o.inv !== undefined ? o.inv : (state.inv || 0), 0), n - 1);
  const open = (o.spread || state.spread) === "open";
  const rels = degs.map(j => (mode.pcs[j] - mode.pcs[idx] + 12) % 12);
  const order = [];
  for(let k = 0; k < n; k++) order.push((k + inv) % n);
  const off = [0];
  for(let k = 1; k < n; k++){
    let d = ((rels[order[k]] - rels[order[k-1]]) % 12 + 12) % 12;
    if(d === 0) d = 12;
    off.push(off[k-1] + d);
  }
  // 开放排列：低音不动，上方声部「隔一个和弦音」往上叠（3 度 → 5/6 度），根位时就是教科书式的开放排列
  // 注意：degs 必须跟着一起换序，否则音名和音高会对不上
  const degList = order.map(k => degs[k]);
  let lifted, degOut;
  if(open && n >= 3){
    const seq = [0];
    for(let k = 2; k < n; k += 2) seq.push(k);
    for(let k = 1; k < n; k += 2) seq.push(k);
    /* 低音不动，其余按「隔一个和弦音」往上叠。光加 12 不够：13 和弦有 7 个音时，
       第 9 音 +12 会落到第 13 音底下（0 7 14 21 16 …），所以逐个抬到比前一个高为止。 */
    let prev = -Infinity;
    lifted = seq.map(k => {
      let v = off[k] + (k % 2 === 1 ? 12 : 0);
      while(v <= prev) v += 12;
      prev = v;
      return v;
    });
    degOut = seq.map(k => degList[k]);
  } else {
    lifted = off.slice();
    degOut = degList.slice();
  }
  // 再加上低音相对根音的音程，改成相对根音
  const bass = rels[order[0]];
  const absOff = lifted.map(o => o + bass);
  return {degs: degOut, off: absOff, inv, open, n};
}

const INV_LABEL = ["原位", "第一转位", "第二转位", "第三转位"];
