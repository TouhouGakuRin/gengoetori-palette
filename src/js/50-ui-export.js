/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4j. 导出与分享：谱面 SVG / PNG、URL 状态 ----------
 *
 * 谱面在页面里是一段 <g> 标记 + 外链样式（.svstaff .nh 那些），
 * 直接 XMLSerializer 出来的文件到别处会丢样式、且 currentColor 无从解析。
 * 所以导出时重新拼一个自包含的 <svg>：内联一份去掉 .svstaff 前缀的样式、
 * 显式给 color 与背景色，再套上外框留白。
 * Bravura 字体以 base64 内嵌进 <style>（fonts/Bravura.otf 取得到时）——
 * SVG-as-<img> 与别处打开的 .svg 加载不了外部字体，不内嵌的话没装系统
 * Bravura 的机器上音符头全是豆腐块。
 *
 * PNG 走「blob URL → <img> → canvas」：比 toDataURL 稳。
 */

const EXPORT_TARGETS = { staff: "#staff", chord: "#chordStaff", deck: "#deckStaff" };
const EXPORT_PAD = 12;

// 与 shell.html 里 .svstaff 那套规则同源，去掉前缀并把 currentColor 落到具体颜色；
// .brk（直连谱号两端短横）与 .warn（违规红点）以前漏了，导出后会丢样式。
// @WARN@ 按主题替换（深色 #ff8f7a / 浅色 #c0392b，同 var(--bad)）。
const EXPORT_CSS = [
  "svg{color:@FG@}",
  'text{font-family:Bravura,"Bravura Text",serif}',
  ".sl{stroke:currentColor;stroke-width:1.3;opacity:.55;stroke-linecap:butt}",
  ".bl{stroke:currentColor;stroke-width:1.6;opacity:.8;stroke-linecap:butt}",
  ".bl2{stroke:currentColor;stroke-width:3.4;opacity:.9;stroke-linecap:butt}",
  ".led{stroke:currentColor;stroke-width:1.6;opacity:.6;stroke-linecap:butt}",
  ".st{stroke:currentColor;stroke-width:1.2;opacity:.85;stroke-linecap:butt}",
  ".nh,.clef,.ksig,.acc,.ts,.rst,.dot{fill:currentColor;font-size:40px}",
  ".tie{fill:currentColor;opacity:.85}",
  ".brc{fill:currentColor;opacity:.95;font-size:40px}",
  ".brk{fill:none;stroke:currentColor;stroke-width:1.3;opacity:.9;stroke-linecap:round}",
  ".warn{fill:@WARN@;stroke:none}",
  '.lab,.cnm{font-family:ui-sans-serif,system-ui,"Microsoft YaHei",sans-serif;text-anchor:middle;fill:currentColor;opacity:.72;font-size:11px}',
].join("");

function exportPalette(){
  const light = (document.documentElement.dataset.theme || "dark") === "light";
  return light
    ? { fg:"#14181f", bg:"#ffffff", warn:"#c0392b" }
    : { fg:"#e9edf6", bg:"#14181e", warn:"#ff8f7a" };
}

/* Bravura 以 base64 内嵌进导出文件：SVG-as-<img> 和别处打开的 .svg 都加载不了
   外部字体，没装系统 Bravura 的机器上音符头会缺字形。取不到字体（file:// 的
   fetch 限制等）就返回空串，退回「依赖本机字体」的现状。结果缓存，只取一次。 */
let EXPORT_FONT_CSS = null;      // 成功后缓存 @font-face 字符串（失败为 ""）
let EXPORT_FONT_TRY = null;      // 进行中的 Promise

function exportFontCSS(){
  if(EXPORT_FONT_CSS !== null) return Promise.resolve(EXPORT_FONT_CSS);
  if(!EXPORT_FONT_TRY){
    EXPORT_FONT_TRY = (async () => {
      try{
        const res = await fetch("fonts/Bravura.otf");
        if(!res.ok) throw new Error("HTTP " + res.status);
        const buf = new Uint8Array(await res.arrayBuffer());
        let bin = "";
        for(let i = 0; i < buf.length; i += 0x8000)
          bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        EXPORT_FONT_CSS = '@font-face{font-family:Bravura;src:url(data:font/otf;base64,'
          + btoa(bin) + ') format("opentype")}';
      }catch(e){
        EXPORT_FONT_CSS = "";
      }
      return EXPORT_FONT_CSS;
    })();
  }
  return EXPORT_FONT_TRY;
}
exportFontCSS();   // 启动预热：等用户点导出时多半已经就绪

