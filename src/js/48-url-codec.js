/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 分享链接的编解码：把「进行台 8 格 + 借来的和弦」压成能塞进 #hash 的 JSON。
   单独成文件是为了能脱离 DOM 直接测（tests/link.test.mjs）。
   原则：解不出来就丢掉那一格，绝不猜一个近似的和弦顶上——猜错比缺失更难发现。 */

const URL_CODEC_VERSION = 2;
const URL_MAX_TONES = 7;
const URL_MAX_INV = 9;

function urlMod12(n){
  const v = parseInt(n, 10);
  if(!isFinite(v)) return null;
  return ((v % 12) + 12) % 12;
}

function urlBeats(n){
  const v = parseInt(n, 10);
  if(!isFinite(v) || v <= 0) return null;
  return Math.max(1, Math.min(8, v));
}

/* 借来的和弦 / 副属和弦：根音、音高集合、拼写都带着走，否则对方看到的是另一个和弦 */
function urlExToParam(ex){
  if(!ex || !Array.isArray(ex.tones) || !ex.tones.length) return null;
  return {
    r: urlMod12(ex.root),
    t: ex.tones.slice(0, URL_MAX_TONES).map(urlMod12),
    iv: (ex.ivs || []).slice(0, URL_MAX_TONES).map(function(x){ const v = parseInt(x, 10); return isFinite(v) ? v : 0; }),
    nm: (ex.names || []).slice(0, URL_MAX_TONES).map(String),
    k: ex.kind === "secondary" ? 1 : 0,
    rm: String(ex.roman || ""),
    sy: String(ex.symbol || ""),
  };
}

function urlExFromParam(o){
  if(!o || !Array.isArray(o.t) || !o.t.length) return null;
  const tones = o.t.slice(0, URL_MAX_TONES).map(urlMod12).filter(function(x){ return x !== null; });
  const root = urlMod12(o.r);
  if(root === null || !tones.length) return null;
  return {
    root: root,
    tones: tones,
    ivs: Array.isArray(o.iv) ? o.iv.slice(0, URL_MAX_TONES).map(function(x){ const v = parseInt(x, 10); return isFinite(v) ? v : 0; }) : [],
    names: Array.isArray(o.nm) ? o.nm.slice(0, URL_MAX_TONES).map(String) : [],
    kind: o.k === 1 ? "secondary" : "borrow",
    roman: String(o.rm || ""),
    symbol: String(o.sy || ""),
  };
}

/* 进行台：整格整格地搬，ex 槽也按原样保留（旧版只写 s.m，借来的和弦会被还原成级数和弦） */
function urlDeckToParam(slots){
  const out = [];
  for(let i = 0; i < slots.length; i++){
    const s = slots[i];
    if(!s){ out.push(null); continue; }
    if(s.ex){
      out.push({x: urlExToParam(s.ex), b: s.beats || 0, r: s.rest ? 1 : 0});
    } else {
      out.push({
        m: s.m || "",
        d: s.d | 0,
        n: s.n || 0,
        i: s.inv || 0,
        sp: s.spread === "open" ? 1 : 0,
        b: s.beats || 0,
        r: s.rest ? 1 : 0,
      });
    }
  }
  return out;
}

function urlDeckFromParam(arr, isMode){
  if(!Array.isArray(arr)) return null;
  const out = [];
  for(let i = 0; i < arr.length; i++){
    const o = arr[i];
    if(!o){ out.push(null); continue; }
    if(o.x){
      const ex = urlExFromParam(o.x);
      out.push(ex ? {m: null, d: 0, n: ex.tones.length, inv: 0, spread: "close",
        beats: urlBeats(o.b), rest: !!o.r, ex: ex} : null);
      continue;
    }
    const d = parseInt(o.d, 10);
    if(!isFinite(d) || d < 0 || d > 11){ out.push(null); continue; }
    const n = parseInt(o.n, 10);
    out.push({
      m: (typeof isMode === "function" && isMode(o.m)) ? o.m : null,
      d: d,
      n: (isFinite(n) && n >= 2) ? Math.min(URL_MAX_TONES, n) : null,
      inv: isFinite(parseInt(o.i, 10)) ? Math.max(0, Math.min(URL_MAX_INV, parseInt(o.i, 10))) : 0,
      spread: o.sp === 1 ? "open" : "close",
      beats: urlBeats(o.b),
      rest: !!o.r,
      ex: null,
    });
  }
  return out;
}
