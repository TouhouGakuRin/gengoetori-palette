/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 5. 启动：全局事件 + 初始化 ---------- */

/* 卡片区标题随音阶音数变化（七声写「七个」，其余写「六个 / 八个 / 十二个」） */
function cardsTitleText(v){
  const m = activeMode(), n = m.pcs.length;
  const num = n === 7 ? "七个" : n + " 个";
  if(n === 5 && typeof state !== "undefined" && state.pentaChord === "quintal"){
    return `${num}五度叠置和弦 · 在五声纵合链上取相邻音`;
  }
  return v === "3" ? `${num}三和弦 · 在音阶内叠两次三度` : `${num}和弦 · 在音阶内叠三度`;
}

// 五度叠置时，三/七和弦的开关改叫「三音 / 四音」（它只管叠几个音）
function syncVoicingLabel(){
  const m = activeMode();
  const q = m.pcs.length === 5 && typeof state !== "undefined" && state.pentaChord === "quintal";
  document.querySelectorAll(".vseg button[data-v]").forEach(b => {
    b.textContent = q ? (b.dataset.v === "3" ? "三音" : "四音") : (b.dataset.v === "3" ? "三和弦" : "七和弦");
  });
}

/* 变体开关：三和弦 / 七和弦、排列、转位 */
function setVoicing(v){
  store.set("voicing", v);
  document.querySelectorAll(".vseg button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  const ti = $("#cardsTitle");
  if(ti) ti.textContent = cardsTitleText(v);
  syncVoicingUI();
  renderAll();
}

// 排列 / 转位按钮状态 + 可用转位数（三和弦只有一转、二转）
function syncVoicingUI(){
  const n = chordDegrees(state.chord || 0).length;
  state.inv = Math.min(Math.max(state.inv || 0, 0), n - 1);
  document.querySelectorAll("#segSpread button").forEach(b =>
    b.classList.toggle("on", b.dataset.spread === state.spread));
  document.querySelectorAll("#segInv button").forEach(b => {
    const i = +b.dataset.inv;
    b.disabled = i > n - 1;
    b.classList.toggle("on", i === state.inv);
  });
}

function setSpread(v){
  store.set("spread", v);
  syncVoicingUI();
  renderStaff(); renderChordStaff();
  /* 用 activeMode：变形滑杆动过时，听到的也得是变形后的音（谱面就是它画的） */
  playDegree(activeMode(), state.chord || 0, tonicObj(), { voiced: true, dur: 0.9 });
}

function setInv(v){
  const n = chordDegrees(state.chord || 0).length;
  store.set("inv", Math.min(Math.max(+v || 0, 0), n - 1));
  syncVoicingUI();
  renderStaff(); renderChordStaff();
  playDegree(activeMode(), state.chord || 0, tonicObj(), { voiced: true });
}

/* 顶部主音条的点击在 45-ui-tonic.js，其余事件集中在这里 */

// 中国五声的内部选项：旋宫 / 偏音（按钮是现生成的，用事件委托）
document.addEventListener("click", (e) => {
  const b = e.target.closest("#pentaOpts button");
  if(!b) return;
  if(b.dataset.pen !== undefined){ switchMode(b.dataset.pen); return; }
  if(b.dataset.model !== undefined) store.set("pentaChord", b.dataset.model);
  else if(b.dataset.rot !== undefined) store.set("rot5", +b.dataset.rot);
  else if(b.dataset.b4 !== undefined) store.set("b4", +b.dataset.b4);
  else if(b.dataset.b7 !== undefined) store.set("b7", +b.dataset.b7);
  else return;
  renderAll();
});

$("#search").oninput = () => renderAll();
$("#sortSel").onchange = () => renderAll();
$("#segSpread").onclick = e => { const b = e.target.closest("button"); if(b) setSpread(b.dataset.spread); };
$("#segInv").onclick = e => { const b = e.target.closest("button"); if(b && !b.disabled) setInv(b.dataset.inv); };
$("#selA").onchange = e => switchMode(e.target.value);
$("#selB").onchange = e => { store.set("B", e.target.value); renderAll(); };

/* 播放音阶：走一遍 plan，再把同一份计划交给谱面做同步高亮 */
function playScaleMarked(){
  const m = activeMode(), t = tonicObj();
  const o = withTune({ arp: $("#arp").checked });
  const plan = planScale(m, t, o);
  playEvents(plan, o.a4);
  if(staffView === "scale") markPlan(plan);
}

$("#btnScale").onclick = playScaleMarked;

$("#btnTonic").onclick = () => {
  const m = activeMode(), t = tonicObj();
  state.chord = 0;
  $("#cards").querySelectorAll(".card").forEach(x => x.classList.toggle("sel", +x.dataset.i === 0));
  renderChordStaff();
  playDegree(m, 0, t, { arp: $("#arp").checked, dur: 1.0, voiced: true });
};

$("#btnProg").onclick = () => {
  const m = activeMode(), t = tonicObj();
  audio();
  /* 整条进行拼成一份计划一次排上：playEvents 每次都会清总线，
     逐个 playDegree 会把先排的和弦掐掉，只剩最后一个能听见。 */
  const o = withTune({ arp: $("#arp").checked });
  let plan = [];
  for(let i = 0; i < m.pcs.length; i++){
    plan = plan.concat(planDegree(m, i, t, Object.assign({}, o, {
      when: i * 0.62, dur: 0.4, vel: 0.85, voiced: true })));
  }
  playEvents(plan, o.a4);
  for(let i = 0; i < m.pcs.length; i++){
    setTimeout(() => {
      state.chord = i;
      $("#cards").querySelectorAll(".card").forEach(x => x.classList.toggle("sel", +x.dataset.i === i));
      renderChordStaff();
    }, i * 620);
  }
};

$("#btnAB").onclick = () => {
  const a = byId(state.A), b = byId(state.B), t = tonicObj();
  audio();
  /* A 和弦与 B 和弦同一条时间线：分两次 playEvents 会把 A 掐掉 */
  const o = withTune({});
  playEvents(planDegree(a, 0, t, Object.assign({}, o, { dur: 0.9, vel: 0.9 }))
    .concat(planDegree(b, 0, t, Object.assign({}, o, { when: 1.3, dur: 0.9, vel: 0.9 }))), o.a4);
  const onlyA = a.pcs.filter(p => !b.pcs.includes(p));
  const onlyB = b.pcs.filter(p => !a.pcs.includes(p));
  let w = 2.7;
  onlyA.forEach((p, i) => { tone(48 + ((t.pc + p) % 12), w + i * 0.16, 0.5, 1); });
  w += onlyA.length * 0.16 + 0.25;
  onlyB.forEach((p, i) => { tone(48 + ((t.pc + p) % 12), w + i * 0.16, 0.5, 1); });
};

$("#btnTheme").onclick = () => {
  const h = document.documentElement;
  const next = h.dataset.theme === "dark" ? "light" : "dark";
  store.set("theme", next);
  applySkin();
  $("#btnTheme").textContent = next === "dark" ? "浅色" : "深色";
  if(typeof renderSettings === "function") renderSettings();
};

$("#btnDoc").onclick = () => $("#dlg").showModal();
$("#dlgClose").onclick = () => $("#dlg").close();

/* 模块切换：一次只显示一个模块，左栏音阶库不跟着消失 */
document.querySelectorAll("[data-mod]").forEach(b => {
  if(typeof moduleById === "function"){
    const m = moduleById(b.dataset.mod);
    if(m && m.hint) b.title = `${m.hint}（Alt+${moduleIndexOf(m.id) + 1}）`;
  }
  b.onclick = () => {
    if(typeof showModule === "function") showModule(b.dataset.mod);
    if(typeof libSetOpen === "function") libSetOpen(false);
  };
});

/* ---------- 听：持续主音 + 律制 ---------- */

$("#btnDrone").onclick = () => {
  const on = !state.drone;
  store.set("drone", on);
  if(on) droneOn(tonicObj().pc, state.a4);
  else droneOff();
  renderAll();
};

document.querySelectorAll("[data-tuning]").forEach(b => {
  b.onclick = () => {
    store.set("tuning", b.dataset.tuning);
    setTuning(state.tuning, tonicObj().pc);
    renderAll();
    if(state.drone) droneOn(tonicObj().pc, state.a4);   // 换律制时 drone 不用变，但保个平安
  };
});

$("#btnMorphReset").onclick = () => morphReset();
$("#btnQuizNew").onclick = () => newQuiz();
$("#btnQuizPlay").onclick = () => playQuiz();

/* 键盘：空格试听当音阶，← → 换调式，Esc 关弹窗 */
document.addEventListener("keydown", e => {
  const tag = (e.target.tagName || "").toLowerCase();
  if(tag === "input" || tag === "select" || tag === "textarea") return;
  // 焦点在按钮、链接或可编辑区时，空格与回车归控件自己，不再被全局试听抢走
  if(e.target.closest && e.target.closest("button,a,[role=button],[contenteditable=true]")) return;
  // Alt+1…7 直接切模块（与顶部按钮顺序一致）
  if(e.altKey && /^[1-7]$/.test(e.key) && typeof MODULES !== "undefined"){
    const m = MODULES[Number(e.key) - 1];
    if(m){ e.preventDefault(); showModule(m.id); return; }
  }
  if(e.code === "Space"){ e.preventDefault(); playScaleMarked(); return; }
  if(e.key === "Escape"){
    const d = document.querySelector("dialog[open]");
    if(d){ d.close(); return; }
    if(typeof libSetOpen === "function") libSetOpen(false);
    return;
  }
  if(e.key === "ArrowLeft" || e.key === "ArrowRight"){
    const i = MODES.findIndex(m => m.id === state.A);
    if(i < 0) return;
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + MODES.length) % MODES.length;
    switchMode(MODES[n].id);
  }
});

