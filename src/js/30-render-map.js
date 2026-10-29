/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 调式地图：距离矩阵 → 二维坐标（MDS）→ SVG
   核心想法：位置就是距离。用 SMACOF 做经典多维缩放，让「图上两点相距多远」
   尽量等于「两条调式的距离分」，因此地图本身就是一张距离图。 */

const MAP_VIEW = { w: 920, h: 540 };     // 视口（viewBox 尺寸）
const MAP_WORLD = { w: 1560, h: 940 };   // 世界画布（比视口大，才有地方平移）
const MAP_PAD = 90;

/* 每个来源一种颜色（与音阶库的分组一一对应） */
const MAP_FAM = {
  church:    "#6fc3ff",
  melodic:   "#7ee0a8",
  harmonic:  "#ffb86b",
  harmMajor: "#c9a6ff",
  neap:      "#ff8f7a",
  jazz:      "#e6c35c",
  folk:      "#f08ac0",
  symm:      "#5bd6c8",
};

const MAP_ABBR = {
  ion: "Ion", dor: "Dor", phr: "Phr", lyd: "Lyd", mix: "Mix", aeo: "Aeo", loc: "Loc",
  loc2: "Loc n2", loc6: "Loc n6", uloc: "UltraLoc", sloc: "SuperLoc", lyd5: "Lyd+5", ion5: "Ion+5",
  lyd2: "Lyd+2", dor4: "Dor+4", phr3: "Phr n3", phr4: "Phr b4", lydb3: "Lyd b3", dor5: "Dor b5",
  mixb2: "Mix b2", lyda2: "Lyd+5+2", locb7: "Loc bb7", ionb2: "Ion b2",
  napoM: "Neap M", napoN: "Neap m", byz: "Byz", hma: "Harm M", hm: "Harm m", mm: "Mel m",
  ld: "Lyd Dom", mixb6: "Mix b6", dor2: "Dor b2",
  // 非七声
  wt0: "Whole", wt1: "Whole+1",
  aug1: "Aug A", aug2: "Aug B",
  dimWH: "Dim W-H", dimHW: "Dim H-W",
  penG: "\u5bab", penS: "\u5546", penJ: "\u89d2", penZ: "\u5f73", penY: "\u7fbd",
  in: "Miyako", hira: "Hira", iwato: "Iwato",
  blues: "Blues", mblues: "MajBlues", hung: "Hung", hungM: "Hung M",
  bop7: "Bop7", bopM: "BopM", bopm: "Bopm", bopd: "Bop \u266f4",
  mes3: "M3", mes4: "M4", mes5: "M5", mes6: "M6", mes7: "M7",
  chrom: "Chrom",
};

// 33 × 33 的距离矩阵（score：0 ~ 8 左右）
function mapDistanceMatrix(modes){
  const n = modes.length;
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
    const d = distance(modes[i], modes[j]).score;
    D[i][j] = d;
    D[j][i] = d;
  }
  return D;
}

// SMACOF（Guttman 变换）：最小化 Σ(‖xi−xj‖ − d_ij)²
// 初始位置用黄金角螺旋，无随机数 ⇒ 每次打开都一模一样
function mapMDS(D, o){
  o = o || {};
  const n = D.length;
  const iters = o.iters || 240;
  const px = new Array(n), py = new Array(n);
  for(let i = 0; i < n; i++){
    const r = Math.sqrt((i + 0.5) / n);
    const th = i * 2.39996323;
    px[i] = r * Math.cos(th);
    py[i] = r * Math.sin(th);
  }
  const nx = new Array(n), ny = new Array(n);
  for(let it = 0; it < iters; it++){
    for(let i = 0; i < n; i++){
      let sx = 0, sy = 0;
      for(let j = 0; j < n; j++){
        if(i === j) continue;
        let dx = px[i] - px[j], dy = py[i] - py[j];
        const dl = Math.hypot(dx, dy) || 1e-9;
        const d = D[i][j] || 1e-9;
        sx += px[j] + d * dx / dl;
        sy += py[j] + d * dy / dl;
      }
      nx[i] = sx / (n - 1);
      ny[i] = sy / (n - 1);
    }
    for(let i = 0; i < n; i++){ px[i] = nx[i]; py[i] = ny[i]; }
    if(it % 16 === 0){
      let cx = 0, cy = 0;
      for(let i = 0; i < n; i++){ cx += px[i]; cy += py[i]; }
      cx /= n; cy /= n;
      for(let i = 0; i < n; i++){ px[i] -= cx; py[i] -= cy; }
    }
  }
  return { x: px, y: py };
}

