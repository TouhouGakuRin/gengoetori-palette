/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 音高与拼写：纯函数，不碰 DOM、不读全局状态 */

const LETTERS = ["C","D","E","F","G","A","B"];

const LPC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};

const CHROM = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];

const ROMAN = ["I","II","III","IV","V","VI","VII"];

/* 三度叠置时「某个音程该用哪个字母」：下标是相对根音的半音数，值是字母偏移。
   有了它，C 上的小三度才会写成 Eb 而不是 D#（谱面上不会造出假二度）。 */
const TERTIAN_LETTER = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];

function accStr(d){ return d<0 ? "b".repeat(-d) : "#".repeat(d); }

function noteName(letterIdx, acc){
  const a = acc < 0 ? "b".repeat(-acc) : "#".repeat(acc);
  return LETTERS[letterIdx] + a;
}

const PITCH_NAMES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];

// 非七声音阶用「十二个半音各一个名字」来拼写：升号体系 / 降号体系
const CHROM_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const CHROM_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function nameToLetterAcc(name){
  const li = LETTERS.indexOf(name[0]);
  const acc = name.length > 1 ? (name[1] === "#" ? 1 : -1) : 0;
  return {li, acc};
}

// 任意音数（5/6/7/8/9/10/12）的拼写：
// 七声仍按字母顺序拼（Eb 大调写成 Eb F G Ab Bb C D）；
// 其余按「主音的升降倾向」选升/降体系，同一体系内一个半音一个名字。
function spell(mode, tonic){
  const out = [];
  const n = mode.pcs.length;
  if(n === 7){
    for(let i=0;i<7;i++){
      const li = (tonic.li + i) % 7;
      const letter = LETTERS[li];
      const target = (tonic.pc + mode.pcs[i]) % 12;
      let nameAcc = (target - LPC[letter] + 12) % 12;   if(nameAcc > 6) nameAcc -= 12;
      const acc = mode.pcs[i] - IONIAN[i];
      const lb = (mode.degNames && mode.degNames[i]) || (accStr(acc) + ROMAN[i]);
      out.push({i, li, acc, nacc:nameAcc, name:LETTERS[li] + accStr(nameAcc), roman:lb, abs:target});
    }
    return out;
  }
  /* 升号体系还是降号体系，跟着调号走：挂了三个降号的谱子不能把同名音写成升号，
     否则符头旁边的记号会和调号打架（D♯ 撞上 ♭E 的调号要写成两个记号）。
     五声例外：它的拼写跟「宫」所在的调走 —— 商调式主音 C 的宫是 Bb，第七个音要写 Bb 而不是 A#。 */
  const useFlat = keyFifthsFor(mode, tonic) < 0 || (mode.pentRot != null && gongFifths(tonic, mode.pentRot) < 0);
  const table = useFlat ? CHROM_FLAT : CHROM_SHARP;
  for(let i=0;i<n;i++){
    const abs = (tonic.pc + mode.pcs[i]) % 12;
    const nm = table[abs];
    const la = nameToLetterAcc(nm);
    out.push({i, li:la.li, acc:0, nacc:la.acc, name:nm, roman:degLabel(mode, i), abs});
  }
  return out;
}

function midiName(m){ return PITCH_NAMES[m % 12] + (Math.floor(m/12) - 1); }

function octaveFor(li, midi){
  let best = null;
  for(let o = 1; o <= 8; o++){
    const nat = 12 * (o + 1) + LPC[LETTERS[li]];
    const d = Math.abs(midi - nat);
    if(!best || d < best.d) best = {o, d};
  }
  return best.o;
}
