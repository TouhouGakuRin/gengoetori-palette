/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 音频引擎
   分两层：
     1) plan* —— 纯函数，只算「第几毫秒弹哪个音」的清单（可测）
     2) tone / playEvents —— 薄壳，真的碰 WebAudio
   A4 与八度都是显式参数，不在纯函数里读全局。 */

const A4_DEFAULT = 440;

// 音高 → 频率：十二平均律，f = A4 × 2^((m − 69) / 12)
function freqOf(midi, a4){
  const ref = (a4 === undefined || a4 === null)
    ? (typeof state !== "undefined" && state.a4 ? state.a4 : A4_DEFAULT)
    : a4;
  return ref * Math.pow(2, (midi - 69) / 12);
}

/* 纯律：相对主音的频率比（5-limit），下标是「离主音几个半音」。
   主音本身永远是 1，所以换律只影响其余各级；这是听「三度差 14 音分」用的。 */
const JUST_RATIO = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

// 以 tonicPc 为主音的纯律频率（主音那个八度仍按十二平均律定，才和 drone 对得上）
function justFreq(midi, tonicPc, a4){
  const ref = (a4 === undefined || a4 === null) ? A4_DEFAULT : a4;
  const d = ((midi - tonicPc) % 12 + 12) % 12;
  const rootMidi = midi - d;
  return ref * Math.pow(2, (rootMidi - 69) / 12) * JUST_RATIO[d];
}

// 这一级比平均律高（正）或低（负）多少音分
function justCents(pc){
  const d = ((pc % 12) + 12) % 12;
  return 1200 * Math.log2(JUST_RATIO[d] / Math.pow(2, d / 12));
}

// 音阶：七级上行 + 高八度主音，每个音自动往上借八度保证严格递增
function planScale(mode, tonic, o){
  o = o || {};
  const pcs = o.pcs || mode.pcs;
  const base = 48 + (o.oct || 0) * 12;
  const ev = [];
  let when = o.when || 0, prev = -1;
  for(let i = 0; i < pcs.length; i++){
    let midi = base + ((tonic.pc + pcs[i]) % 12);
    while(midi <= prev) midi += 12;
    prev = midi;
    ev.push({ midi, at: when, dur: o.dur || 0.34, vel: o.vel || 0.95 });
    when += o.gap || 0.23;
  }
  let top = base + ((tonic.pc + 12) % 12);
  while(top <= prev) top += 12;
  ev.push({ midi: top, at: when, dur: o.topDur || 0.62, vel: 1 });
  return ev;
}

// 一个和弦：rootAbs / tonesAbs 都是绝对音高类（0 = C），和弦音抬到根音之上
function planChord(rootAbs, tonesAbs, o){
  o = o || {};
  const base = (o.base === undefined ? 48 : o.base) + (o.oct || 0) * 12;
  const root = base + rootAbs;
  const ms = tonesAbs.map(t => {
    let m = base + t;
    while(m < root) m += 12;
    return m;
  });
  const gap = o.gap === undefined ? 0.075 : o.gap;
  const at = o.when || 0;
  return ms.map((m, i) => ({
    midi: m,
    at: at + (o.arp ? i * gap : 0),
    dur: o.dur || 0.95,
    vel: o.vel || 0.9,
  }));
}

// 调式的第 idx 级：voiced=true 时按当前排列/转位（chordVoicing）发声，否则按密集叠三度
function planDegree(mode, idx, tonic, o){
  o = o || {};
  if(o.voiced){
    const v = chordVoicing(mode, idx, { inv: o.inv, spread: o.spread, voicing: o.voicing, size: o.size });
    const root = 48 + (o.oct || 0) * 12 + ((tonic.pc + mode.pcs[idx]) % 12);
    const gap = o.gap === undefined ? 0.075 : o.gap;
    const at = o.when || 0;
    return v.off.map((off, k) => ({
      midi: root + off,
      at: at + (o.arp ? k * gap : 0),
      dur: o.dur || 0.95,
      vel: o.vel || 0.9,
    }));
  }
  const tones = chordOf(mode, idx, o.voicing, o.size).tones.map(t => (tonic.pc + t) % 12);
  const rootAbs = (tonic.pc + mode.pcs[idx]) % 12;
  return planChord(rootAbs, tones, o);
}

/* ---------- 薄壳 ---------- */

let AUDIO_CTX = null, AUDIO_MASTER = null;
// 当前用哪套律制发声：et（十二平均律，默认）/ just（纯律，以 TUNING_ROOT 为主音）
let AUDIO_TUNING = "et", TUNING_ROOT = 0;
// 当前音色（见 TIMBRES），由设置面板改
let AUDIO_TIMBRE = "tri";