// 拟合优度：0 = 完美还原距离，越大越差
function mapStress(D, xs, ys){
  let num = 0, den = 0;
  const n = D.length;
  for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
    const g = Math.hypot(xs[i] - xs[j], ys[i] - ys[j]);
    const t = D[i][j];
    num += (g - t) * (g - t);
    den += t * t;
  }
  return den > 0 ? Math.sqrt(num / den) : 0;
}

// 皮尔逊相关：距离矩阵 vs 图上距离（越接近 −1 越好：乐理上近 = 图上近）
function mapCorrelation(D, xs, ys){
  const n = D.length;
  const a = [], b = [];
  for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
    a.push(D[i][j]);
    b.push(Math.hypot(xs[i] - xs[j], ys[i] - ys[j]));
  }
  const m = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / m, mb = b.reduce((s, v) => s + v, 0) / m;
  let sab = 0, saa = 0, sbb = 0;
  for(let k = 0; k < m; k++){
    sab += (a[k] - ma) * (b[k] - mb);
    saa += (a[k] - ma) * (a[k] - ma);
    sbb += (b[k] - mb) * (b[k] - mb);
  }
  return sab / Math.sqrt(saa * sbb || 1);
}

// 布局：MDS → 统一等比缩放（不拉扁）→ 居中进世界画布
function layoutMap(modes, o){
  o = o || {};
  const D = o.D || mapDistanceMatrix(modes);
  const { x, y } = mapMDS(D, o);
  const n = modes.length;

  const stressBefore = mapStress(D, x, y);
  const corr = mapCorrelation(D, x, y);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for(let i = 0; i < n; i++){
    minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
    minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]);
  }
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  // 等比缩放：让最长的一边铺满 TARGET 个世界单位（x/y 同一比例，绝不拉扁）
  // TARGET 要比视口大不少，才有余地把任意节点平移到正中
  const TARGET = 1000;
  const k = TARGET / Math.max(spanX, spanY);
  const offX = MAP_PAD, offY = MAP_PAD;
  const W = Math.round(spanX * k + MAP_PAD * 2);
  const H = Math.round(spanY * k + MAP_PAD * 2);

  const nodes = modes.map((m, i) => ({
    id: m.id, cn: m.cn, n: m.n, p: m.src,
    x: offX + (x[i] - minX) * k,
    y: offY + (y[i] - minY) * k,
  }));

  // 60 个节点里有几对几乎重合（两个调式只差一个音，距离分接近 0）。
  // 按最小间距轻轻推开，只动几乎贴住的那几对，不破坏「位置就是距离」。
  const MIND = 30;
  for(let it = 0; it < 60; it++){
    let moved = false;
    for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
      let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      let d = Math.hypot(dx, dy);
      if(d >= MIND) continue;
      if(d < 1e-6){ dx = (i % 2 ? 1 : -1) * 0.7; dy = 0.7; d = 1; }
      const push = (MIND - d) * 0.25, ux = dx / d, uy = dy / d;
      nodes[i].x -= ux * push; nodes[i].y -= uy * push;
      nodes[j].x += ux * push; nodes[j].y += uy * push;
      moved = true;
    }
    if(!moved) break;
  }
  for(const nd of nodes){
    nd.x = Math.max(MAP_PAD * 0.5, Math.min(W - MAP_PAD * 0.5, nd.x));
    nd.y = Math.max(MAP_PAD * 0.5, Math.min(H - MAP_PAD * 0.5, nd.y));
  }

  return {
    nodes, D, W, H,
    unit: k,                 // 1 个距离分 = k 个世界单位
    stress: stressBefore,    // 用 score 单位算，与缩放无关
    corr,
  };
}

/* ---------- 画：纯函数，输入布局 + 选中项，输出 SVG 字符串 ---------- */

