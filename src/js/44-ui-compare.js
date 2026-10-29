/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4d. A/B 对比：下拉框 + 差异面板 ---------- */

function renderSelects(env){
  const { $, state } = env;
  const opts = MODES.map(m => `<option value="${m.id}">${m.cn} · ${m.n}</option>`).join("");
  $("#selA").innerHTML = opts;
  $("#selB").innerHTML = opts;
  $("#selA").value = state.A;
  $("#selB").value = state.B;
}

function renderCompare(env){
  const { $, state, byId, tonicObj } = env;
  const a = byId(state.A), b = byId(state.B), d = distance(a, b), t = tonicObj();
  const spA = spell(a, t), spB = spell(b, t);

  const onlyA = a.pcs.filter(p => !b.pcs.includes(p));
  const onlyB = b.pcs.filter(p => !a.pcs.includes(p));
  const shared = a.pcs.filter(p => b.pcs.includes(p));
  // a.pcs / b.pcs 是相对主音的音程，spell() 的 abs 是绝对音高，取音名前必须先换回相对值
  const rel = s => ((s.abs - t.pc) % 12 + 12) % 12;
  const nm = pc => {
    const s = spA.find(x => rel(x) === pc) || spB.find(x => rel(x) === pc);
    return s ? s.name : CHROM[(pc + t.pc) % 12];
  };

  $("#selA").value = a.id;
  $("#selB").value = b.id;
  $("#cmpBody").innerHTML = `
    <div class="box"><h4>距离</h4><p class="big">${d.pct}<span style="font-size:12px;color:var(--dim2)"> / 100</span></p>
      <p style="color:var(--dim2);font-size:12px">A 独有 ${d.onlyA} 个音 · B 独有 ${d.onlyB} 个 · 三全音差 ${Math.abs(d.ta - d.tb)}</p></div>
    <div class="box"><h4>共同音（${shared.length}）</h4><p class="mono">${shared.map(nm).join(" ")}</p>
      <p style="color:var(--dim2);font-size:12px;margin-top:6px">A 三全音 ${d.ta} · B 三全音 ${d.tb}</p></div>
    <div class="box"><h4>${a.cn} 独有（${onlyA.length}）</h4><p class="mono">${onlyA.map(nm).join(" ") || "—"}</p>
      <p style="color:var(--dim2);font-size:12px;margin-top:6px">主和弦 ${spA[0].name}${d.qa}</p></div>
    <div class="box"><h4>${b.cn} 独有（${onlyB.length}）</h4><p class="mono">${onlyB.map(nm).join(" ") || "—"}</p>
      <p style="color:var(--dim2);font-size:12px;margin-top:6px">主和弦 ${spB[0].name}${d.qb}</p></div>`;
}

uiRegister("selects", renderSelects);
uiRegister("compare", renderCompare);
