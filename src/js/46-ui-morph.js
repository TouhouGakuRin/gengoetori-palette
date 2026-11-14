/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4f. 变形滑杆：每个音级一根真滑杆（−2…+2 半音） ---------- */

const morph = { off: [], mode: null, rows: null };

function morphResetOff(n){ return new Array(n).fill(0); }

function morphActive(){
  const m = (typeof baseMode === "function" ? baseMode() : byId(state.A));
  if(!m) return false;
  if(morph.mode !== m.id) return false;
  if(morph.off.length !== m.pcs.length) return false;
  return morph.off.some(x => x !== 0);
}

// 变形后的「虚拟调式」：谱面、和弦卡、试听都读它
function morphMode(base){
  const m = base || (typeof baseMode === "function" ? baseMode() : byId(state.A));
  const pcs = m.pcs.map((p, i) => ((p + (morph.off[i] || 0)) % 12 + 12) % 12);
  return Object.assign({}, m, {pcs, morphOf: base ? base.id : m.id});
}

// 变形后的音高集合（去重排序）——只用于「等于哪个调式」的匹配与试听。
// 用 baseMode 而不是 byId：五声挂了偏音后是 6/7 声，变形行也按那个长度建。
function morphPcs(){
  const m = baseMode(), set = new Set();
  for(let i = 0; i < m.pcs.length; i++) set.add(((m.pcs[i] + (morph.off[i] || 0)) % 12 + 12) % 12);
  return [...set].sort((a, b) => a - b);
}

// 把 (主音, 级数序号, 相对主音的半音) 拼成音名：七声按字母顺序，其余按半音名
function degName(t, i, pc){
  const m = byId(state.A);
  if(m && m.pcs.length === 7){
    const letter = LETTERS[(t.li + i) % 7];
    const target = (t.pc + pc) % 12;
    let acc = (target - LPC[letter] + 12) % 12;
    if(acc > 6) acc -= 12;
    return letter + accStr(acc);
  }
  const abs = (t.pc + pc) % 12;
  return (t.acc < 0 ? CHROM_FLAT : CHROM_SHARP)[abs];
}

// 第 i 级变形后相对「同名级数」的升降：按字母算（和 degName 同一套），
// 不能直接拿 pc − IONIAN[i]，否则升过头绕回低八度时会算成 ♭♭♭♭♭♭♭♭♭♭♭
function morphAcc(t, i, v){
  const letter = LETTERS[(t.li + i) % 7];
  const target = (t.pc + v) % 12;
  let acc = (target - LPC[letter] + 12) % 12;
  if(acc > 6) acc -= 12;
  return acc;
}

// 行只建一次；之后只改文字与滑杆值（重建会丢滚动锚点）
function buildMorphRows(){
  const m = (typeof baseMode === "function" ? baseMode() : byId(state.A)), n = m.pcs.length;
  let rows = "";
  for(let i = 0; i < n; i++){
    rows += `<div class="mrow">
      <span class="d" data-i="${i}"></span>
      <input class="rg" type="range" min="-2" max="2" step="1" value="0" data-i="${i}" aria-label="第 ${i+1} 级">
      <span class="v">0</span>
      <span class="n"></span>
      <span class="s"></span>
    </div>`;
  }
  $("#morphRows").innerHTML = rows;
  $("#morphRows").querySelectorAll("input.rg").forEach(el => {
    el.oninput = () => {
      morph.off[+el.dataset.i] = +el.value;
      renderAll();
    };
    el.ondblclick = () => { morph.off[+el.dataset.i] = 0; renderAll(); };
  });
  morph.rows = [...$("#morphRows").querySelectorAll(".mrow")].map(el => ({
    d: el.querySelector(".d"), v: el.querySelector(".v"),
    n: el.querySelector(".n"), s: el.querySelector(".s"),
    rg: el.querySelector(".rg"),
  }));
}

function renderMorph(){
  const m = (typeof baseMode === "function" ? baseMode() : byId(state.A)), t = tonicObj(), n = m.pcs.length;
  if(morph.mode !== state.A || !morph.rows || morph.off.length !== n){
    morph.mode = state.A;
    morph.off = morphResetOff(n);
    buildMorphRows();
  }
  const hept = n === 7;
  for(let i = 0; i < n; i++){
    const v = m.pcs[i] + morph.off[i];
    const pc = ((v % 12) + 12) % 12;
    const ofs = morph.off[i], r = morph.rows[i];
    r.d.textContent = m.degNames ? m.degNames[i] : (hept ? ROMAN[i] : String(i + 1));
    r.n.textContent = degName(t, i, pc);
    r.v.textContent = ofs > 0 ? "+" + ofs : String(ofs);
    r.v.classList.toggle("act", ofs !== 0);
    r.s.textContent = hept ? accStr(morphAcc(t, i, v)) + ROMAN[i] : "";
    if(+r.rg.value !== ofs) r.rg.value = String(ofs);
  }
  renderMorphResult();
}

function renderMorphResult(){
  const m = byId(state.A), t = tonicObj(), pcs = morphPcs();
  const key = [...pcs].join(",");
  const exact = MODES.find(x => x.pcs.length === pcs.length && x.pcs.join(",") === key);
  const fake = {pcs};
  const tc = chordOf(fake, 0);
  const hept = m.pcs.length === 7;

  const degStr = m.pcs.map((p, i) => {
    const v = p + (morph.off[i] || 0);
    const abs = ((t.pc + v) % 12 + 12) % 12;
    if(hept) return accStr(morphAcc(t, i, v)) + (i + 1);
    return (t.acc < 0 ? CHROM_FLAT : CHROM_SHARP)[abs];
  }).join(" ");

  let head, sub;
  if(exact){
    head = (exact.id === m.id) ? "＝ 原调式（没有改动）" : exact.cn;
    sub = `${exact.n} · ${exact.origin.cn}${exact.rot ? " 第 " + exact.rot + " 旋法" : ""}`;
  } else {
    const near = MODES.map(x => ({x, d: distance(fake, x).score})).sort((p, q) => p.d - q.d)[0];
    head = "未收录的音阶";
    sub = `最接近：${near.x.cn}（距离 ${near.d.toFixed(1)}）`;
  }

  $("#morphRes").innerHTML = `<h4>变形结果</h4>
    <div class="big">${head}</div>
    <span class="mono">${sub}</span>
    <p class="mono" style="color:var(--accent)">${degStr}</p>
    <p>主和弦 ${degName(t, 0, 0)}${tc.sym || "大三"}</p>
    <p style="margin-top:10px"><button class="ghost" id="btnMorphPlay">▶ 试听变形后的音阶</button></p>`;

  $("#btnMorphPlay").onclick = () => {
    /* 音阶 + 主和弦一份计划一次排上，分两次 playEvents 会把音阶掐掉 */
    const o = withTune({});
    playEvents(planScale(fake, t, Object.assign({}, o, {pcs}))
      .concat(planDegree(fake, 0, t, Object.assign({}, o, {when: 2.1, dur: 1.0}))), o.a4);
  };
}

function morphReset(){
  const m = byId(state.A);
  morph.off = morphResetOff(m.pcs.length);
  renderMorph();
  renderAll();
}

uiRegister("morph", renderMorph);
