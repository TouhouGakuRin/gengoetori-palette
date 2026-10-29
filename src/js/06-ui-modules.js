/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 0c. 模块清单与视图路由 ----------
 * 页面上一次只显示一个模块，左栏音阶库始终保留：切到地图、进行台时仍能换音阶。
 * 视图不写进 URL —— #m=…&t=… 已经用来分享音阶状态，加路由会打断老链接。
 *
 * 模块契约（U1）：
 *   { id, label, hint, targets, enter(ctx), leave(ctx) }
 *   - enter 在切换完成后 30ms 调用（此时新 section 已可见，能量尺寸）
 *   - leave 在离开前调用，用来收绳较重的临时状态
 *   - ctx = { from } / { to }
 */

const MODULES = [
  { id: "scale",   label: "音阶",   hint: "选音阶、看谱面与和弦", targets: [] },
  { id: "compare", label: "对比",   hint: "A / B 两个音阶并排比较", targets: ["secCmp"] },
  { id: "map",     label: "地图",   hint: "调式地图：拖动、滚轮缩放、双击回中", targets: ["secMap"],
    enter: () => { if(typeof renderMap === "function") renderMap(); } },
  { id: "morph",   label: "变形",   hint: "把某一级升降半音，看它变成谁", targets: ["secMorph"] },
  { id: "deck",    label: "进行台", hint: "把和弦拖进槽位，导出 .mid", targets: ["secDeck"],
    enter: () => { if(typeof renderDeckStaff === "function") renderDeckStaff(); } },
  { id: "quiz",    label: "测验",   hint: "听一段，选出调式", targets: ["secQuiz"] },
  { id: "midi",    label: "MIDI",   hint: "导出 .mid，拖进 Cubase", targets: ["secMidi"] },
];

const VIEW_KEY = "mlab-view";

let currentModule = null;

function moduleById(id){
  return MODULES.find(m => m.id === id) || MODULES[0];
}

function moduleIndexOf(id){
  const i = MODULES.findIndex(m => m.id === id);
  return i < 0 ? 0 : i;
}

/* opts.quiet: 不写 localStorage（启动还原时用）；opts.noScroll: 不跳到顶部 */
function showModule(id, opts){
  const mod = moduleById(id);
  const o = opts || {};
  const prev = currentModule ? moduleById(currentModule) : null;

  if(prev && prev.id !== mod.id && typeof prev.leave === "function"){
    try { prev.leave({ to: mod.id }); } catch(_){}
  }

  currentModule = mod.id;
  document.body.setAttribute("data-view", mod.id);
  MODULES.forEach(m => {
    const on = m.id === mod.id;
    (m.targets || []).forEach(t => {
      const el = document.getElementById(t);
      if(el) el.classList.toggle("on", on);
    });
  });
  document.querySelectorAll("[data-mod]").forEach(b => {
    const on = b.dataset.mod === mod.id;
    b.classList.toggle("on", on);
    if(on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if(!o.quiet){
    try{ localStorage.setItem(VIEW_KEY, mod.id); }catch(_){}
  }
  if(!o.noScroll) window.scrollTo(0, 0);
  if(typeof mod.enter === "function"){
    setTimeout(() => { try { mod.enter({ from: prev ? prev.id : null }); } catch(_){} }, 30);
  }
}

function savedModule(){
  try{ return localStorage.getItem(VIEW_KEY) || "scale"; }catch(_){ return "scale"; }
}