/* 启动 */
(function init(){
  // 升级前的老数据没有 mlab-tone：进行台里记下的主音是唯一线索
  let hadTone = false;
  try{ hadTone = localStorage.getItem("mlab-tone") !== null; }catch(_){}
  store.load();
  if(typeof loadDeck === "function") loadDeck();
  if(!hadTone && deck.savedTone != null && deck.slots.some(Boolean)){
    state.tone = deck.savedTone;
    setTimeout(() => {
      if(typeof toast === "function"){
        const t = TONICS[deck.savedTone];
        toast(`已按进行台保存时的主音打开：${noteName(t.li, t.acc)}`);
      }
    }, 700);
  }
  applyHash();       // 链接里带了 #m=…&t=… 就先按链接来
  applySkin();       // 主题 + 主色
  $("#btnTheme").textContent = state.theme === "dark" ? "浅色" : "深色";
  if(typeof bindSettings === "function") bindSettings();
  document.querySelectorAll(".vseg button").forEach(b => b.classList.toggle("on", b.dataset.v === state.voicing));
  syncVoicingUI();
  const ct = $("#cardsTitle");
  if(ct) ct.textContent = cardsTitleText(state.voicing);
  renderAll();       // selects / quiz 都在 UI_ORDER 里，不必单独调
  renderMap();
  newQuiz();

  // 窗口拉宽到双栏时，把还开着的抽屉收回去，免得遮在正文上
  window.addEventListener("resize", () => {
    if(!window.matchMedia || !matchMedia("(max-width:980px)").matches){
      if(typeof libSetOpen === "function") libSetOpen(false);
    }
  }, { passive: true });

  // 回到上次停下的模块；第一次打开就是音阶页
  if(typeof showModule === "function") showModule(savedModule(), { quiet: true, noScroll: true });
})();