function mapSVG(L, o){
  o = o || {};
  const sel = o.sel || null;
  const showVectors = o.vectors !== false && sel !== null;
  const edgesMax = o.edgesMax === undefined ? 4 : o.edgesMax;
  const k = o.k || 1;                       // = 1/zoom：几何随缩放走，标记与字保持原大
  const byId = {};
  L.nodes.forEach((n, i) => { byId[n.id] = { n, i }; });

  let edges = "";
  for(let i = 0; i < L.nodes.length; i++){
    for(let j = i + 1; j < L.nodes.length; j++){
      const d = L.D[i][j];
      if(d > edgesMax) continue;
      const A = L.nodes[i], B = L.nodes[j];
      const near = d <= 2;
      edges += `<line class="edge${near ? " d0" : ""}" vector-effect="non-scaling-stroke" x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}"/>`;
    }
  }

  let vectors = "", rings = "";
  if(showVectors && byId[sel]){
    const si = byId[sel].i, S = L.nodes[si];
    const accent = MAP_FAM[S.p] || "#fff";
    // 距离环：半径 = 2 / 4 / 6 个距离分
    [2, 4, 6].forEach(rr => {
      const r = (rr * L.unit).toFixed(1);
      if(+r > 900) return;
      rings += `<circle class="ring" vector-effect="non-scaling-stroke" cx="${S.x.toFixed(1)}" cy="${S.y.toFixed(1)}" r="${r}"/>`
             + `<text class="ringlab" font-size="${(11 * k).toFixed(2)}" x="${(+S.x + +r + 4).toFixed(1)}" y="${S.y.toFixed(1)}">${rr}</text>`;
    });
    for(let j = 0; j < L.nodes.length; j++){
      if(j === si) continue;
      const d = L.D[si][j];
      if(d > edgesMax) continue;
      const A = L.nodes[si], B = L.nodes[j];
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const x1 = A.x + ux * 10, y1 = A.y + uy * 10;
      const x2 = B.x - ux * 10, y2 = B.y - uy * 10;
      const op = Math.max(0.25, 1 - d / (edgesMax + 0.6)).toFixed(2);
      const col = MAP_FAM[B.p] || "#888";
      vectors += `<line class="vec" vector-effect="non-scaling-stroke" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-opacity="${op}"/>`;
      // 箭头
      const ah = 6 * k;
      vectors += `<polygon class="ahead" points="${(x2).toFixed(1)},${(y2).toFixed(1)} `
        + `${(x2 - ux * ah - uy * ah * 0.55).toFixed(1)},${(y2 - uy * ah + ux * ah * 0.55).toFixed(1)} `
        + `${(x2 - ux * ah + uy * ah * 0.55).toFixed(1)},${(y2 - uy * ah - ux * ah * 0.55).toFixed(1)}" `
        + `fill="${col}" fill-opacity="${op}"/>`;
      if(d <= 3){
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        vectors += `<text class="veclab" font-size="${(11 * k).toFixed(2)}" x="${mx.toFixed(1)}" y="${(my - 3).toFixed(1)}">${d.toFixed(d % 1 ? 1 : 0)}</text>`;
      }
    }
    vectors = `<circle class="selhalo" vector-effect="non-scaling-stroke" cx="${S.x.toFixed(1)}" cy="${S.y.toFixed(1)}" r="${(22 * k).toFixed(1)}" fill="none" stroke="${accent}"/>`
      + rings + vectors;
  }

  let nd = "";
  /* 标签避让：60 个节点挤在一起时，先摆「周围最热闹」的那些，
     每个标签在 12 个候选位里挑一个不压别的标签、也不压任何节点圆的位置；
     实在没干净位就挑压得最少的那一个。选中项的标签先摆，拿最好的位置。 */
  const boxes = [];
  const kk = k;                                   // 标签在组内按 k 缩放，碰撞盒要用世界单位
  const nodeR = 6 * kk;                           // 节点圆的半径（世界单位）
  const boxOf = (cx, cy, w, h) => ({ x: cx, y: cy, w, h });
  const overlapArea = (a, b) => {
    const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
    const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
    return (ox > 0 && oy > 0) ? ox * oy : 0;
  };
  // 所有节点圆先当作障碍
  L.nodes.forEach(n => boxes.push(boxOf(n.x, n.y, nodeR * 2, nodeR * 2)));
  // 拥挤度：附近节点越多，越要先摆
  const crowd = L.nodes.map(n => L.nodes.filter(m => m !== n && Math.hypot(m.x - n.x, m.y - n.y) < 70 * kk).length);
  const order = L.nodes.map((n, i) => ({ n, i }))
    .sort((a, b) => (sel === b.n.id) - (sel === a.n.id) || crowd[b.i] - crowd[a.i])
    .map(o => o.n);

  for(const n of order){
    const col = MAP_FAM[n.p] || "#888";
    const cls = ["node"];
    if(sel === n.id) cls.push("sel");
    const label = MAP_ABBR[n.id] || n.n;
    const tw = label.length * 5.4 + 6;            // 组内坐标（未乘 k）
    const th = 12;
    const w = tw * kk, h = th * kk;
    // 候选位：[组内 x 偏移, 基线 y]，由近到远铺三圈 —— 正下/正上最优先，其次左右，再往外推
    const tw2 = tw / 2;
    const cands = [
      [0, 19], [0, -13], [0, 31], [0, -25],
      [tw2 + 10, 4], [-(tw2 + 10), 4],
      [tw2 + 8, 19], [-(tw2 + 8), 19],
      [tw2 + 8, -13], [-(tw2 + 8), -13],
      [0, 43], [0, -37],
    ];
    for(const d of [1, 2, 3]){
      const dy = 19 + d * 13, dx = tw2 + 10 + d * 12;
      cands.push([0, dy], [0, -dy + 6]);
      cands.push([dx, 4], [-dx, 4]);
      cands.push([dx, 19 + d * 9], [-dx, 19 + d * 9]);
      cands.push([dx, -13 - d * 9], [-dx, -13 - d * 9]);
    }
    let best = null, bestScore = Infinity, bestBox = null;
    for(const [lx, ly] of cands){
      const cx = n.x + lx * kk, cy = n.y + ly * kk - h / 2;
      const box = boxOf(cx, cy, w, h);
      let ov = 0;
      for(const b of boxes) ov += overlapArea(box, b);
      const score = ov + (Math.abs(lx) + Math.abs(ly)) * 0.35 * kk * kk;   // 同等条件下越近越好
      if(score < bestScore){ bestScore = score; best = [lx, ly]; bestBox = box; }
      // 候选位由近到远排，第一个完全干净的位直接定案（距离惩罚不能把干净位挤掉）
      if(ov === 0){ best = [lx, ly]; bestBox = box; break; }
    }
    boxes.push(bestBox);
    nd += `<g class="${cls.join(" ")}" data-id="${n.id}" transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)}) scale(${k.toFixed(3)})">`
      + `<circle class="hit" r="15" cy="2" fill="transparent"/>`
      + `<circle r="6" stroke="${col}"/><text x="${best[0].toFixed(1)}" y="${best[1].toFixed(1)}">${label}</text>`
      + `<title>${n.cn} · ${n.n}</title></g>`;
  }

  return `<g class="map-edges">${edges}</g><g class="map-vectors">${vectors}</g><g class="map-nodes">${nd}</g>`;
}

