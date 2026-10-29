/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4i. MIDI 导出 ---------- */

function dlMidi(bytes, filename){
  const blob = new Blob([bytes], {type:"audio/midi"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function midiScaleNotes(m, t){
  const out = []; let prev = -1;
  const b = 60 + state.oct*12;
  m.pcs.forEach((p,i) => {
    let midi = b + ((t.pc + p) % 12);
    while(midi <= prev) midi += 12;
    prev = midi;
    out.push({t: i*TPQ, d: Math.round(TPQ*0.92), m: midi, v: 92});
  });
  let top = b + ((t.pc + 12) % 12);
  while(top <= prev) top += 12;
  out.push({t: m.pcs.length*TPQ, d: TPQ*2, m: top, v: 99});
  return out;
}

function midiChordNotes(m, t, offset){
  const out = [], off = offset || 0;
  for(let i=0;i<m.pcs.length;i++){
    const v = chordVoicing(m, i);
    const b = 48 + state.oct*12;
    const root = b + ((t.pc + m.pcs[i]) % 12);
    v.off.forEach(o => {
      out.push({t: off + i*2*TPQ, d: Math.round(TPQ*1.9), m: root + o, v: 88});
    });
  }
  return out;
}

function curTonicName(){ const t = tonicObj(); return noteName(t.li, t.acc); }
function curBpm(){ const v = +($("#midiBpm").value || 96); return Math.max(40, Math.min(240, v || 96)); }

$("#btnMidiScale").onclick = () => {
  const m = byId(state.A), t = tonicObj();
  dlMidi(buildMidi(midiScaleNotes(m,t), curBpm(), `${m.n} scale`), `${m.cn}-${curTonicName()}-音阶.mid`);
};
$("#btnMidiChords").onclick = () => {
  const m = byId(state.A), t = tonicObj();
  dlMidi(buildMidi(midiChordNotes(m,t,0), curBpm(), `${m.n} chords`), `${m.cn}-${curTonicName()}-和弦.mid`);
};
$("#btnMidiAll").onclick = () => {
  const m = byId(state.A), t = tonicObj();
  const notes = midiScaleNotes(m,t).concat(midiChordNotes(m,t, 9*TPQ));
  dlMidi(buildMidi(notes, curBpm(), `${m.n} full`), `${m.cn}-${curTonicName()}-音阶加和弦.mid`);
};

function sName(m, t, i){
  const sp = spell(m, t);
  return sp[i] ? sp[i].name : "";
}

function renderMidiHint(){
  const m = byId(state.A), t = tonicObj();
  const el = $("#midiHint");
  if(!el) return;
  const n = m.pcs.length;
  const hept = n === 7;
  const degs = m.pcs.map((p, i) => hept ? accStr(p - IONIAN[i]) + (i + 1) : sName(m, t, i));
  el.innerHTML = `当前：<b style="color:var(--txt)">${m.cn}</b> · 主音 ${curTonicName()}，`
    + `音阶 <span class="mono">${degs.join(" ")}</span>。`
    + `导出的就是这一份：音阶 ${n} 音 + 高八度主音（共 ${n + 1} 拍），接着 ${n} 个和弦各 2 拍，`
    + `全部在通道 1、大钢琴音色，拖进 Cubase 直接换音色就行。`;
}

uiRegister("midiHint", renderMidiHint);
