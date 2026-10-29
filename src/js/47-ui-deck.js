/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4g. 进行台（v16：槽位任选音阶 / 级数 / 音数，并带真时值与拍号） ---------- */

// 槽位不再只存“级数”，而是一个和弦配方：
// { m: 音阶 id 或 null(跟随当前), d: 级数, n: 音数, inv: 转位, spread: 排列,
//   beats: 占几拍(1–8，默认 2), rest: true 表示这一格是休止 }
// n 省略 = 跟随当前三/七和弦设置。音数 2–7 分别是：二音 / 三和弦 / 七和弦 / 九和弦 / 十一和弦 / 十三和弦。
const deck = {slots: [null,null,null,null,null,null,null,null], sel: -1, timer: null, cur: -1,
  playing: false, satb: false, four: false, meter: "4/4", oct: 0, savedTone: null};
const DECK_SATB_KEY = "mlab-satb";
const DECK_FOUR_KEY = "mlab-deck-four";
const DECK_METER_KEY = "mlab-deck-meter";
const DECK_OCT_KEY = "mlab-deck-oct";
const DECK_OCT_MIN = -2, DECK_OCT_MAX = 2;
const DECK_N = 8;
const DECK_KEY = "mlab-deck";
const DECK_DUR_CHOICES = [1, 2, 3, 4, 6, 8];
const DUR_LABEL = {1: "四分", 2: "二分", 3: "附点二分", 4: "全音符"};
const durationShort = b => DUR_LABEL[b] || (b + " 拍");

function slotDur(s){
  const v = s && s.beats ? Math.round(s.beats) : 2;
  return Math.max(1, Math.min(8, v));
}
function deckMeter(){ return meterOf(deck.meter); }

/* 休止槽位在卡片上的名字（3 拍会写成两个休止，所以只有 1/2/4 有专名） */
const REST_CN = {1: "四分休止", 2: "二分休止", 4: "全休止", 8: "倍全休止"};
function restName(d){ return REST_CN[d] || (d + " 拍休止"); }

/* 整条进行的时间轴：每个槽位从第几拍开始、占几拍（休止也占时间） */
function deckTimeline(){
  const items = [];
  let at = 0;
  deck.slots.forEach((s, i) => {
    if(!s) return;
    const b = slotDur(s);
    items.push({i: i, at: at, beats: b, rest: !!s.rest});
    at += b;
  });
  return {items: items, total: at, bars: Math.max(1, Math.ceil(at / barBeats(deckMeter())))};
}

function deckSeq(){ return deck.slots.filter(x => x !== null && x !== undefined); }
function slotMode(s){ return s.m ? (byId(s.m) || byId(state.A)) : byId(state.A); }
function slotChord(s){
  const m = slotMode(s);
  const n = s.n || chordSize(m, state.voicing);
  return {m, c: chordOf(m, s.d, state.voicing, n), n};
}

// 这一槽的详细声部：音阶、音数、转位、排列、和弦
function slotVoicing(s){
  const m = slotMode(s);
  const n = s.n || chordSize(m, state.voicing);
  const v = chordVoicing(m, s.d, {voicing: "7", size: n, inv: s.inv || 0, spread: s.spread || "close"});
  return {m, n, v, c: chordOf(m, s.d, "7", n)};
}

// 整条进行 → 每槽一组 midi。四部和声时走 satbSequence（会避开平行五八）
function deckMidis(){
  /* 根音必须带上主音：base = 60 + 主音音级 + 八度偏移，
     否则 C 以外的调式整体偏移（Eb 上的 I 级会被画成 C）。 */
  const t = tonicObj();
  /* 八度：界面上的全局八度 + 进行台自己的八度开关，最后整体加上去；
     自动找位置（sh）只按「不带八度」的标准位置算，否则开关会被自动居中吃掉。 */
  const oct = ((state.oct || 0) + (deck.oct || 0)) * 12, base = 60 + t.pc;
  const specs = deck.slots.map(s => {
    if(!s) return null;
    if(s.rest) return null;          // 休止槽位不发音（时间轴另算）
    /* 借来的和弦 / 副属和弦：音高来自它自己带的音级集合，不经过音阶级数 */
    if(s.ex){
      const ex = s.ex;
      return {ex: ex, offs: ex.ivs, tonesAbs: ex.tones,
        bassPc: ((ex.root % 12) + 12) % 12, r0: base + ex.root};
    }
    const x = slotVoicing(s);
    return Object.assign(x, {
      offs: x.v.off,
      tonesAbs: x.c.tones.map(pc => ((t.pc + pc) % 12 + 12) % 12),
      bassPc: ((t.pc + x.m.pcs[x.v.degs[0]]) % 12 + 12) % 12,
      r0: base + x.m.pcs[s.d],
      rootPc: ((t.pc + x.m.pcs[s.d]) % 12 + 12) % 12,
    });
  });
  if(deck.satb){
    const vs = satbSequence(specs.map(x => x ? {tones: x.tonesAbs, bassPc: x.bassPc} : null),
      {tonic: ((t.pc % 12) + 12) % 12});
    return specs.map((x, i) => (x && vs[i]) ? [vs[i].S, vs[i].A, vs[i].T, vs[i].B].map(v => v + oct) : null);
  }
  /* 整条进行只挪一次八度：以前每个和弦各自按「最高+最低音的中点在 G4」挪，
     Eb 上的 I 与 IV 会被挪到相差八度的地方，听着就是音高乱跳。 */
  const raw = specs.map(x => x ? x.offs.map(off => x.r0 + off) : null);
  const all = raw.filter(Boolean).flat();
  const sh = all.length ? Math.round((67 - (Math.min(...all) + Math.max(...all)) / 2) / 12) * 12 : 0;
  return raw.map(ms => ms ? ms.map(v => v + sh + oct) : null);
}