/* ---------- 6. 挂载、镜头、拖拽缩放 ---------- */
const MAP_ZOOM_MIN = 0.65, MAP_ZOOM_MAX = 3.4;
const mapState = {pos:null, cx:0, cy:0, zoom:1, anim:null, drag:null, moved:false, bound:false};

function mapViewBox(){
  const w = MAP_VIEW.w / mapState.zoom, h = MAP_VIEW.h / mapState.zoom;
  return { x: mapState.cx - w / 2, y: mapState.cy - h / 2, w, h };
}
function mapApply(){
  const v = mapViewBox();
  $("#map").setAttribute("viewBox", `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`);
  // 已经画好的节点带的是旧 k，缩放时整块重画一次（布局结果缓存，不会重排）
  if(mapState.pos) paintMap();
}
function mapClamp(){
  const L = mapState.pos || {W: MAP_VIEW.w, H: MAP_VIEW.h};
  const v = mapViewBox();
  const halfW = v.w / 2, halfH = v.h / 2;
  mapState.cx = Math.min(L.W - halfW, Math.max(halfW, mapState.cx));
  mapState.cy = Math.min(L.H - halfH, Math.max(halfH, mapState.cy));
}
function mapSetZoom(z, clientX, clientY){
  const svg = $("#map"), r = svg.getBoundingClientRect();
  if(!r.width || !r.height) return;
  const v = mapViewBox();
  const fx = clientX === undefined ? 0.5 : (clientX - r.left) / r.width;
  const fy = clientY === undefined ? 0.5 : (clientY - r.top) / r.height;
  const wx = v.x + fx * v.w, wy = v.y + fy * v.h;      // 指针下的世界点
  const nz = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, z));
  if(Math.abs(nz - mapState.zoom) < 1e-4) return;
  const w2 = MAP_VIEW.w / nz, h2 = MAP_VIEW.h / nz;
  mapState.zoom = nz;
  mapState.cx = wx + (0.5 - fx) * w2;                  // 让那个世界点停在指针下
  mapState.cy = wy + (0.5 - fy) * h2;
  mapClamp();
  mapApply();
}

