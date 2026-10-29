/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 极简状态仓库：一个对象 + 订阅 + 持久化
   用法：
     const store = createStore({ a: 1 });
     const state = store.all();      // 直接读写 state.a 仍然有效（老代码不用改）
     store.set("a", 2);              // 走这里才会持久化 / 通知订阅者
   键的持久化名、类型、取值范围都集中在下面三张表里。 */

const PERSIST_KEY = {
  oct: "mlab-oct",
  a4: "mlab-a4",
  voicing: "mlab-voicing",
  spread: "mlab-spread",
  inv: "mlab-inv",
  theme: "mlab-theme",
  accent: "mlab-accent",
  timbre: "mlab-timbre",
  tuning: "mlab-tuning",
  drone: "mlab-drone",
  // 「你现在在看哪」也要记：以前这些值只活在内存里，重启永远回到 C 伊奥尼亚
  A: "mlab-A",
  tone: "mlab-tone",
  B: "mlab-B",
  chord: "mlab-chord",
  pentaChord: "mlab-penta-chord",
};

// 会话键：大多数被老代码直接赋值（state.A = …），不经过 set()，
// 所以由 renderAll 末尾的 scheduleSessionSave() 批量落盘。
const SESSION_KEYS = ["A", "tone", "B", "chord", "pentaChord"];

const PERSIST_TYPE = { oct: "int", a4: "num", inv: "int", drone: "bool",
  tone: "int", chord: "int" };
const PERSIST_RANGE = { oct: [-2, 2], a4: [400, 480], inv: [0, 3],
  tone: [0, 11], chord: [0, 11] };
const PERSIST_ENUM = { voicing: ["3", "7"], spread: ["open", "close"], theme: ["dark", "light"],
  accent: ["ice", "violet", "mint", "amber", "rose"],
  timbre: ["tri", "piano", "ep", "organ", "sine"],
  pentaChord: ["tertian", "quintal"], tuning: ["et", "just"] };

function createStore(initial){
  const data = Object.assign({}, initial || {});
  const subs = [];
  function clamp(k, v){
    if(PERSIST_TYPE[k] === "bool") return !!v;
    if(PERSIST_RANGE[k]){
      const [lo, hi] = PERSIST_RANGE[k];
      const t = PERSIST_TYPE[k] === "int" ? Math.round(+v) : +v;
      if(!isFinite(t)) return data[k];
      return Math.max(lo, Math.min(hi, t));
    }
    if(PERSIST_ENUM[k] && PERSIST_ENUM[k].indexOf(v) < 0) return data[k];
    return v;
  }

  const api = {
    all(){ return data; },
    get(k){ return data[k]; },

    set(k, v, opts){
      const val = clamp(k, v);
      if(data[k] === val) return data[k];
      const before = data[k];
      data[k] = val;
      if(!(opts && opts.persist === false)) persist(k, val);
      subs.forEach(f => f(k, val, before, data));
      return val;
    },

    subscribe(f){
      subs.push(f);
      return () => { const i = subs.indexOf(f); if(i >= 0) subs.splice(i, 1); };
    },

    // 从 localStorage 读回所有已知键（读不到 / 非法就保持默认值）
    load(){
      for(const k in PERSIST_KEY){
        const raw = read(k);
        if(raw !== undefined) data[k] = raw;
      }
      // 调式 id 可能是旧版本留下的、或手工改过的；不在表里就回默认，别把界面带进不存在的调式
      if(typeof byId === "function"){
        if(data.A != null && !byId(data.A)) data.A = initial.A;
        if(data.B != null && !byId(data.B)) data.B = initial.B;
      }
      return data;
    },

    // 仅测试用：不碰 localStorage
    _reset(){ for(const k in initial) data[k] = initial[k]; },

    // 会话键批量落盘：这些值大多被老代码直接赋值，不经过 set()
    saveSession(){
      for(const k of SESSION_KEYS){
        if(k in data) persist(k, data[k]);
      }
    },
  };
  lastStore = api;
  return api;
}

// 只有一个仓库实例，调度器记住它就够；400ms 合并一次，拖滑杆也不会每帧都写
let lastStore = null;
let sessionTimer = 0;

function scheduleSessionSave(){
  if(typeof setTimeout !== "function" || sessionTimer) return;
  sessionTimer = setTimeout(function(){
    sessionTimer = 0;
    if(lastStore) lastStore.saveSession();
  }, 400);
}

// 关窗口 / 切后台前补一次，别等 400ms 的定时器
if(typeof window !== "undefined" && typeof window.addEventListener === "function"){
  window.addEventListener("pagehide", function(){
    if(lastStore) lastStore.saveSession();
  });
}

function persist(k, v){
  const key = PERSIST_KEY[k];
  if(!key) return;
  try{
    localStorage.setItem(key, PERSIST_TYPE[k] === "bool" ? (v ? "1" : "0") : String(v));
  }catch(e){}
}

function read(k){
  try{
    const s = localStorage.getItem(PERSIST_KEY[k]);
    if(s === null) return undefined;
    let v;
    const t = PERSIST_TYPE[k];
    if(t === "int") v = parseInt(s, 10);
    else if(t === "num") v = parseFloat(s);
    else if(t === "bool") v = s === "1" || s === "true";
    else v = s;

    if(PERSIST_RANGE[k]){
      const [lo, hi] = PERSIST_RANGE[k];
      if(!isFinite(v) || v < lo || v > hi) return undefined;
      return v;
    }
    if(PERSIST_ENUM[k] && PERSIST_ENUM[k].indexOf(v) < 0) return undefined;
    return v;
  }catch(e){ return undefined; }
}