// midi → 五线谱音符（用这个槽自己音阶的拼写）
function noteOfMidi(midi, sp){
  const pc = ((midi % 12) + 12) % 12;
  let k = sp.find(x => ((x.abs % 12) + 12) % 12 === pc);
  if(!k) k = {li: SHARP_ORDER.indexOf(CHROM_SHARP[pc]) >= 0 ? SHARP_ORDER.indexOf(CHROM_SHARP[pc]) : 0, nacc: 0};
  const oct = octaveFor(k.li, midi);
  return {step: k.li + 7*oct, li: k.li, nacc: k.nacc};
}
function shortModeName(m){
  return String(m.cn).replace(/[（(].*$/, "").trim().slice(0, 8);
}
function deckFollows(){ return deck.sel >= 0 && deck.slots[deck.sel]; }

/* 从「借来的和弦」卡片塞进进行台：放第一个空位，没有空位就接在最后一个后面 */
function deckAddEx(x){
  let at = deck.slots.findIndex(s => !s);
  if(at < 0){
    let last = -1;
    deck.slots.forEach((s, i) => { if(s) last = i; });
    at = Math.min(DECK_N - 1, last + 1);
  }
  const prev = deck.slots.filter(Boolean).pop();
  deck.slots[at] = {m: null, d: 0, n: x.tones.length, inv: 0, spread: "close",
    beats: (prev && prev.beats) || 4, rest: false,
    ex: {root: x.root, tones: x.tones.slice(), ivs: x.ivs.slice(), names: x.names.slice(),
      symbol: x.symbol, roman: x.roman, kind: x.kind}};
  deck.sel = at;
  saveDeck(); renderDeck();
  if(typeof toast === "function") toast(`已加到第 ${at + 1} 格：${x.roman} ${x.symbol}`);
}

function saveDeck(){
  // v2 信封：顺手记下当时的主音。级数是相对主音的，主音对不上整条进行就会移调。
  try{ localStorage.setItem(DECK_KEY, JSON.stringify({v: 2, t: state.tone, s: deck.slots})); }catch(_){}
  try{ localStorage.setItem(DECK_METER_KEY, deck.meter); }catch(_){}
  try{ localStorage.setItem(DECK_OCT_KEY, String(deck.oct || 0)); }catch(_){}
}
function loadDeck(){
  try{ deck.satb = localStorage.getItem(DECK_SATB_KEY) === "1"; }catch(_){}
  try{ deck.four = localStorage.getItem(DECK_FOUR_KEY) === "1"; }catch(_){}
  try{
    const mt = localStorage.getItem(DECK_METER_KEY);
    if(mt && METERS.some(m => m.id === mt)) deck.meter = mt;
  }catch(_){}
  try{
    const vo = parseInt(localStorage.getItem(DECK_OCT_KEY), 10);
    if(isFinite(vo)) deck.oct = Math.max(DECK_OCT_MIN, Math.min(DECK_OCT_MAX, vo));
  }catch(_){}
  try{
    const raw = localStorage.getItem(DECK_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    // 老格式是裸数组；v2 是 {v,t,s}，多存了保存时的主音
    const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.s) ? parsed.s : null);
    if(!arr) return;
    deck.savedTone = (parsed && !Array.isArray(parsed) && typeof parsed.t === "number")
      ? ((parsed.t | 0) % 12 + 12) % 12 : null;
    {
      deck.slots = new Array(DECK_N).fill(null);
      arr.slice(0, DECK_N).forEach((s, i) => {
        if(s && s.ex && Array.isArray(s.ex.tones) && s.ex.tones.length){
          /* 借来的和弦 / 副属和弦：带上它自己的根音、音级与拼写 */
          const ex = s.ex;
          deck.slots[i] = {m: null, d: 0, n: ex.tones.length, inv: 0, spread: "close",
            beats: s.beats ? Math.max(1, Math.min(8, s.beats|0)) : null, rest: false,
            ex: {root: ((ex.root|0) % 12 + 12) % 12, tones: ex.tones.map(p => ((p|0) % 12 + 12) % 12),
              ivs: Array.isArray(ex.ivs) ? ex.ivs.slice(0, 8) : [],
              names: Array.isArray(ex.names) ? ex.names.slice(0, 8) : [],
              symbol: String(ex.symbol || ""), roman: String(ex.roman || ""),
              kind: ex.kind === "secondary" ? "secondary" : "borrow"}};
          return;
        }
        if(s && typeof s.d === "number" && s.d >= 0 && s.d < 12){
          deck.slots[i] = {m: s.m || null, d: s.d|0, n: s.n ? Math.max(2, Math.min(CHORD_MAX, s.n|0)) : null,
            inv: s.inv ? Math.max(0, Math.min(9, s.inv|0)) : 0, spread: s.spread === "open" ? "open" : "close",
            beats: s.beats ? Math.max(1, Math.min(8, s.beats|0)) : null, rest: !!s.rest, ex: null};
        }
      });
    }
  }catch(_){}
}

