/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 借用与副属和弦：本音阶那七个和弦之外的两种「最常用外挂」（纯函数，不碰 DOM）

   借用和弦 = 从同主音的另一侧调借：大调借小调的 ♭III ♭VI ♭VII iv v、小调借大调的 IV V。
   副属和弦 = 对某个级数临时建的属和弦（V7/ii、V7/V…），用完要解决回去。

   两者的音高类都按绝对音高（0 = C）给出，跟 deckMidis 的口径一致。 */

// 相对主音的音程 → 级数记号（借用和弦用：C 大调里从 C 小调借来的 ♭III 得写成 bIII）
const DEG_ROMAN = ["I", "bII", "II", "bIII", "III", "IV", "bV", "V", "bVI", "VI", "bVII", "VII"];

// 三和弦/七和弦的骨架 → 级数的大小写与增减小圈（iv、ii°、III+）
function romanShape(base, iv){
  const third = iv.indexOf(3) >= 0 ? 3 : (iv.indexOf(4) >= 0 ? 4 : -1);
  let s = third === 3 ? base.toLowerCase() : base;
  if(iv.indexOf(6) >= 0 || iv.indexOf(2) >= 0) s += "°";
  else if(iv.indexOf(8) >= 0) s += "+";
  return s;
}

/* 同主音的另一侧：有 ♭3 就去借大调，没有就借自然小调。
   和特征音（charNotes）用的是同一条规矩，两处口径一致。 */
function parallelScale(mode){
  const id = mode.pcs.indexOf(3) >= 0 ? "ion" : "aeo";
  const base = MODES.find(x => x.id === id);
  return {
    id: id,
    cn: id === "ion" ? "同主音大调" : "同主音小调",
    pcs: base ? base.pcs : (id === "ion" ? [0,2,4,5,7,9,11] : [0,2,3,5,7,8,10]),
  };
}

// 当前调号倾向：挂降号就用降号表拼外音（♭E 而不是 D♯）
function borrowFlat(mode, tonic){
  return typeof keyFifthsFor === "function" ? keyFifthsFor(mode, tonic) < 0 : false;
}

function pcNameIn(pc, flat){
  const table = flat ? CHROM_FLAT : CHROM_SHARP;
  return table[((pc % 12) + 12) % 12];
}

/* 从根音字母出发按三度推字母，得到每个和弦音的写法（C 上的属七 → C E G Bb）。
   ivs 是相对根音的半音数数组，rootName 是根音写法（可带升降）。 */
function tertianNames(rootPc, ivs, rootName){
  const li0 = LETTERS.indexOf(rootName[0]);
  return ivs.map(iv => {
    const target = ((rootPc + iv) % 12 + 12) % 12;
    const li = (li0 + TERTIAN_LETTER[iv]) % 7;
    let acc = (target - LPC[LETTERS[li]] + 12) % 12;
    if(acc > 6) acc -= 12;
    return LETTERS[li] + accStr(acc);
  });
}

// 这个和弦的音是不是全都落在本音阶里（全在就是本位和弦，不算「借来的」）
function allInScale(tones, mode, tonic){
  return tones.every(p => mode.pcs.indexOf((((p - tonic.pc) % 12) + 12) % 12) >= 0);
}

/* 借用和弦：把同主音另一侧的七个和弦过一遍，只留不属于本音阶的。
   size = 3 取三和弦，4 取七和弦。 */
function borrowChords(mode, tonic, size){
  if(mode.pcs.length !== 7) return [];
  const want = size || 4;
  const par = parallelScale(mode);
  const parSp = spell({ pcs: par.pcs }, tonic);
  const out = [], seen = {};
  for(let i = 0; i < 7; i++){
    const c = chordOf({ pcs: par.pcs }, i, want >= 4 ? "7" : "3", want);
    const tones = c.tones.map(pc => (((tonic.pc + pc) % 12) + 12) % 12);
    if(allInScale(tones, mode, tonic)) continue;
    const key = tones.slice().sort((a, b) => a - b).join(",");
    if(seen[key]) continue;
    seen[key] = 1;
    const rel = ((par.pcs[i] % 12) + 12) % 12;
    const rootName = parSp[i].name;
    out.push({
      kind: "borrow",
      roman: romanShape(DEG_ROMAN[rel], c.iv),
      symbol: rootName + c.sym,
      root: tones[0],
      tones: tones,
      ivs: c.iv,
      names: tertianNames(tones[0], c.iv, rootName),
      from: par.cn,
      fromId: par.id,
      key: key,
    });
  }
  // 按「离主音几个半音」从低到高排（C 大调就是 ♭II → ♭III → iv → v → ♭VI → ♭VII）
  const relOf = x => (((x.root - tonic.pc) % 12) + 12) % 12;
  return out.sort((a, b) => relOf(a) - relOf(b));
}

/* 副属和弦：对每个级数（不含主音）建一个大三和弦或属七和弦。
   本身属于本音阶的跳过（比如大调 V7/V 以外，V7/I 就是自己的 V7）。 */
function secondaryDominants(mode, tonic, size){
  if(mode.pcs.length !== 7) return [];
  const want = size || 4;
  const flat = borrowFlat(mode, tonic);
  const out = [];
  for(let i = 1; i < 7; i++){
    const target = (((tonic.pc + mode.pcs[i]) % 12) + 12) % 12;
    const root = (target + 7) % 12;
    const ivs = want >= 4 ? [0, 4, 7, 10] : [0, 4, 7];
    const tones = ivs.map(x => (root + x) % 12);
    if(allInScale(tones, mode, tonic)) continue;
    const rootName = pcNameIn(root, flat);
    // 被指向的那个级数按它自己的三度性质写大小写（V7/ii、V7/IV、V7/vii°）
    const targetRoman = romanShape(DEG_ROMAN[mode.pcs[i]], chordOf(mode, i, want >= 4 ? "7" : "3", want).iv);
    out.push({
      kind: "secondary",
      roman: (want >= 4 ? "V7" : "V") + "/" + targetRoman,
      symbol: rootName + (want >= 4 ? "7" : ""),
      root: root,
      tones: tones,
      ivs: ivs,
      names: tertianNames(root, ivs, rootName),
      target: targetRoman,
      targetPc: target,
      key: tones.slice().sort((a, b) => a - b).join(","),
    });
  }
  return out;
}

// 两组一起要（界面上用）
function outsideChords(mode, tonic, size){
  return {
    borrow: borrowChords(mode, tonic, size),
    second: secondaryDominants(mode, tonic, size),
    parallel: parallelScale(mode),
  };
}
