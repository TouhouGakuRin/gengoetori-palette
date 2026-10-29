/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4e. 顶部主音条（12 键） ---------- */

function renderTonic(env){
  const { $, state } = env;
  const bar = $("#tonicBar");
  bar.innerHTML = TONICS.map((t, i) =>
    `<div class="note${i === state.tone ? " on" : ""}" data-i="${i}">${noteName(t.li, t.acc)}</div>`
  ).join("");
  bar.querySelectorAll(".note").forEach(el => {
    el.onclick = () => { store.set("tone", +el.dataset.i); renderAll(); };
  });
}

uiRegister("tonic", renderTonic);
