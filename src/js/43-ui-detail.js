/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4c. 主区：标题徽标 / 半音条 / 和弦卡 / 最近邻 ---------- */

// 换了调式、主音或和弦音数，「借来的和弦」里选中的那个就作废
let outsideStamp = "";

function renderDetail(env){
  const { $, state, byId, tonicObj } = env;
  const m = activeMode(), t = tonicObj(), sp = spell(m, t);
  const br = brightness(m);

  const stamp = m.id + "|" + t.pc + "|" + (state.voicing || "7");
  if(stamp !== outsideStamp){ state.chordEx = null; outsideStamp = stamp; }

  $("#mTitle").innerHTML = `${m.cn}<small>${m.n} · 主音 ${noteName(t.li, t.acc)}</small>`;

  // 中国五声：旋宫 + 偏音（只在这个调式出现）
  const po = $("#pentaOpts");
  if(po){
    const isPen = m.pentRot !== undefined;
    po.classList.toggle("hidden", !isPen);
    if(!isPen) po.innerHTML = "";          // 非五声：连 DOM 都不留，免得被 Tab 走到
    if(isPen){
      const b4 = state.b4 || 0, b7 = state.b7 || 0;
      po.innerHTML = `<div class="pgrp"><span class="plab">旋宫</span>`
        + PENTA_NAMES.map((nm, i) => `<button data-pen="${PENTA_IDS[i]}" class="${PENTA_IDS[i] === state.A ? "on" : ""}">${nm}调式</button>`).join("")
        + `</div><div class="pgrp"><span class="plab">偏音 · 清角一侧</span>`
        + [[0, "无"], [5, "清角"], [6, "变徵"]].map(([v, nm]) => `<button data-b4="${v}" class="${v === b4 ? "on" : ""}">${nm}</button>`).join("")
        + `</div><div class="pgrp"><span class="plab">偏音 · 变宫一侧</span>`
        + [[0, "无"], [10, "闰"], [11, "变宫"]].map(([v, nm]) => `<button data-b7="${v}" class="${v === b7 ? "on" : ""}">${nm}</button>`).join("")
        + (m.pcs.length === 5
            ? `</div><div class="pgrp"><span class="plab">和弦构成</span>`
              + [["tertian", "三度叠置"], ["quintal", "五度叠置"]].map(([v, nm]) =>
                  `<button data-model="${v}" class="${v === (state.pentaChord || "tertian") ? "on" : ""}">${nm}</button>`).join("")
              + `</div>`
            : `</div>`);
    }
  }

  const ct = $("#cardsTitle");
  if(ct) ct.textContent = cardsTitleText(state.voicing || "7");
  if(typeof syncVoicingLabel === "function") syncVoicingLabel();
  const n = m.pcs.length, num = n === 7 ? "七个" : n + " 个";
  const bt = $("#btnStaffChords"); if(bt) bt.textContent = `${num}和弦`;
  const bp = $("#btnProg");       if(bp) bp.textContent = `▶ 播放${num}和弦`;

  const badges = [];
  const hept = m.pcs.length === 7;
  // 来源：哪个体裁/地域/理论传统，组内第几旋法
  badges.push(`<span class="badge acc">${m.origin.cn}${m.rot ? " · 第 " + m.rot + " 旋法" : ""}</span>`);
  // 色彩：只看三级与七级
  const cls = {M:"majc", D:"domc", m:"minc", A:"domc", X:"", x:""}[m.colorKey] || "";
  badges.push(`<span class="badge ${cls}">${m.colorCn}</span>`);
  if(!hept) badges.push(`<span class="badge">${m.pcs.length} 声音阶</span>`);
  // 风格与色彩感受：听感层，放在结构层（性质）前面
  if(m.style) badges.push(`<span class="badge style">${m.style}</span>`);
  if(m.mood) badges.push(`<span class="badge mood">${m.mood}</span>`);
  // 音乐语言中的性质（人工写的 traits + 自动算出的结构特征）
  (m.tags || []).forEach(t => badges.push(`<span class="badge warm">${t}</span>`));
  badges.push(`<span class="badge mono">${sp.map(s => hept ? accStr(s.acc) + (s.i + 1) : s.name.replace(/[^A-G#b]/g, "") ).join(" ")}</span>`);
  if(m.rankN) badges.push(`<span class="badge">亮度序 #${m.rankN} / ${MODES.length}</span>`);
  const hasNames = !!(m.degNames && m.degNames.length);
  if(hept && !hasNames && br.marks.length) badges.push(`<span class="badge">相对大调 ${br.marks.map(x => x[0] + "<sup>" + x.slice(1) + "</sup>").join(" ")}</span>`);
  else if(hept && !hasNames) badges.push(`<span class="badge">与大调同构</span>`);
  else if(hasNames && m.pcs.length > 5) badges.push(`<span class="badge">${m.pcs.length} 声（含 ${m.pcs.length - 5} 个偏音）</span>`);
  badges.push(`<span class="badge">三全音 ${tritones(m.pcs)}</span>`);
  badges.push(`<span class="badge">主和弦 ${chordOf(m, 0).sym || "大三"}</span>`);
  $("#mBadges").innerHTML = badges.join("");

  // 出处与性格：这条音阶是什么、在什么场合出现
  const noteEl = $("#mNote");
  noteEl.innerHTML = `<span class="src">${m.origin.cn}</span> —— ${m.origin.note}<br>${m.about}`;
  noteEl.classList.remove("hidden");

  // 半音条：13 格（主音 → 高八度主音），音阶内的格子高亮并标级数
  let strip = "";
  for(let i = 0; i <= 12; i++){
    const pc = (t.pc + i) % 12;
    const inS = i === 12 ? true : m.pcs.includes(i);
    const degIdx = i === 12 ? 0 : m.pcs.indexOf(i);
    const deg = inS ? (i === 12 ? sp[0].roman + "′" : sp[degIdx].roman) : "·";
    const nm = inS ? (i === 12 ? sp[0].name : sp[degIdx].name) : CHROM[pc];
    const isTonic = i === 0 || i === 12;
    const black = [1, 3, 6, 8, 10].includes(pc);
    const midi = 48 + pc + (i === 12 ? 12 : 0);
    strip += `<div class="cell${inS?" in":""}${isTonic?" tonic":""}${black?" black":""}" data-midi="${midi}" title="${nm} · ${freqOf(midi).toFixed(2)} Hz">
        <div class="deg">${deg}</div><div class="nm">${nm}</div><div class="tick"></div></div>`;
  }
  $("#strip").innerHTML = strip;
  $("#strip").querySelectorAll(".cell").forEach(el => {
    el.onclick = () => { audio(); stopVoices(); tone(+el.dataset.midi + state.oct * 12, 0, 0.6, 1); };
  });

  // 和弦卡（每个音阶音一张，五声就是五张、八声八张）
  let cards = "";
  const nDeg = m.pcs.length;
  for(let i = 0; i < nDeg; i++){
    const c = chordOf(m, i), s = sp[i];
    const li0 = s.li, rootMidi = 60 + s.abs;
    const names = c.tones.map(pc => {
      const abs = (t.pc + pc) % 12;                       // c.tones 是相对主音的音程，先换回绝对音高
      const midi = rootMidi + ((abs - s.abs + 12) % 12);
      const k = sp.find(x => x.abs === abs);
      const alt = k ? {step: 0, li: k.li, nacc: k.nacc} : null;
      const nt = pickSpelling(li0, rootMidi, midi, alt);
      return LETTERS[nt.li] + accStr(nt.nacc);
    });
    cards += `<div class="card${i===0?" tonic-card":""}${i===state.chord?" sel":""}" data-i="${i}">
      <div class="deg">${s.roman}</div>
      <div class="nm">${s.name}${c.sym}</div>
      <div class="nt">${names.join(" ")}</div>
      <div class="qc">${i===0?"主":""}</div>
    </div>`;
  }
  $("#cards").innerHTML = cards;
  $("#cards").querySelectorAll(".card").forEach(el => {
    el.onclick = () => {
      const i = +el.dataset.i;
      store.set("chord", i);
      state.chordEx = null;                       // 回到本位和弦，借来的那个取消选中
      $("#cards").querySelectorAll(".card").forEach(x => x.classList.toggle("sel", +x.dataset.i === i));
      document.querySelectorAll(".bch.on").forEach(b => b.classList.remove("on"));
      renderChordStaff();
      playDegree(m, i, t, { arp: $("#arp").checked, voiced: true });
    };
  });

  renderOutside(m, t);

  // 最近邻三个调式
  const near = MODES.filter(x => x.id !== m.id)
    .map(x => ({ x, d: distance(m, x).score }))
    .sort((p, q) => p.d - q.d).slice(0, 3);
  $("#nearList").innerHTML = near.map(({ x, d }) =>
    `<div class="nr" data-id="${x.id}"><b>${x.cn}</b><span>${x.n} · 距离 ${d.toFixed(1)}</span></div>`
  ).join("");
  $("#nearList").querySelectorAll(".nr").forEach(el => {
    el.onclick = () => switchMode(el.dataset.id);
  });
}