function setTuning(kind, tonicPc){
  AUDIO_TUNING = kind === "just" ? "just" : "et";
  if(tonicPc !== undefined && tonicPc !== null) TUNING_ROOT = ((tonicPc % 12) + 12) % 12;
}

/* 音色表：每种音色 = 一组正弦/三角分音 + 一条包络。
   oscs 里每项是 [频率倍数, 相对幅度, 波形]；hold 是衰减后剩下的比例（0 = 完全敲击声）。 */
const TIMBRES = {
  tri: { cn: "三角波", en: "Triangle", hint: "原来的声音：三角波 + 一点二次泛音，最中性",
    oscs: [[1, 1, "triangle"], [2.003, 0.28, "sine"]],
    attack: 0.012, decay: 0.22, hold: 0.40, cutoff: 2800, gain: 0.16, release: 0.06 },

  piano: { cn: "钢琴", en: "Piano", hint: "敲击感：分音多、起音快、高音衰减更短",
    oscs: [[1, 1, "triangle"], [2, 0.42, "sine"], [3, 0.20, "sine"], [4, 0.11, "sine"],
      [5, 0.055, "sine"], [6, 0.028, "sine"]],
    attack: 0.004, decay: 0.55, hold: 0.22, cutoff: 5200, gain: 0.15, release: 0.10,
    keyScale: true },

  ep: { cn: "电钢琴", en: "E-Piano", hint: "软起音、长衰减，带一点四倍频的「铃」",
    oscs: [[1, 1, "sine"], [2, 0.20, "sine"], [4, 0.13, "sine"]],
    attack: 0.006, decay: 0.85, hold: 0.30, cutoff: 4200, gain: 0.17, release: 0.12,
    keyScale: true },

  organ: { cn: "管风琴", en: "Organ", hint: "纯分音叠加、没有起音噪，适合听和声",
    oscs: [[1, 1, "sine"], [2, 0.50, "sine"], [3, 0.24, "sine"], [4, 0.11, "sine"]],
    attack: 0.030, decay: 0.020, hold: 0.88, cutoff: 6000, gain: 0.13, release: 0.12 },

  sine: { cn: "正弦", en: "Sine", hint: "只有一个正弦，最干净，练耳对音准最准",
    oscs: [[1, 1, "sine"]],
    attack: 0.010, decay: 0.015, hold: 0.90, cutoff: 9000, gain: 0.17, release: 0.08 },
};

function timbreOf(kind){ return TIMBRES[kind] || TIMBRES.tri; }
function setTimbre(kind){ AUDIO_TIMBRE = TIMBRES[kind] ? kind : "tri"; }
function timbreName(kind){ return timbreOf(kind).cn; }

function freqFor(midi, a4){
  return AUDIO_TUNING === "just" ? justFreq(midi, TUNING_ROOT, a4) : freqOf(midi, a4);
}

function audio(){
  if(!AUDIO_CTX){
    const AC = window.AudioContext || window.webkitAudioContext;
    AUDIO_CTX = new AC();
    AUDIO_MASTER = AUDIO_CTX.createGain();
    AUDIO_MASTER.gain.value = 0.85;
    AUDIO_MASTER.connect(AUDIO_CTX.destination);
  }
  if(AUDIO_CTX.state === "suspended") AUDIO_CTX.resume();
  return AUDIO_CTX;
}

/* ---------- 复音总线：新声音一响，上一批立刻让路 ----------
   以前每次播放都是「排进时间线就不管了」，连点几下会叠成一团。
   现在所有发声都登记到 VOICES，任何一次「新的播放」先把它整批淡掉。 */

let VOICES = [];

function pruneVoices(){
  if(!AUDIO_CTX) return;
  const now = AUDIO_CTX.currentTime;
  VOICES = VOICES.filter(v => v.end > now);
}

// 停掉当前所有在响的音（fade 秒内淡出，避免「咔」的爆音）
function stopVoices(fade){
  if(!AUDIO_CTX) return;
  if(!VOICES.length) return;
  const now = AUDIO_CTX.currentTime;
  const f = fade === undefined ? 0.04 : fade;
  for(const v of VOICES){
    try{
      v.g.gain.cancelScheduledValues(now);
      v.g.gain.setValueAtTime(Math.max(0.0002, v.g.gain.value), now);
      v.g.gain.exponentialRampToValueAtTime(0.0001, now + f);
      v.oscs.forEach(o => { try{ o.stop(now + f + 0.02); }catch(e){ /* 已停过 */ } });
    }catch(e){ /* 这个节点已经没了，跳过 */ }
  }
  VOICES = [];
}

/* 单个音：按当前音色叠分音 → 低通 → 包络。
   keyScale 的音色（钢琴、电钢）在高音区收得快一点，听上去才像真的琴。 */
