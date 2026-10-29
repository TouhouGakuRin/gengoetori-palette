/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4a. 调音：八度 + A4 参考频率 ---------- */

function setOct(v){
  store.set("oct", v);
  renderAll();
}

function setA4(v){
  store.set("a4", v);
  renderAll();
}

function renderTune(env){
  const { $, state } = env;

  const lbl = $("#octLbl");
  if(lbl) lbl.textContent = (state.oct > 0 ? "+" : "") + state.oct;

  const note = $("#octNote");
  if(note){
    const lo = 48 + state.oct * 12;
    note.textContent = `（${midiName(lo)} → ${midiName(lo + 12)}）`;
  }

  const inp = $("#a4In");
  if(inp && document.activeElement !== inp) inp.value = state.a4;

  document.querySelectorAll("[data-a4]").forEach(b =>
    b.classList.toggle("on", Math.abs(+b.dataset.a4 - state.a4) < 0.05));

  const fl = $("#freqLine");
  if(fl){
    const base = 60 + state.oct * 12;
    const just = state.tuning === "just";
    const tpc = tonicObj().pc;
    fl.innerHTML = `<span class="fq"><b>${just ? "基准 A4" : "A4"}</b> ${state.a4.toFixed(2)} Hz</span>`
      + PITCH_NAMES.map((n, i) => {
          const m = base + i;
          const hz = just ? justFreq(m, tpc, state.a4) : freqOf(m);
          const ct = just ? ` <i class="ct">${(justCents(m - tpc) >= 0 ? "+" : "")}${justCents(m - tpc).toFixed(1)}c</i>` : "";
          return `<span class="fq"><b>${n}${Math.floor(m / 12) - 1}</b> ${hz.toFixed(2)}${ct}</span>`;
        }).join("");
  }
  if(typeof syncTuneUI === "function") syncTuneUI();
}

// 十二个音的实际频率（给测试用，页面用上面的 renderTune）
function tuneFreqs(oct, a4){
  const base = 60 + (oct || 0) * 12;
  return PITCH_NAMES.map((n, i) => ({ name: n, midi: base + i, hz: freqOf(base + i, a4) }));
}

uiRegister("tune", renderTune);
