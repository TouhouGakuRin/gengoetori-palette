/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 标准 MIDI 文件（format 0）编码 */

const TPQ = 480;

function vlq(n){ const o = [n & 0x7f]; n >>= 7; while(n){ o.push((n & 0x7f) | 0x80); n >>= 7; } return o.reverse(); }

function buildMidi(notes, bpm, name){
  const evs = [];
  for(const n of notes){
    evs.push({t: n.t, k: 1, b: [0x90, n.m, n.v || 96]});
    evs.push({t: n.t + n.d, k: 0, b: [0x80, n.m, 0]});
  }
  evs.sort((a,b) => a.t - b.t || a.k - b.k);
  const trk = [];
  const us = Math.round(60000000 / bpm);
  trk.push(0x00, 0xFF, 0x51, 0x03, (us>>16)&255, (us>>8)&255, us&255);
  const nm = new TextEncoder().encode(name);
  // 轨道名长度是 VLQ：中文名按 UTF-8 往往超过 127 字节，直接 & 0x7f 会把长度截断成错数
  trk.push(0x00, 0xFF, 0x03, ...vlq(nm.length), ...nm);
  trk.push(0x00, 0xC0, 0x00);
  let last = 0;
  for(const e of evs){ trk.push(...vlq(e.t - last), ...e.b); last = e.t; }
  trk.push(0x00, 0xFF, 0x2F, 0x00);
  const L = trk.length;
  const head = [0x4D,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1, (TPQ>>8)&255, TPQ&255];
  const th = [0x4D,0x54,0x72,0x6B, (L>>24)&255, (L>>16)&255, (L>>8)&255, L&255];
  return new Uint8Array([...head, ...th, ...trk]);
}