function toneAt(midi, when, dur, vel, a4){
  const ctx = audio();
  vel = vel === undefined ? 1 : vel;
  const T = timbreOf(AUDIO_TIMBRE);
  const t = ctx.currentTime + (when || 0);
  const f = freqFor(midi, a4);

  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = Math.min(12000, T.cutoff + f * 0.8);
  const g = ctx.createGain();
  filt.connect(g); g.connect(AUDIO_MASTER);

  const oscs = T.oscs.map(([mult, amp, type]) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = type;
    o.frequency.value = f * mult;
    og.gain.value = amp;
    o.connect(og); og.connect(filt);
    return o;
  });

  // 高音按频率缩短衰减（琴弦越短衰减越快）
  const k = T.keyScale ? Math.max(0.35, Math.min(1.6, 440 / f)) : 1;
  const peak = T.gain * vel;
  const len = Math.max(0.14, dur);
  const end = t + len;
  const dec = Math.min(T.decay * k, len * 0.55);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + Math.min(T.attack, len * 0.2));
  const decayEnd = t + Math.min(T.attack, len * 0.2) + dec;
  // 衰减终点不越过音符结尾，免得「先压到 hold 再被 release 拉长」
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * T.hold), Math.min(decayEnd, end - 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  oscs.forEach(o => { o.start(t); o.stop(end + 0.04); });
  pruneVoices();
  VOICES.push({ midi: midi, g: g, oscs: oscs, filt: filt, end: end + 0.08 });
}

// 兼容老调用点：tone(音高, 延后秒数, 时值, 力度)
function tone(midi, when, dur, vel){
  const a4 = (typeof state !== "undefined" && state.a4) ? state.a4 : A4_DEFAULT;
  toneAt(midi, when, dur, vel, a4);
}

// 把一份计划一次性排进时间线（先让上一批让路）
function playEvents(events, a4){
  if(!events || !events.length) return;
  audio();
  stopVoices();
  events.forEach(e => toneAt(e.midi, e.at, e.dur, e.vel, a4));
}

/* ---------- 持续主音（drone）：垫在下面当调性锚点 ---------- */

let DRONE = null;

// 主音落在哪：C3 附近，不跟着八度开关跑（否则低到听不清）
function droneMidi(tonicPc){
  const pc = tonicPc === undefined || tonicPc === null
    ? (typeof tonicObj === "function" ? tonicObj().pc : 0)
    : tonicPc;
  return 48 + ((pc % 12) + 12) % 12;
}

function droneOn(tonicPc, a4){
  const midi = droneMidi(tonicPc);
  if(DRONE && DRONE.midi === midi) return;
  droneOff();
  const ctx = audio();
  const f = freqOf(midi, a4);
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass"; filt.frequency.value = 1100;
  const g = ctx.createGain();
  const oscs = [];
  // 稍微失谐的双主音 + 弱八度 + 极弱十二度：听上去像风箱，不像合成器
  [[f, "sine", -4, 1], [f, "sine", 4, 1], [f * 2, "sine", 2, 0.34], [f * 3, "sine", -2, 0.12]]
    .forEach(([fr, type, cents, amp]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type;
      o.frequency.value = fr * Math.pow(2, cents / 1200);
      og.gain.value = amp;
      o.connect(og); og.connect(filt); o.start(); oscs.push(o);
    });
  filt.connect(g); g.connect(AUDIO_MASTER);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.085, t + 0.7);
  DRONE = {midi: midi, g: g, oscs: oscs, filt: filt};
}

function droneOff(){
  if(!DRONE) return;
  const ctx = audio(), d = DRONE;
  DRONE = null;
  const t = ctx.currentTime;
  d.g.gain.cancelScheduledValues(t);
  d.g.gain.setValueAtTime(Math.max(0.0001, d.g.gain.value), t);
  d.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  setTimeout(() => { d.oscs.forEach(o => { try{ o.stop(); }catch(e){} }); }, 700);
}

function droneIsOn(){ return !!DRONE; }

/* ---------- 应用层薄壳：取当前设置 → 算计划 → 发声 ---------- */
function withTune(opts){
  const o = Object.assign({}, opts || {});
  if(o.oct === undefined) o.oct = state.oct;
  if(o.a4 === undefined) o.a4 = state.a4;
  return o;
}
function playChord(rootAbs, tonesAbs, opts){
  const o = withTune(opts);
  playEvents(planChord(rootAbs, tonesAbs, o), o.a4);
}
function playDegree(mode, idx, tonic, opts){
  const o = withTune(opts);
  playEvents(planDegree(mode, idx, tonic, o), o.a4);
}

function playScale(m, t, opts){
  const o = withTune(opts);
  playEvents(planScale(m, t, o), o.a4);
}