/* 页面里的谱面 <svg> → 自包含的 SVG 字符串（含内嵌字体；异步等字体取完） */
async function staffSnapshot(svg, pal){
  if(!svg) return null;
  pal = pal || exportPalette();
  const fontCSS = await exportFontCSS();
  const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  const w = vb[2] || parseFloat(svg.getAttribute("width")) || 320;
  const h = vb[3] || parseFloat(svg.getAttribute("height")) || 120;
  const W = w + EXPORT_PAD * 2, H = h + EXPORT_PAD * 2;
  const css = (fontCSS ? fontCSS : "")
    + EXPORT_CSS.replace(/@FG@/g, pal.fg).replace(/@WARN@/g, pal.warn);
  const m = typeof activeMode === "function" ? activeMode() : null;
  const t = typeof tonicObj === "function" ? tonicObj() : null;
  const what = (m ? m.cn : "谱面") + (t ? " · " + noteName(t.li, t.acc) : "");
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"'
    + ' viewBox="0 0 ' + W + ' ' + H + '" style="color:' + pal.fg + '">'
    + "<title>" + what + " — 幻歌鸟调色盘</title>"
    + "<desc>幻歌鸟调色盘 Gengoetori Palette · © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License</desc>"
    + "<style>" + css + "</style>"
    + '<rect width="' + W + '" height="' + H + '" fill="' + pal.bg + '"/>'
    + '<g transform="translate(' + EXPORT_PAD + "," + EXPORT_PAD + ')">'
    + svg.innerHTML
    + "</g></svg>";
}

/* 文件名：幻歌鸟调色盘-多利亚-C-音阶-20261026 */
function exportName(tag, kind){
  const m = typeof activeMode === "function" ? activeMode() : null;
  const t = typeof tonicObj === "function" ? tonicObj() : null;
  const who = (m ? m.cn : "谱面") + (t ? "-" + noteName(t.li, t.acc) : "");
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  return `幻歌鸟调色盘-${who}-${tag}-${stamp}.${kind}`;
}

function saveBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function svgToPngBlob(svgText, pxW, pxH, scale, done){
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type:"image/svg+xml;charset=utf-8" }));
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = Math.round(pxW * scale);
    c.height = Math.round(pxH * scale);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob(b => { done(b); }, "image/png");
  };
  img.onerror = () => { URL.revokeObjectURL(url); done(null); };
  img.src = url;
}

function toast(msg){
  let el = document.getElementById("toast");
  if(!el){
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("on"), 2200);
}

async function exportStaff(which, kind){
  const sel = EXPORT_TARGETS[which];
  const svg = sel ? document.querySelector(sel) : null;
  if(!svg || !svg.innerHTML.trim()){ toast("这张谱面还没有内容"); return; }
  const text = await staffSnapshot(svg);
  if(!text){ toast("导出失败"); return; }
  if(kind === "svg"){
    saveBlob(new Blob([text], { type:"image/svg+xml;charset=utf-8" }), exportName("谱面", "svg"));
    toast("已导出 SVG（矢量，可再编辑）");
    return;
  }
  const m = text.match(/width="([\d.]+)" height="([\d.]+)"/);
  const pxW = m ? +m[1] : 600, pxH = m ? +m[2] : 300;
  const scale = Math.min(3, Math.max(1.5, 1400 / pxW));   // 窄的谱面放大到够清楚
  svgToPngBlob(text, pxW, pxH, scale, blob => {
    if(!blob){ toast("PNG 导出失败，换 SVG 试试"); return; }
    saveBlob(blob, exportName("谱面", "png"));
    toast("已导出 PNG（" + Math.round(pxW * scale) + "×" + Math.round(pxH * scale) + "）");
  });
}

/* ---------- URL 状态：一个链接复现现场 ---------- */

const HASH_KEYS = ["m", "t", "v", "o", "x", "d2", "mt"];

