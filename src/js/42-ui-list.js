/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4b. 左栏：音阶库（60 条，按来源 / 色彩 / 亮度排） ---------- */

const LIST_SORTS = {
  // 亮度序：相对同主音大调的变化音数
  rank: (a, b) => (a.rankN || 999) - (b.rankN || 999) || a.cn.localeCompare(b.cn),
  // 离当前调式的距离
  dist: (a, b) => distance(byId(state.A), a).score - distance(byId(state.A), b).score,
  // 大调色彩 → 属色彩 → 小调色彩 → 其他，组内仍按亮度
  color: (a, b) => {
    const w = {M:0, D:1, m:2, A:3, X:4, x:5};
    return (w[a.colorKey] ?? 6) - (w[b.colorKey] ?? 6) || (a.rankN || 999) - (b.rankN || 999);
  },
  // 按风格分组（古典 / 爵士 / 中国 / 中东……），组内按亮度
  style: (a, b) => {
    const i = STYLE_ORDER.indexOf(a.style), j = STYLE_ORDER.indexOf(b.style);
    return (i < 0 ? 99 : i) - (j < 0 ? 99 : j)
      || (a.rankN || 999) - (b.rankN || 999);
  },
  // 按来源分组，组内按旋法号（没有旋法的排后面，按音数）
  parent: (a, b) => (a.originOrder || 99) - (b.originOrder || 99)
    || (a.rot ?? 99) - (b.rot ?? 99)
    || a.pcs.length - b.pcs.length
    || a.cn.localeCompare(b.cn),
};

// 风格分组的先后：越「古典/民间」越靠前，越「实验」越靠后
const STYLE_ORDER = ["古典", "哥特古典", "凯尔特", "民谣", "蓝调", "异域", "悬", "哥特",
  "爵士", "布鲁斯", "吉普赛", "中国", "日本", "中东", "电影配乐", "二十世纪"];

// 搜索：中文名、英文名、来源、风格、色彩感受、性质标签、出处说明都能命中
function listFilter(q){
  const s = (q || "").trim().toLowerCase();
  if(!s) return MODES.slice();
  return MODES.filter(m => {
    const hay = [m.cn, m.n, m.origin.cn, m.origin.en, m.style, m.mood, m.colorCn, m.about]
      .concat(m.tags || []).join(" ").toLowerCase();
    return hay.includes(s);
  });
}

function listRows(q, sort){
  const rows = listFilter(q);
  rows.sort(LIST_SORTS[sort] || LIST_SORTS.rank);
  return rows;
}

const COLOR_LABEL = {M:"大调", D:"属", m:"小调", A:"增三", X:"混三", x:"无三度"};

function renderList(env){
  const { $, state } = env;
  const q = ($("#search").value || "");
  const sort = $("#sortSel").value;
  const rows = listRows(q, sort);

  let html = "", lastK = null;
  for(const m of rows){
    if(sort === "parent" && m.src !== lastK){
      html += `<div class="grp">${m.origin.cn}<span class="grpnote">${m.origin.en}</span></div>`;
      lastK = m.src;
    }
    if(sort === "style" && m.style !== lastK){
      const n = rows.filter(x => x.style === m.style).length;
      html += `<div class="grp">${m.style || "其他"}<span class="grpnote">${n} 条</span></div>`;
      lastK = m.style;
    }
    if(sort === "color" && m.colorKey !== lastK){
      const lb = {M:"大调色彩（大三度）", D:"属色彩（大三度 + 降七级）", m:"小调色彩（小三度）",
                  A:"增三色彩（大三度、没有纯五度）", X:"大小三度并存", x:"没有三度（五声/对称）"}[m.colorKey];
      html += `<div class="grp">${lb}</div>`;
      lastK = m.colorKey;
    }
    const isA = m.id === state.A, isB = m.id === state.B;
    const sub = [m.origin.short, COLOR_LABEL[m.colorKey] || m.colorCn, m.mood].filter(Boolean).join(" · ");
    html += `<div class="row${isA?" a":""}${isB?" b":""}" data-id="${m.id}" title="${m.about}">
      <span class="rk" title="亮度序：相对同主音大调多了几个升号">${m.rankN || ""}</span>
      <span class="nm"><span class="nm1"><b>${m.cn}</b><i>${m.n}</i></span><span class="sub">${sub}</span></span>
      <span class="tag${sort === "style" ? " off" : ""}" title="风格">${m.style || ""}</span>
      <button class="pick${isA?" on":""}" data-a="${m.id}">A</button>
      <button class="pick${isB?" onB":""}" data-b="${m.id}">B</button>
    </div>`;
  }

  const box = $("#list");
  box.innerHTML = html || `<div class="grp">没有匹配</div>`;
  box.querySelectorAll(".row").forEach(el => {
    el.onclick = e => {
      if(e.target.dataset.a !== undefined || e.target.dataset.b !== undefined) return;
      switchMode(el.dataset.id);
      closeLibOnNarrow();
    };
  });
  box.querySelectorAll("[data-a]").forEach(el =>
    el.onclick = e => { e.stopPropagation(); switchMode(el.dataset.a); closeLibOnNarrow(); });
  box.querySelectorAll("[data-b]").forEach(el =>
    el.onclick = e => { e.stopPropagation(); state.B = el.dataset.b; renderAll(); });
}

uiRegister("list", renderList);

/* ---------- 窄窗抽屉：音阶库在 980px 以下收起，不再把正文挤到屏幕外 ---------- */
function libSetOpen(on){
  const lib = document.getElementById("libPanel");
  if(!lib) return;
  const scrim = document.getElementById("libScrim");
  const btn = document.getElementById("btnLib");
  lib.classList.toggle("open", !!on);
  if(scrim) scrim.classList.toggle("on", !!on);
  if(btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
  if(on){
    const cur = lib.querySelector(".row.a");
    if(cur) setTimeout(() => { try{ cur.scrollIntoView({ block: "nearest" }); }catch(_){} }, 80);
  }
}
function libIsOpen(){
  const lib = document.getElementById("libPanel");
  return !!(lib && lib.classList.contains("open"));
}
function closeLibOnNarrow(){
  if(window.matchMedia && matchMedia("(max-width:980px)").matches && libIsOpen()) libSetOpen(false);
}
(function bindLibToggle(){
  const btn = document.getElementById("btnLib");
  const scrim = document.getElementById("libScrim");
  if(btn) btn.onclick = () => libSetOpen(!libIsOpen());
  if(scrim) scrim.onclick = () => libSetOpen(false);
})();

/* 列表键盘：上下键直接换音阶，不必用 Tab 走过一百多个可聚焦项 */
(function bindListKeys(){
  const box = document.getElementById("list");
  if(!box) return;
  box.tabIndex = 0;
  box.setAttribute("aria-label", "音阶列表：上下方向键切换音阶");
  box.addEventListener("keydown", e => {
    if(e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const rows = [...box.querySelectorAll(".row")];
    if(!rows.length) return;
    e.preventDefault();
    let i = rows.findIndex(r => r.dataset.id === state.A);
    if(i < 0) i = 0;
    else if(e.key === "ArrowDown") i = Math.min(rows.length - 1, i + 1);
    else if(e.key === "ArrowUp") i = Math.max(0, i - 1);
    else if(e.key === "Home") i = 0;
    else if(e.key === "End") i = rows.length - 1;
    const id = rows[i].dataset.id;
    switchMode(id);
    const el = box.querySelector('.row[data-id="' + id + '"]');
    if(el) el.scrollIntoView({ block: "nearest" });
  });
})();
