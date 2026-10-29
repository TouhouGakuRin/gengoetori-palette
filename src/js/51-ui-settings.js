/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 设置面板
   一个地方集中管「怎么响、长什么样」：
     · 音色（TIMBRES 里那五种）       → state.timbre，改完立刻能试听
     · 律制（平均律 / 纯律）          → state.tuning
     · A4 频率                        → state.a4
     · 持续主音                        → state.drone
     · 主题（深 / 浅）与 UI 主色       → state.theme / state.accent
   值都写进 store，所以刷新、换标签页、导出的链接都还能带着走。 */

const TIMBRE_ORDER = ["tri", "piano", "ep", "organ", "sine"];

const ACCENTS = [
  { id: "ice", cn: "冰蓝", swatch: "#6fc3ff" },
  { id: "violet", cn: "紫", swatch: "#b18cff" },
  { id: "mint", cn: "青绿", swatch: "#4fdcae" },
  { id: "amber", cn: "琥珀", swatch: "#ffc45e" },
  { id: "rose", cn: "玫红", swatch: "#ff9db8" },
];

const THEME_OPTS = [{ id: "dark", cn: "深色" }, { id: "light", cn: "浅色" }];
const TUNING_OPTS = [{ id: "et", cn: "平均律" }, { id: "just", cn: "纯律" }];
const A4_PRESETS = [432, 440, 442, 444];

// 主题 / 主色落到 <html> 上；CSS 那边按 data-theme / data-accent 换变量
function applySkin(){
  const h = document.documentElement;
  h.dataset.theme = state.theme || "dark";
  h.dataset.accent = state.accent || "ice";
  // 顶栏那颗按钮写的是「点它之后会变成什么」，所以取反
  const bt = document.querySelector("#btnTheme");
  if(bt) bt.textContent = h.dataset.theme === "dark" ? "浅色" : "深色";
}

// 一组「分段按钮」：给容器塞按钮，选中项挂 .on
function segInto(box, opts, cur, onPick){
  if(!box) return;
  box.innerHTML = opts.map(o =>
    `<button type="button" data-v="${o.id}"${o.id === cur ? ' class="on"' : ""}>${o.cn}</button>`).join("");
  box.querySelectorAll("[data-v]").forEach(b => {
    b.onclick = () => onPick(b.dataset.v);
  });
}

function renderSettings(){
  segInto($("#setTimbre"), TIMBRE_ORDER.map(k => ({ id: k, cn: timbreName(k) })), state.timbre || "tri", v => {
    store.set("timbre", v);
    setTimbre(v);
    renderSettings();
    previewTimbre();
  });
  const hint = $("#setTimbreHint");
  if(hint) hint.textContent = timbreOf(state.timbre || "tri").hint;

  segInto($("#setTuning"), TUNING_OPTS, state.tuning || "et", v => {
    store.set("tuning", v);
    renderAll();          // 管线里会 setTuning + 重绘频率条 + 刷新本面板
  });

  const a4 = $("#setA4");
  if(a4 && document.activeElement !== a4){
    a4.value = state.a4;
    a4.onchange = () => {
      store.set("a4", +a4.value);
      a4.value = state.a4;
      renderAll();
    };
  }
  const pre = $("#setA4Presets");
  if(pre && !pre.dataset.done){
    pre.dataset.done = "1";
    pre.innerHTML = A4_PRESETS.map(v => `<button type="button" data-a4="${v}">${v}</button>`).join("");
    pre.querySelectorAll("[data-a4]").forEach(b => {
      b.onclick = () => {
        store.set("a4", +b.dataset.a4);
        if(a4) a4.value = state.a4;
        renderAll();
      };
    });
  }

  const dr = $("#setDrone");
  if(dr){
    dr.checked = !!state.drone;
    dr.onchange = () => {
      store.set("drone", dr.checked);
      if(dr.checked) droneOn(tonicObj().pc, state.a4);
      else droneOff();
      renderAll();
    };
  }

  segInto($("#setTheme"), THEME_OPTS, state.theme || "dark", v => {
    store.set("theme", v);
    applySkin();
    const bt = $("#btnTheme");
    if(bt) bt.textContent = v === "dark" ? "浅色" : "深色";
    renderSettings();
  });

  const sw = $("#setAccent");
  if(sw){
    sw.innerHTML = ACCENTS.map(a =>
      `<button type="button" data-accent="${a.id}" title="${a.cn}"` +
      ` style="background:${a.swatch}"${a.id === (state.accent || "ice") ? ' class="on"' : ""}></button>`).join("");
    sw.querySelectorAll("[data-accent]").forEach(b => {
      b.onclick = () => {
        store.set("accent", b.dataset.accent);
        applySkin();
        renderSettings();
      };
    });
  }
}

// 点音色时听一下：主和弦，别太吵
function previewTimbre(){
  try{
    const t = tonicObj().pc;
    playChord(t, [0, 4, 7, 11].map(x => (t + x) % 12), { dur: 0.7, vel: 0.85, base: 55 });
  }catch(e){}
}

function openSettings(){
  renderSettings();
  const d = $("#setDlg");
  if(d && !d.open) d.showModal();
}

function resetSettings(){
  const dflt = { a4: 440, timbre: "tri", tuning: "et", drone: false, theme: "dark", accent: "ice" };
  for(const k in dflt) store.set(k, dflt[k]);
  setTimbre("tri");
  setTuning("et", tonicObj().pc);
  droneOff();
  applySkin();
  const bt = $("#btnTheme");
  if(bt) bt.textContent = "浅色";
  renderAll();
  renderSettings();
}

function bindSettings(){
  const btn = $("#btnSet");
  if(btn) btn.onclick = openSettings;
  const close = $("#setClose");
  if(close) close.onclick = () => $("#setDlg").close();
  const rst = $("#setReset");
  if(rst) rst.onclick = resetSettings;
  const pv = $("#setPreview");
  if(pv) pv.onclick = previewTimbre;
  if(typeof bindData === "function") bindData();
  applySkin();
}

uiRegister("settings", renderSettings);
