/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4c. 五线谱视图（纯绘制部分在 20-render-staff.js） ---------- */

let staffView = "scale";

function renderStaff(){
  const m = activeMode();
  const gs = staffView === "scale" ? staffScaleGroups() : staffChordGroups();
  const r = drawRows(gs, {slotW: staffView === "scale" ? 46 : 64, maxSlots: 8,
    keyNotes: modeKeyNotes(), mark: true});
  const svg = $("#staff");
  svg.innerHTML = r.markup;
  svg.setAttribute("viewBox", `0 0 ${r.W} ${r.H}`);
  svg.setAttribute("width", r.W);
  svg.setAttribute("height", r.H);
  $("#staffKey").textContent = `${m.cn} · 主音 ${curTonicName()} · 调号 ${keySigLabel(m, r.f)}`
    + (r.cost ? ` · 另 ${r.cost} 处临时记号` : "");
  $("#btnStaffScale").classList.toggle("on", staffView === "scale");
  $("#btnStaffChords").classList.toggle("on", staffView === "chords");
  renderCharLine(m);
}

/* 特征音那一行：把「这条音阶比本位多出来的音」写成人话，暖色和谱面上的染色对应 */
function renderCharLine(m){
  const el = $("#charLine");
  if(!el) return;
  if(staffView !== "scale"){ el.style.display = "none"; return; }
  el.style.display = "";
  const ch = charNotes(m);
  if(!ch.idx.length){
    el.innerHTML = `<span class="ck">特征音</span>没有 —— 它和本位${ch.refName}是同一个音集`;
    return;
  }
  const sp = spell(m, tonicObj());
  const names = ch.idx.map(i => sp[i].name).join(" ");
  el.innerHTML = `<span class="ck">特征音</span><b>${names}</b>`
    + ` 相对本位${ch.refName}改了 ${ch.idx.length} 个音（谱面上染成暖色）`;
}

/* 播放音阶时逐个点亮谱面：计划里的时间点是秒，换成定时器 */
let markTimers = [];
function clearMarks(){
  markTimers.forEach(t => clearTimeout(t));
  markTimers = [];
  const svg = $("#staff");
  if(svg) svg.querySelectorAll(".ch.hl").forEach(g => g.classList.remove("hl"));
}
function markPlan(plan, giOf){
  clearMarks();
  const svg = $("#staff");
  if(!svg || !plan) return;
  const groups = svg.querySelectorAll(".ch");
  if(!groups.length) return;
  const pick = giOf || (k => k);      // 谱面第 k 组 = 计划第 k 个音（末音是高八度主音）
  plan.forEach((e, k) => {
    const gi = pick(k);
    const t = setTimeout(() => {
      groups.forEach(g => g.classList.remove("hl"));
      const g = svg.querySelector(`.ch[data-gi="${gi}"]`);
      if(g) g.classList.add("hl");
    }, Math.max(0, e.at * 1000));
    markTimers.push(t);
  });
  const last = plan[plan.length - 1];
  markTimers.push(setTimeout(() => {
    groups.forEach(g => g.classList.remove("hl"));
  }, (last ? last.at + last.dur : 1) * 1000));
}

// 选中的和弦单独一行谱
function renderChordStaff(){
  if(state.chordEx){ renderOutsideStaff(state.chordEx); return; }
  const m = activeMode(), t = tonicObj(), sp = spell(m, t);
  const i = state.chord || 0;
  const c = chordOf(m, i);
  const v = chordVoicing(m, i);
  const r0 = 60 + t.pc + m.pcs[i];
  const sh = staffShift(r0, v.off);
  const li0 = sp[i].li;
  const notes = v.off.map((o, k) => {
    const midi = r0 + o + sh, j = v.degs[k];
    const octS = octaveFor(sp[j].li, midi);
    return pickSpelling(li0, r0, midi, {step: sp[j].li + 7*octS, li: sp[j].li, nacc: sp[j].nacc});
  });
  const bassName = sp[v.degs[0]].name;
  const sym = (c.sym || "") + (v.inv > 0 ? "/" + bassName : "");
  const g = [{label: sp[i].roman, sub: sp[i].name + sym, notes}];
  const r = drawStaff(g, {slotW: 120, scale: 2.0, keyNotes: modeKeyNotes()});
  const svg = $("#chordStaff");
  svg.innerHTML = r.markup;
  svg.setAttribute("viewBox", `0 0 ${r.W} ${r.H}`);
  svg.setAttribute("width", r.W);
  svg.setAttribute("height", r.H);
  $("#chordStaffKey").textContent = `选中和弦 · ${sp[i].roman} · ${sp[i].name}${sym}`;
  const toneNames = notes.map(n => LETTERS[n.li] + accStr(n.nacc));
  $("#chordStaffHint").textContent = `${toneNames.join(" ")} · ${INV_LABEL[v.inv]} · ${v.open ? "开放排列" : "密集排列"}`;
  syncVoicingUI();
}

/* 借来的和弦 / 副属和弦：同样一行谱，但拼写按它自己的根音做三度叠置
   （C 上的 ♭VII 写成 Bb–D–F，不会变成 A#）。 */
function renderOutsideStaff(ex){
  const m = activeMode(), t = tonicObj();
  const base = 60 + ex.root;
  const li0 = LETTERS.indexOf(ex.names[0][0]);
  const sh = staffShift(base, ex.ivs);
  const notes = ex.ivs.map(iv => spellTone(li0, base, base + iv + sh));
  const g = [{label: ex.roman, sub: ex.symbol, notes: notes}];
  const r = drawStaff(g, {slotW: 120, scale: 2.0, keyNotes: modeKeyNotes()});
  const svg = $("#chordStaff");
  svg.innerHTML = r.markup;
  svg.setAttribute("viewBox", `0 0 ${r.W} ${r.H}`);
  svg.setAttribute("width", r.W);
  svg.setAttribute("height", r.H);
  const kindCn = ex.kind === "secondary" ? "副属和弦" : "借用 · " + ex.from;
  $("#chordStaffKey").textContent = `${kindCn} · ${ex.roman} · ${ex.symbol}`;
  $("#chordStaffHint").textContent = ex.kind === "secondary"
    ? `${ex.names.join(" ")} · 用在 ${ex.target} 之前`
    : `${ex.names.join(" ")} · ${m.cn} 里没有这几个音`;
}

uiRegister("staff", renderStaff);
uiRegister("chordStaff", renderChordStaff);
/* 音色/律制按钮的状态（按钮长什么样由这里定，逻辑由 60-main 绑） */
function syncTuneUI(){
  document.querySelectorAll("[data-tuning]").forEach(b =>
    b.classList.toggle("on", b.dataset.tuning === (state.tuning || "et")));
  const d = $("#btnDrone");
  if(d){
    d.classList.toggle("on", !!state.drone);
    d.setAttribute("aria-pressed", state.drone ? "true" : "false");
    d.textContent = state.drone ? "持续主音 · 开" : "持续主音";
  }
  const fl = $("#freqLine");
  if(fl) fl.classList.toggle("just", (state.tuning || "et") === "just");
}