function fillDeckMeter(){
  const el = document.getElementById("deckMeter");
  if(!el) return;
  if(!el.dataset.wired){
    el.dataset.wired = "1";
    el.addEventListener("change", () => {
      deck.meter = el.value;
      saveDeck(); renderDeck();
    });
  }
  el.innerHTML = METERS.map(m =>
    `<option value="${m.id}"${m.id === deck.meter ? " selected" : ""}>${m.cn}</option>`).join("");
}

/* 进行台的八度开关：整条进行一起上下挪，不改变和弦级数 */
function fillDeckOct(){
  const val = document.getElementById("deckOctVal");
  const down = document.getElementById("deckOctDown");
  const up = document.getElementById("deckOctUp");
  const cur = deck.oct || 0;
  if(val) val.textContent = cur > 0 ? "+" + cur : String(cur);
  if(down) down.disabled = cur <= DECK_OCT_MIN;
  if(up) up.disabled = cur >= DECK_OCT_MAX;
}

function setDeckOct(v){
  const next = Math.max(DECK_OCT_MIN, Math.min(DECK_OCT_MAX, v));
  if(next === (deck.oct || 0)) return;
  deck.oct = next;
  saveDeck();
  renderDeck();          // 工具栏数字、提示行、谱面都要跟着变
}

function renderDeck(){
  const t = tonicObj();
  fillDeckMeter();
  fillDeckOct();
  let h = "";
  for(let i=0;i<DECK_N;i++){
    const s = deck.slots[i];
    if(!s){
      h += `<div class="slot${deck.sel === i ? " sel" : ""}" data-i="${i}">空</div>`;
      continue;
    }
    const dur = slotDur(s), sel = deck.sel === i ? " sel" : "";
    if(s.rest){
      h += `<div class="slot filled rest${sel}" draggable="true" data-i="${i}">`
        + `<span class="r">休止</span><span class="c">${dur} 拍</span>`
        + `<span class="tag">${restName(dur)}</span></div>`;
      continue;
    }
    if(s.ex){
      h += `<div class="slot filled ex${sel}" draggable="true" data-i="${i}">`
        + `<span class="r">${s.ex.roman}</span><span class="c">${s.ex.symbol}</span>`
        + `<span class="tag">${s.ex.kind === "secondary" ? "副属" : "借用"} · ${dur}拍</span></div>`;
      continue;
    }
    const m = slotMode(s), sp = spell(m, t), {c, n} = slotChord(s);
    const own = !s.m || s.m === state.A;
    h += `<div class="slot filled${sel}" draggable="true" data-i="${i}">`
      + `<span class="r">${sp[s.d].roman}</span><span class="c">${sp[s.d].name}${c.sym}</span>`
      + `<span class="tag${own ? " dim" : ""}">${own ? n + " 音" : shortModeName(m) + " · " + n + " 音"} · ${dur}拍</span></div>`;
  }
  $("#deck").innerHTML = h;

  const m = byId(state.A), sp = spell(m, t);
  $("#deckChips").innerHTML = sp.map((s,i) => {
    const c = chordOf(m, i);
    return `<div class="chip" draggable="true" data-deg="${i}"><b>${s.roman}</b> ${s.name}${c.sym}</div>`;
  }).join("");

  renderDeckHint();
  renderDeckEditor();
  renderDeckStaff();
  wireDeck();
}