/* 借来的和弦 / 副属和弦：两组小卡。点一下试听，同时把下面那行谱切过去 */
function renderOutside(m, t){
  const g1 = $("#borrowGrid"), g2 = $("#secondGrid");
  if(!g1) return;
  const size = (state.voicing || "7") === "3" ? 3 : 4;
  const o = outsideChords(m, t, size);
  const bt = $("#borrowFromTitle");
  if(bt) bt.textContent = o.parallel.cn;
  const sel = state.chordEx;
  const card = x => `<button class="bch${x.kind === "secondary" ? " sec" : ""}${sel && sel.key === x.key && sel.kind === x.kind ? " on" : ""}"
      data-key="${x.key}" data-kind="${x.kind}" title="${x.roman} · ${x.names.join(" ")}">
      <span class="add" title="加到进行台">＋</span>
      <b>${x.roman}</b><u>${x.symbol}</u><s>${x.names.join(" ")}</s></button>`;
  const empty = msg => `<div class="bempty">${msg}</div>`;
  const notHept = m.pcs.length !== 7;

  g1.innerHTML = notHept ? empty("只有七声音阶才谈得上平行调借用")
    : (o.borrow.length ? o.borrow.map(card).join("") : empty("这条音阶的另一侧和它重合，借不出新和弦"));
  if(g2) g2.innerHTML = notHept ? empty("只有七声音阶才有副属和弦")
    : (o.second.length ? o.second.map(card).join("") : empty("没有副属和弦可用"));

  const items = o.borrow.concat(o.second);
  [g1, g2].forEach(box => {
    if(!box) return;
    box.querySelectorAll(".bch").forEach(el => {
      el.onclick = ev => {
        const x = items.find(y => y.key === el.dataset.key && y.kind === el.dataset.kind);
        if(!x) return;
        /* 右上角的 ＋：只往进行台塞一格，不改当前选中的和弦 */
        if(ev.target && ev.target.classList && ev.target.classList.contains("add")){
          if(typeof deckAddEx === "function") deckAddEx(x);
          return;
        }
        state.chordEx = x;
        document.querySelectorAll(".bch").forEach(b => b.classList.remove("on"));
        el.classList.add("on");
        $("#cards").querySelectorAll(".card").forEach(c => c.classList.remove("sel"));
        renderChordStaff();
        playChord(x.root, x.tones, { arp: $("#arp") ? $("#arp").checked : false });
      };
    });
  });
}

uiRegister("detail", renderDetail);
