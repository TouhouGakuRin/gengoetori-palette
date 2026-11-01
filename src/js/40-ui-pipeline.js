/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4. 应用外壳：单例状态 + 视图管线 ---------- */

// state 就是仓库里那个对象：读 state.x 不触发任何事，改值走 store.set(...)
const store = createStore({ rot5:0, b4:0, b7:0, pentaChord:"tertian", 
  tone: 0, A: "ion", B: "dor", theme: "dark", chord: 0,
  voicing: "7", oct: 0, a4: 440, inv: 0, spread: "close",
  tuning: "et", drone: false, timbre: "tri", accent: "ice",
});
const state = store.all();

const $ = s => document.querySelector(s);
const byId = id => MODES.find(m => m.id === id);
function tonicObj(){ return TONICS[state.tone]; }

// 谱面 / 和弦卡 / 试听都要读「当前生效的音阶」：
// 变形滑杆动过时就是那个变体，否则就是选中的调式。
// 只应用「音阶内部选项」（中国五声的旋宫 + 偏音），不含变形滑杆。
// 五声的 id 是 penG…penY，判断用 pentRot（写成 m.id === "pen" 的旧判断永远不成立，
// 偏音按钮就只剩高亮、音集不动 —— v1.1.4 里整个偏音功能因此失效）。
function baseMode(){
  const m = byId(state.A);
  if(!m) return m;
  if(m.pentRot != null && typeof pentaMode === "function"){
    return pentaMode(m, { rot: m.pentRot || 0, b4: state.b4 || 0, b7: state.b7 || 0 });
  }
  return m;
}

function activeMode(){
  const m = baseMode();
  if(typeof morphActive === "function" && morphActive()) return morphMode(m);
  return m;
}

/*
 * 渲染管线
 * ─────────────────────────────────────────────────────────────
 * 注册表（UI_ORDER / UI_VIEWS / uiRegister）在 06-ui-registry.js，
 * 这样 20/30 那些渲染模块也能在文件末尾直接注册。
 *
 * 三条约束：
 *   1. 顺序固定。写在 UI_ORDER 里，与文件名字母序无关；后面渲染的视图可以放心用
 *      前面已经刷进 DOM 的内容（比如 detail 依赖 state.A，compare 依赖 state.B）。
 *   2. 视图之间不互相调用。要切调式走 switchMode()，要重绘走 renderAll()，
 *      不允许 renderList() 直接调 renderDetail()。
 *   3. 单个视图抛错不打断整轮。捕获后 console.error 并继续，坏的是哪一块一眼能看出来。
 */
// 传给每个视图的环境对象：只用这几个入口，别直接摸全局
function uiEnv(){ return { state, store, $, byId, tonicObj }; }

function syncBrand(){
  const n = MODES.length;
  const fam = ORIGINS.filter(o => MODES.some(m => m.src === o.id)).length;
  const sub = $("#brandSub");
  if(sub) sub.textContent = `${n} 个音阶 · ${fam} 个来源 · 音高集合推导`;
  document.title = `幻歌鸟调色盘 · ${n} 个音阶`;
}

/* 音频侧的设置跟着 state 走：律制的参照主音永远是当前主音，
   持续音（drone）开着的时候换主音要跟着换音高。 */
function syncAudioState(){
  if(typeof setTuning !== "function") return;
  const t = tonicObj();
  setTuning(state.tuning || "et", t.pc);
  if(typeof setTimbre === "function") setTimbre(state.timbre || "tri");
  if(typeof droneIsOn === "function" && droneIsOn()){
    if(state.drone) droneOn(t.pc, state.a4);
    else droneOff();
  }
}

function renderAll(){
  const env = uiEnv();
  const missing = [];
  syncBrand();
  syncAudioState();   // 律制的参照主音、持续音的音高，都跟着 state 走
  for(const id of UI_ORDER){
    const fn = UI_VIEWS.get(id);
    if(!fn){ missing.push(id); continue; }
    try{ fn(env); }
    catch(e){ console.error("[ui] " + id + " 渲染失败", e); }
  }
  renderAll.missing = missing;
  if(missing.length && !renderAll._warned){
    renderAll._warned = true;
    console.warn("[ui] 尚未接管的视图：" + missing.join(", "));
  }
  // 地址栏跟着状态走（50-ui-export.js）：一个链接就能复现现场
  if(typeof syncHash === "function") syncHash();
  // 当前调式 / 主音 / 和弦这些「你在看哪」也落盘，下次打开接着看
  if(typeof scheduleSessionSave === "function") scheduleSessionSave();
  return missing;
}

/* ---------- 换当前调式的唯一入口 ---------- */
// 全站唯一的“换当前调式”入口：重渲染 + 地图把新调式移到画面中心
function switchMode(id){
  if(!byId(id)) return;
  store.set("A", id);   // 走仓库才会持久化（以前重启就丢）
  renderAll();
  if(mapState.pos) centerMapOn(id);
}
