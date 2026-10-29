/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 3. 视图注册表（早于渲染模块加载，谁都能注册） ---------- */

/*
 * 每个区块在自己的模块里 uiRegister("id", render)，renderAll 按 UI_ORDER 的顺序调用。
 * 注册表放在最前面（早于 20/30 这些渲染模块），这样它们也能在文件末尾直接注册。
 */
const UI_ORDER = [
  "tonic", "list", "detail", "compare", "selects",
  "morph", "map", "staff", "chordStaff", "deck", "quiz", "midiHint", "tune", "settings",
];

const UI_VIEWS = new Map();

function uiRegister(id, render){ UI_VIEWS.set(id, render); }