function hashOfState(){
  const parts = ["m=" + state.A, "t=" + state.tone, "v=" + state.voicing,
    "o=" + (state.oct || 0), "sv=" + URL_CODEC_VERSION];
  // 借来的和弦要连根音和拼写一起带上，否则对方看到的是另一个和弦
  if(state.chordEx){
    const ex = urlExToParam(state.chordEx);
    if(ex) parts.push("x=" + encodeURIComponent(JSON.stringify(ex)));
  }
  if(typeof deck !== "undefined" && deck.slots.some(Boolean)){
    // d2 是完整 JSON（含 ex 槽）；老的 d= 只写 s.m，借来的和弦会被还原成级数和弦
    parts.push("d2=" + encodeURIComponent(JSON.stringify(urlDeckToParam(deck.slots))));
    parts.push("mt=" + encodeURIComponent(deck.meter || "4/4"));
  }
  return parts.join("&");
}

let hashLast = "";

function syncHash(){
  if(!window.history || !history.replaceState) return;
  const q = hashOfState();
  if(q === hashLast) return;
  hashLast = q;
  try{ history.replaceState(null, "", "#" + q); }catch(_){}
}

function applyHash(){
  const raw = (location.hash || "").replace(/^#/, "");
  if(!raw) return false;
  const map = {};
  raw.split("&").forEach(kv => {
    const i = kv.indexOf("=");
    if(i > 0) map[kv.slice(0, i)] = kv.slice(i + 1);
  });
  let hit = false;
  if(map.m && byId(map.m)){ state.A = map.m; hit = true; }
  const tn = parseInt(map.t, 10);
  if(isFinite(tn) && TONICS[tn]){ state.tone = tn; hit = true; }
  if(map.v === "3" || map.v === "7"){ state.voicing = map.v; hit = true; }
  const oc = parseInt(map.o, 10);
  if(isFinite(oc)){ state.oct = Math.max(-2, Math.min(2, oc)); hit = true; }

  if(map.d2 || map.d){
    if(typeof deck !== "undefined"){
      let slots = null;
      if(map.d2){
        try{ slots = urlDeckFromParam(JSON.parse(decodeURIComponent(map.d2)), byId); }catch(_){}
      }
      if(!slots && map.d) slots = legacyDeckSlots(map.d);   // 老链接照旧能开
      if(slots){
        deck.slots = new Array(DECK_N).fill(null);
        slots.slice(0, DECK_N).forEach((s, i) => { deck.slots[i] = s || null; });
        if(map.mt){
          const mt = decodeURIComponent(map.mt);
          if(METERS.some(x => x.id === mt)) deck.meter = mt;
        }
        if(deck.slots.some(Boolean)) hit = true;
        if(typeof saveDeck === "function") saveDeck();
      }
    }
  }
  if(map.x){
    try{
      const ex = urlExFromParam(JSON.parse(decodeURIComponent(map.x)));
      if(ex){ state.chordEx = ex; hit = true; }
    }catch(_){}
  }
  hashLast = raw;
  return hit;
}

/* v1 的 d= 格式：m.d.n.inv.spread.beats.rest，用 ~ 分格。留着只为老链接还能打开。 */
function legacyDeckSlots(str){
  const out = new Array(DECK_N).fill(null);
  str.split("~").slice(0, DECK_N).forEach((s, i) => {
    if(!s) return;
    const f = s.split(".");
    const d = parseInt(f[1], 10);
    if(!isFinite(d)){
      if(f[0] === "-" && f[5] === "1") return;   // 空槽
      return;
    }
    out[i] = {
      m: (f[0] && f[0] !== "-" && byId(f[0])) ? f[0] : null,
      d: Math.max(0, Math.min(11, d)),
      n: f[2] ? Math.max(2, Math.min(CHORD_MAX, parseInt(f[2], 10))) : null,
      inv: f[3] ? Math.max(0, Math.min(9, parseInt(f[3], 10))) : 0,
      spread: f[4] === "o" ? "open" : "close",
      beats: f[5] ? Math.max(1, Math.min(8, parseInt(f[5], 10))) : null,
      rest: f[6] === "1",
      ex: null,
    };
  });
  return out;
}

/* 事件：导出按钮（详情谱面 / 和弦谱面 / 进行台谱面） */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-exp]");
  if(!b) return;
  e.preventDefault();
  exportStaff(b.dataset.exp, b.dataset.kind === "png" ? "png" : "svg");
});

window.addEventListener("hashchange", () => {
  if(applyHash()) renderAll();
});