function renderMap(){
  mapState.pos = layoutMap(MODES);
  const cur = mapState.pos.nodes.find(n => n.id === state.A) || mapState.pos.nodes[0];
  mapState.cx = cur.x; mapState.cy = cur.y; mapState.zoom = 1;
  mapClamp();
  paintMap();
  mapApply();
  const fams = ORIGIN_ORDER.filter(f => mapState.pos.nodes.some(n => n.p === f));
  $("#mapLegend").innerHTML = fams.map(k => {
    const o = ORIGIN_OF[k];
    return `<span title="${o ? o.note : ""}"><i style="background:${MAP_FAM[k] || "#888"}"></i>${o ? o.cn : k}</span>`;
  }).join("");
  bindMapGestures();
}

function paintMap(){
  if(!mapState.pos) return;
  const k = 1 / mapState.zoom;
  $("#map").innerHTML = mapSVG(mapState.pos, {sel: state.A, k});
  $("#map").querySelectorAll(".node").forEach(el => {
    el.addEventListener("click", e => {
      if(mapState.moved){ mapState.moved = false; return; }   // 拖拽结束的那一下不算点击
      switchMode(el.dataset.id);
    });
  });
}

function bindMapGestures(){
  if(mapState.bound) return;
  mapState.bound = true;
  const svg = $("#map");

  // 注意：这里**不能**用 setPointerCapture —— 它会把随后的 click 重定向到 <svg>，
  // 节点上的 click 就收不到了（表现为「点节点没反应」）。改用 window 上挂移动/抬起。
  const onMove = e => {
    const d = mapState.drag;
    if(!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if(!d.moved && Math.hypot(dx, dy) < 7) return;            // 7px 以内都当点击（手抖不算拖）
    d.moved = true;
    const v = mapViewBox();
    mapState.cx = d.cx - dx * (v.w / d.w);
    mapState.cy = d.cy - dy * (v.h / d.h);
    mapClamp();
    const now = mapViewBox();
    svg.setAttribute("viewBox", `${now.x.toFixed(2)} ${now.y.toFixed(2)} ${now.w.toFixed(2)} ${now.h.toFixed(2)}`);
  };

  const endDrag = () => {
    const d = mapState.drag;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    if(!d) return;
    mapState.moved = d.moved;
    mapState.drag = null;
    svg.classList.remove("dragging");
    if(d.moved) setTimeout(() => { mapState.moved = false; }, 0);   // 让紧随其后的 click 先读到 moved
  };

  svg.addEventListener("pointerdown", e => {
    if(e.button !== 0) return;
    cancelAnimationFrame(mapState.anim);
    const r = svg.getBoundingClientRect();
    mapState.drag = { x: e.clientX, y: e.clientY, cx: mapState.cx, cy: mapState.cy, w: r.width, h: r.height, moved: false };
    mapState.moved = false;
    svg.classList.add("dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  });

  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0016);
    mapSetZoom(mapState.zoom * f, e.clientX, e.clientY);
  }, { passive: false });

  svg.addEventListener("dblclick", e => {
    e.preventDefault();
    mapState.zoom = 1;
    paintMap();
    centerMapOn(state.A, 260);
  });
}

function centerMapOn(id, dur){
  const L = mapState.pos;
  if(!L) return;
  const node = L.nodes.find(n => n.id === id);
  if(!node) return;
  cancelAnimationFrame(mapState.anim);
  const fx = mapState.cx, fy = mapState.cy;
  const tx = node.x, ty = node.y;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce || Math.abs(fx - tx) < 0.5 && Math.abs(fy - ty) < 0.5){
    mapState.cx = tx; mapState.cy = ty; mapClamp(); mapApply(); return;
  }
  const t0 = performance.now(), d = dur || 380;
  const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const step = now => {
    const k = Math.min(1, (now - t0) / d), e2 = ease(k);
    mapState.cx = fx + (tx - fx) * e2;
    mapState.cy = fy + (ty - fy) * e2;
    const v = mapViewBox();
    $("#map").setAttribute("viewBox", `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`);
    if(k < 1) mapState.anim = requestAnimationFrame(step);
    else { mapClamp(); paintMap(); }        // 动画结束补一次重画，刷新标记的 k
  };
  mapState.anim = requestAnimationFrame(step);
}

// 切换调式时只改高亮与向量，不重排（位置不变，距离才有可比性）
function syncMap(){
  paintMap();
}

uiRegister("map", syncMap);