/* 四声部体检：把「槽位顺序」和「违规对」一次算出来，提示行和谱面标记共用 */
function deckSatbAudit(){
  const t = tonicObj();
  const seq = deck.slots.map((s, i) => s ? i : -1).filter(i => i >= 0);
  const midis = deckMidis();
  const vs = [], tones = [], sevens = [];
  for(const i of seq){
    const a = midis[i], s = deck.slots[i];
    vs.push((a && a.length >= 4) ? {S: a[0], A: a[1], T: a[2], B: a[3]} : null);
    let tn = null;
    if(s && !s.rest){
      tn = s.ex ? s.ex.tones.slice()
        : slotVoicing(s).c.tones.map(pc => ((t.pc + pc) % 12 + 12) % 12);
    }
    tones.push(tn);
    sevens.push(tn ? seventhOf(tn) : null);
  }
  const bad = satbViolations(vs, {tonic: t.pc, sevenths: sevens, tones: tones});
  return {seq: seq, bad: bad};
}

function renderDeckHint(){
  const t = tonicObj();
  const seq = deck.slots.map((s,i) => s ? i : -1).filter(i => i >= 0);
  if(!seq.length){
    $("#deckHint").innerHTML = "点下面的和弦卡补到空位，或拖动排序。点已填的槽位可以改它的来源音阶、级数、音数与时值（2–7 个音、1–8 拍）。";
    return;
  }
  const parts = seq.map(i => {
    const s = deck.slots[i], m = slotMode(s), sp = spell(m, t);
    if(s.rest) return `休止·${slotDur(s)}拍`;
    if(s.ex) return s.ex.roman;
    const tag = (s.m && s.m !== state.A) ? `<i>${m.cn.slice(0,4)}</i>` : "";
    return `${tag} ${sp[s.d].roman}`;
  });
  let warn = "";
  if(deck.satb){
    const aud = deckSatbAudit();
    const bad = aud.bad;
    if(bad.length){
      const cnt = {};
      bad.forEach(x => { cnt[x.kind] = (cnt[x.kind] || 0) + 1; });
      const head = Object.keys(cnt).map(k => `${k}×${cnt[k]}`).join("、");
      warn = `<br><span class="satbnote">⚠ ${bad.length} 处：${head}`
        + `<br>` + bad.slice(0, 6).map(x => `${x.from + 1}→${x.to + 1} ${x.kind}（${x.voices}·${x.detail}）`).join("；")
        + (bad.length > 6 ? ` …另 ${bad.length - 6} 处` : "") + `</span>`;
    }else{
      warn = `<br><span class="satbnote" style="color:#7fd18a">四声部：没有查到平行/隐伏五八、导音与七音问题</span>`;
    }
  }
  const tl = deckTimeline();
  const octTxt = (deck.oct || 0) === 0 ? "" :
    ` · <span class="deckmeter">八度 ${(deck.oct > 0 ? "+" : "") + deck.oct}</span>`;
  $("#deckHint").innerHTML = `当前进行：${parts.join(" – ")}（${seq.length} / ${DECK_N}）。`
    + `<span class="deckmeter">${deckMeter().id} · 共 ${tl.total} 拍 / ${tl.bars} 小节</span>`
    + octTxt
    + ` 拖动槽位换顺序，双击清空，单击选中后可在上面细调。` + warn;
}

/* ---------- 槽位编辑器 ---------- */

function renderDeckEditor(){
  const box = document.getElementById("deckEdit");
  if(!box) return;
  const s = deckFollows() ? deck.slots[deck.sel] : null;
  if(!s){ box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const t = tonicObj();
  const m = slotMode(s), sp = spell(m, t);
  const cap = sizeCap(m);
  const curN = s.n || chordSize(m, state.voicing);

  // 借来的和弦：只留「时值 + 删除」，别的控件对它没意义（exmode 由 CSS 收起）
  if(s.ex){
    box.classList.add("exmode");
    const nm = document.getElementById("deExName");
    if(nm) nm.textContent = s.ex.roman + " · " + s.ex.symbol;
    const durBox = document.getElementById("deExDur");
    if(durBox){
      durBox.innerHTML = DECK_DUR_CHOICES.map(b =>
        `<button data-exdur="${b}" class="${b === slotDur(s) ? "on" : ""}">${durationShort(b)}</button>`).join("");
      durBox.querySelectorAll("[data-exdur]").forEach(el => {
        el.onclick = () => {
          s.beats = parseInt(el.dataset.exdur, 10);
          saveDeck(); renderDeck();
        };
      });
    }
    const del = document.getElementById("deExDel");
    if(del) del.onclick = () => {
      deck.slots[deck.sel] = null;
      deck.sel = -1; saveDeck(); renderDeck();
    };
    return;
  }
  box.classList.remove("exmode");

  // 来源音阶：跟随当前 + 按来源分组（同名音阶在 optgroup 里按中文名排）
  const sel = document.getElementById("deMode");
  let opts = `<option value="">跟随当前音阶（${byId(state.A).cn.slice(0,8)}）</option>`;
  ORIGINS.forEach(o => {
    const list = MODES.filter(x => x.src === o.id);
    if(!list.length) return;
    opts += `<optgroup label="${o.cn}（${list.length}）">`;
    list.forEach(x => {
      const cw = {M:"大", m:"小", D:"属", A:"增"}[x.colorKey] || "";
      opts += `<option value="${x.id}"${s.m === x.id ? " selected" : ""}>${x.cn}${cw ? " · " + cw : ""}</option>`;
    });
    opts += `</optgroup>`;
  });
  sel.innerHTML = opts;

  // 级数
  document.getElementById("deDeg").innerHTML = sp.map((x, i) =>
    `<button data-deg="${i}" class="${i === s.d ? "on" : ""}">${x.roman} ${x.name}</button>`).join("");

  // 音数
  let sz = "";
  for(let n = 2; n <= cap; n++){
    sz += `<button data-size="${n}" class="${n === curN ? "on" : ""}">${sizeLabel(n)}</button>`;
  }
  document.getElementById("deSize").innerHTML = sz;

  // 排列
  const spd = s.spread || "close";
  document.getElementById("deSpread").innerHTML =
    ["close","open"].map(k => `<button data-spread="${k}" class="${k === spd ? "on" : ""}">${k === "close" ? "密集" : "开放"}</button>`).join("");

  // 转位
  const invMax = Math.min(3, curN - 1);
  let iv = "";
  for(let k = 0; k <= invMax; k++){
    iv += `<button data-inv="${k}" class="${k === (s.inv || 0) ? "on" : ""}">${k === 0 ? "原位" : ["一","二","三"][k-1] + "转"}</button>`;
  }
  document.getElementById("deInv").innerHTML = iv;

  // 时值（占几拍）：非七声/七声都一样，只是记谱会被小节线切开并补延音线
  const dur = slotDur(s);
  document.getElementById("deDur").innerHTML = DECK_DUR_CHOICES.map(d =>
    `<button data-dur="${d}" class="${d === dur ? "on" : ""}">${durationShort(d)}</button>`).join("");

  // 内容：和弦还是休止
  document.getElementById("deKind").innerHTML =
    `<button data-kind="chord" class="${s.rest ? "" : "on"}">和弦</button>`
    + `<button data-kind="rest" class="${s.rest ? "on" : ""}">休止</button>`;

  let at = 0;
  for(let i = 0; i < deck.sel; i++) if(deck.slots[i]) at += slotDur(deck.slots[i]);
  document.getElementById("deBars").innerHTML =
    `<span class="dim2">第 ${at + 1} 拍起 · ${durationLabel(dur)}</span>`;

  // 预览
  if(s.rest){
    document.getElementById("dePreview").innerHTML =
      `<b>休止</b> <span class="dim2">${durationLabel(dur)}</span>`;
    return;
  }
  const {c} = slotChord(s);
  /* 和弦音名要走「三度拼写 + 主音」这条正路：c.tones 是相对主音的音程，
     直接拿去查 sp 会落到 C 上的同名音（Eb 的 I 级会被写成 C E G B）。 */
  const rootAbs = sp[s.d].abs, li0 = sp[s.d].li, rootMidi = 60 + rootAbs;
  const cNotes = c.tones.map(pc => {
    const abs = ((t.pc + pc) % 12 + 12) % 12;
    const midi = rootMidi + ((abs - rootAbs + 12) % 12);
    const k = sp.find(x => ((x.abs % 12) + 12) % 12 === abs);
    const alt = k ? {step: 0, li: k.li, nacc: k.nacc} : null;
    const nt = pickSpelling(li0, rootMidi, midi, alt);
    return LETTERS[nt.li] + accStr(nt.nacc);
  }).join(" ");
  document.getElementById("dePreview").innerHTML =
    `<b>${sp[s.d].name}${c.sym}</b> <span class="dim2">${cNotes}</span>`;
}

/* ---------- 五线谱 ---------- */

function renderDeckStaff(){
  const el = document.getElementById('deckStaff');
  const wrap = document.getElementById('deckStaffWrap');
  if(!el || !wrap) return;
  /* 四声部有违规时把涉及的那几列在谱面上点出来（提示行里是文字，这里是位置） */
  const warn = {};
  if(deck.satb){
    const aud = deckSatbAudit();
    aud.bad.forEach(x => {
      if(aud.seq[x.from] !== undefined) warn[aud.seq[x.from]] = 1;
      if(aud.seq[x.to] !== undefined) warn[aud.seq[x.to]] = 1;
    });
  }
  const g = deckStaffGroups(warn);
  if(!g.tre.length){ el.innerHTML = ""; wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  /* 进行台一律钢琴大谱表：上行为右手，下行为左手；有拍号才画拍号与小节线。
     宽度按容器量：一行放不下就在小节线上折行（谱面不缩小，字才看得清）。
     四部和声可以切成四行谱（S/A/T/B 各一谱表，左侧直连谱号）。 */
  const K = 1.2;
  const avail = Math.max(320, (wrap.clientWidth || 900) - 6);
  const common = {slotW: 92, scale: K, keyNotes: modeKeyNotes(), meter: deckMeter()};
  let r;
  if(deck.satb && deck.four){
    /* 四行谱没有折行，宽了就按比例收 slotW，收不下再交给外层横向滚动 */
    r = drawStack([{clef: "treble", groups: g.S}, {clef: "treble", groups: g.A},
      {clef: "bass", groups: g.T}, {clef: "bass", groups: g.B}], common);
    for(let k = 0; k < 3 && r.W > avail; k++){
      common.slotW = Math.max(28, common.slotW * (avail / r.W) * 0.98);
      r = drawStack([{clef: "treble", groups: g.S}, {clef: "treble", groups: g.A},
        {clef: "bass", groups: g.T}, {clef: "bass", groups: g.B}], common);
    }
  } else {
    r = drawGrand(g.tre, g.bas, Object.assign({maxW: avail / K}, common));
  }
  el.innerHTML = r.markup;
  el.setAttribute("viewBox", `0 0 ${r.W} ${r.H}`);
  el.setAttribute("width", r.W);
  el.setAttribute("height", r.H);
}

function deckStaffGroups(warn){
  const t = tonicObj();
  const midis = deckMidis();
  const tre = [], bas = [];
  const SV = [], SA = [], ST = [], SB = [];
  const W = i => (warn && warn[i]) ? {warn: true} : {};

  deck.slots.forEach((s, i) => {
    if(!s) return;
    const dur = slotDur(s);
    /* 休止：两只手都空着，但时值要占住，后面的音才会被推到下一小节 */
    if(s.rest){
      tre.push(Object.assign({dur: dur, rest: true, notes: []}, W(i)));
      bas.push({dur: dur, rest: true, notes: []});
      return;
    }
    const ms = midis[i];
    if(!ms || !ms.length) return;
    let label, sym, notes;
    if(s.ex){
      /* 借来的和弦：拼写走它自己的根音（♭VII 是 Bb 不是 A#） */
      const ex = s.ex;
      const li0 = LETTERS.indexOf((ex.names && ex.names[0] ? ex.names[0] : "C")[0]);
      const rootMidi = 60 + ex.root;
      notes = ms.map(v => spellTone(li0, rootMidi, v));
      label = ex.roman;
      sym = ex.symbol;
    } else {
      const m = slotMode(s), sp = spell(m, t), x = slotVoicing(s);
      const li0 = sp[s.d].li, rootMidi = 60 + t.pc + m.pcs[s.d];
      notes = ms.map(v => {
        const pc = ((v % 12) + 12) % 12, k = sp.find(x => ((x.abs % 12) + 12) % 12 === pc);
        const alt = k ? {step: 0, li: k.li, nacc: k.nacc} : null;
        return pickSpelling(li0, rootMidi, v, alt);
      });
      label = sp[s.d].roman;
      sym = sp[s.d].name + (x.c.sym || "") + (x.v.inv > 0 ? "/" + sp[x.v.degs[0]].name : "");
    }
    if(deck.satb){
      /* 四部和声：S/A 高音谱，T/B 低音谱；四行谱模式再拆成每人一行 */
      tre.push(Object.assign({label, sub: "", notes: notes.slice(0, 2), dur: dur}, W(i)));
      bas.push({label: "", sub: sym, notes: notes.slice(2, 4), dur: dur});
      SV.push({label: i === deck.sel ? label : "", sub: "", notes: [notes[0]], dur: dur});
      SA.push({label: "", sub: "", notes: [notes[1]], dur: dur});
      ST.push({label: "", sub: "", notes: [notes[2]], dur: dur});
      SB.push({label: "", sub: i === deck.sel ? sym : "", notes: [notes[3]], dur: dur});
    } else {
      /* 钢琴谱：右手弹完整和弦（移到高音谱音区），左手弹根音八度（低音谱） */
      const sorted = notes.slice().sort((a, b) => a.step - b.step);
      const bassNote = shiftSteps([sorted[0]], 16, 27)[0];
      const upper = shiftSteps(sorted, 31, 40);
      tre.push({label, sub: "", notes: upper, dur: dur});
      bas.push({label: "", sub: sym, notes: [bassNote], dur: dur});
    }
  });
  return {tre, bas, S: SV, A: SA, T: ST, B: SB};
}

/* 整组按八度平移，让最低音落进 [lo, hi] 步区间（7 步 = 一个八度，字母不变） */
function shiftSteps(notes, lo, hi){
  const mn = Math.min(...notes.map(n => n.step));
  let d = 0;
  while(mn + d < lo) d += 7;
  while(mn + d > hi) d -= 7;
  return notes.map(n => ({...n, step: n.step + d}));
}

/* ---------- 交互 ---------- */

function wireDeck(){
  let src = null;
  document.querySelectorAll("#deckChips .chip").forEach(el => {
    el.addEventListener("dragstart", e => {
      src = {type:"deg", deg:+el.dataset.deg};
      e.dataTransfer.setData("text/plain","deg");
      e.dataTransfer.effectAllowed = "copy";
    });
    el.addEventListener("click", () => {
      const i = deck.slots.indexOf(null);
      if(i < 0) return;
      deck.slots[i] = {m:null, d:+el.dataset.deg, n:null};
      deck.sel = i;
      saveDeck(); renderDeck();
    });
  });
  document.querySelectorAll("#deck .slot").forEach(el => {
    el.addEventListener("dragover", e => { e.preventDefault(); el.classList.add("over"); });
    el.addEventListener("dragleave", () => el.classList.remove("over"));
    el.addEventListener("drop", e => {
      e.preventDefault(); el.classList.remove("over");
      if(!src) return;
      const i = +el.dataset.i;
      if(src.type === "deg") deck.slots[i] = {m:null, d:src.deg, n:null};
      else {
        const a = src.i, tmp = deck.slots[i];
        deck.slots[i] = deck.slots[a];
        deck.slots[a] = tmp;
      }
      saveDeck(); renderDeck();
    });
    el.addEventListener("click", () => {
      const i = +el.dataset.i;
      if(!deck.slots[i]) return;
      deck.sel = (deck.sel === i) ? -1 : i;
      renderDeck();
    });
    if(el.classList.contains("filled")){
      el.addEventListener("dragstart", e => {
        src = {type:"slot", i:+el.dataset.i};
        e.dataTransfer.setData("text/plain","slot");
        e.dataTransfer.effectAllowed = "move";
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
      el.addEventListener("dblclick", () => {
        deck.slots[+el.dataset.i] = null;
        if(deck.sel === +el.dataset.i) deck.sel = -1;
        saveDeck(); renderDeck();
      });
    }
  });
  wireDeckEditor();
}

function wireDeckEditor(){
  const s = deckFollows() ? deck.slots[deck.sel] : null;
  if(!s) return;
  const modeSel = document.getElementById("deMode");
  if(modeSel && !modeSel.dataset.wired){
    modeSel.dataset.wired = "1";
    modeSel.addEventListener("change", () => {
      const cur = deckFollows() ? deck.slots[deck.sel] : null;
      if(!cur) return;
      cur.m = modeSel.value || null;
      const m = slotMode(cur);
      cur.d = Math.min(cur.d, m.pcs.length - 1);
      if(cur.n && cur.n > sizeCap(m)) cur.n = sizeCap(m);
      saveDeck(); renderDeck();
    });
  }
  document.querySelectorAll("#deDeg button").forEach(b => {
    b.onclick = () => {
      const cur = deckFollows() ? deck.slots[deck.sel] : null;
      if(!cur) return;
      cur.d = +b.dataset.deg;
      saveDeck(); renderDeck();
    };
  });
  document.querySelectorAll("#deSize button").forEach(b => {
    b.onclick = () => {
      const cur = deckFollows() ? deck.slots[deck.sel] : null;
      if(!cur) return;
      const n = +b.dataset.size;
      const def = chordSize(slotMode(cur), state.voicing);
      cur.n = (n === def) ? null : n;
      saveDeck(); renderDeck();
    };
  });
  document.querySelectorAll("#deSpread button").forEach(b => {
    b.onclick = () => {
      const cur = deckFollows() ? deck.slots[deck.sel] : null;
      if(!cur) return;
      cur.spread = b.dataset.spread;
      saveDeck(); renderDeck();
    };
  });
  document.querySelectorAll("#deInv button").forEach(b => {
    b.onclick = () => {
      const cur = deckFollows() ? deck.slots[deck.sel] : null;
      if(!cur) return;
      cur.inv = +b.dataset.inv;
      saveDeck(); renderDeck();
    };
  });
  document.querySelectorAll("#deDur button").forEach(b => {
    b.onclick = () => {
      const cur = deckFollows() ? deck.slots[deck.sel] : null;
      if(!cur) return;
      const d = +b.dataset.dur;
      cur.beats = d === 2 ? null : d;          // 2 拍是默认值，不写进存档
      saveDeck(); renderDeck();
    };
  });
  document.querySelectorAll("#deKind button").forEach(b => {
    b.onclick = () => {
      const cur = deckFollows() ? deck.slots[deck.sel] : null;
      if(!cur) return;
      cur.rest = b.dataset.kind === "rest";
      saveDeck(); renderDeck();
    };
  });
  const del = document.getElementById("deDel");
  if(del) del.onclick = () => {
    if(deck.sel < 0) return;
    deck.slots[deck.sel] = null;
    deck.sel = -1;
    saveDeck(); renderDeck();
  };
  const aud = document.getElementById("dePlay");
  if(aud) aud.onclick = () => {
    const cur = deckFollows() ? deck.slots[deck.sel] : null;
    if(!cur) return;
    audio();
    playDegree(slotMode(cur), cur.d, tonicObj(), {size: slotChord(cur).n, arp: $("#arp").checked});
  };
}

/* ---------- 播放 / 导出 ---------- */

const deckTimers = [];
function setDeckPlaying(on){
  deck.playing = !!on;
  const b = document.getElementById("btnDeckPlay");
  if(b){ b.textContent = on ? "■ 停止" : "▶ 播放"; b.classList.toggle("on", !!on); }
}

function stopDeck(){
  if(deck.timer){ clearTimeout(deck.timer); deck.timer = null; }
  deckTimers.forEach(id => clearTimeout(id));
  deckTimers.length = 0;
  deck.cur = -1;
  document.querySelectorAll("#deck .slot.playing").forEach(el => el.classList.remove("playing"));
  setDeckPlaying(false);
}

function playDeck(){
  stopDeck();
  const tl = deckTimeline();
  if(!tl.items.length) return;
  audio();
  stopVoices();                                  // 上一轮还在响就先掐掉
  setDeckPlaying(true);
  const midis = deckMidis();
  const arp = $("#arp").checked;
  const spb = beatSeconds(curBpm());            // 一拍多少秒：跟着「导出 MIDI」里的速度走
  tl.items.forEach((it, k) => {
    const ms = it.rest ? [] : (midis[it.i] || []);
    ms.forEach((mi, j) => toneAt(mi, it.at * spb + (arp ? j * 0.06 : 0), it.beats * spb * 0.95, 0.85));
    deckTimers.push(setTimeout(() => {
      document.querySelectorAll("#deck .slot.playing").forEach(el => el.classList.remove("playing"));
      const el = document.querySelector(`#deck .slot[data-i="${it.i}"]`);
      if(el) el.classList.add("playing");
    }, it.at * spb * 1000));
  });
  const total = tl.total * spb;
  if($("#deckLoop").checked) deck.timer = setTimeout(playDeck, total*1000 + 260);
  else deck.timer = setTimeout(stopDeck, total*1000 + 200);
}

function midiDeckNotes(){
  const midis = deckMidis(), out = [];
  const tl = deckTimeline();
  tl.items.forEach(it => {
    if(it.rest) return;
    (midis[it.i] || []).forEach(mi => out.push({
      t: Math.round(it.at * TPQ), d: Math.round(it.beats * TPQ * 0.95), m: mi, v: 88}));
  });
  return out;
}

$("#btnSatb").onclick = () => {
  deck.satb = !deck.satb;
  try{ localStorage.setItem(DECK_SATB_KEY, deck.satb ? "1" : "0"); }catch(_){}
  $("#btnSatb").classList.toggle("on", deck.satb);
  renderDeck();
};
/* 四行谱：只在四部和声下有效（S/A/T/B 各占一个谱表） */
$("#btnFour").onclick = () => {
  if(!deck.satb){
    deck.satb = true;
    try{ localStorage.setItem(DECK_SATB_KEY, "1"); }catch(_){}
    $("#btnSatb").classList.add("on");
  }
  deck.four = !deck.four;
  try{ localStorage.setItem(DECK_FOUR_KEY, deck.four ? "1" : "0"); }catch(_){}
  $("#btnFour").classList.toggle("on", deck.four);
  renderDeck();
};
$("#btnDeckPlay").onclick = () => { if(deck.playing) stopDeck(); else playDeck(); };
$("#deckOctDown").onclick = () => setDeckOct((deck.oct || 0) - 1);
$("#deckOctUp").onclick = () => setDeckOct((deck.oct || 0) + 1);
$("#btnDeckClear").onclick = () => {
  stopDeck();
  deck.slots = new Array(DECK_N).fill(null);
  deck.sel = -1;
  saveDeck(); renderDeck();
};
$("#btnDeckMidi").onclick = () => {
  if(!deckSeq().length) return;
  const m = byId(state.A);
  dlMidi(buildMidi(midiDeckNotes(), curBpm(), "progression"), `${m.cn}-${curTonicName()}-进行.mid`);
};
$("#btnStaffScale").onclick = () => { staffView = "scale"; renderStaff(); };
$("#btnStaffChords").onclick = () => { staffView = "chords"; renderStaff(); };
document.querySelectorAll(".vseg button").forEach(b => {
  b.onclick = () => setVoicing(b.dataset.v);
});

$("#octDown").onclick = () => setOct(state.oct - 1);
$("#octUp").onclick = () => setOct(state.oct + 1);
$("#a4In").onchange = () => { const v = parseFloat($("#a4In").value); if(isFinite(v)) setA4(v); else renderAll(); };
document.querySelectorAll("[data-a4]").forEach(b => b.onclick = () => setA4(+b.dataset.a4));

loadDeck();
uiRegister("deck", renderDeck);
