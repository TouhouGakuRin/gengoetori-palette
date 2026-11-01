/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 四部和声：把任意和弦摊成 S/A/T/B 四个声部，并做基本检查 */

// 四个声部的常用音域（midi）
const SATB_RANGE = {S:[60,81], A:[55,74], T:[48,67], B:[40,62]};
// 各声部的「舒适中心」，用于在多个可行解里挑最像合唱歌谱的那种
const SATB_TARGET = {S:71, A:64, T:57, B:47};
const SATB_NAMES = ["S", "A", "T", "B"];

function midiOfPcIn(pc, range){
  const out = [];
  for(let m = range[0]; m <= range[1]; m++) if(((m % 12) + 12) % 12 === ((pc % 12) + 12) % 12) out.push(m);
  return out;
}

/* tones: 绝对音高类数组（0-11，已在调上）；bassPc: 低音要落的音级
   返回按「内部分数」排好序的候选，每个 {S,A,T,B,sc} */
function satbCandidates(tones, bassPc, limit){
  const pcs = [...new Set(tones.map(t => ((t % 12) + 12) % 12))];
  if(!pcs.length) return [];
  const bass = ((bassPc % 12) + 12) % 12;
  const bCands = midiOfPcIn(bass, SATB_RANGE.B);
  if(!bCands.length) return [];

  const root = pcs[0];
  /* 五音/三音/七音按音集里实际有什么来判——
     五度叠置顺序的音集 pcs[2] 不是五音，属七的七音是小七度不是大七度，
     老的硬编码假设在这两类和弦上都会判错。 */
  const fifthPc = pcs.find(p => ((p - root) % 12 + 12) % 12 === 7);
  const thirdPc = pcs.find(p => { const iv = ((p - root) % 12 + 12) % 12; return iv === 3 || iv === 4; });
  const sevPc = pcs.find(p => { const iv = ((p - root) % 12 + 12) % 12; return iv === 10 || iv === 11; });
  const out = [];
  for(const b of bCands){
    const tOpt = pcs.flatMap(pc => midiOfPcIn(pc, SATB_RANGE.T).filter(m => m > b));
    const aOpt = pcs.flatMap(pc => midiOfPcIn(pc, SATB_RANGE.A));
    const sOpt = pcs.flatMap(pc => midiOfPcIn(pc, SATB_RANGE.S));
    for(const t of tOpt){
      for(const a of aOpt){
        if(a <= t) continue;
        for(const s of sOpt){
          if(s <= a) continue;
          let sc = Math.abs(s - SATB_TARGET.S) + Math.abs(a - SATB_TARGET.A)
                 + Math.abs(t - SATB_TARGET.T) + Math.abs(b - SATB_TARGET.B);
          if(s - a > 12) sc += (s - a - 12) * 2;
          if(a - t > 12) sc += (a - t - 12) * 2;
          if(t - b > 19) sc += (t - b - 19) * 3;
          const pcsUsed = [s % 12, a % 12, t % 12, b % 12];
          const dup = {};
          pcsUsed.forEach(p => dup[p] = (dup[p] || 0) + 1);
          for(const p in dup){
            if(dup[p] > 1){
              const iv = ((+p - root) + 12) % 12;
              if(iv === 3 || iv === 4) sc += 6;          // 三音重复
              else if(iv === 10 || iv === 11) sc += 9;   // 七音重复
              else if(+p === fifthPc) sc -= 2;           // 重复五音稍好
              else if(+p === root) sc -= 3;              // 重复根音最好
            }
          }
          // 缺三音/七音：空五度不成和弦（音集里本来就没有的，不该罚）
          if(thirdPc !== undefined && !(thirdPc in dup)) sc += 18;
          if(sevPc !== undefined && !(sevPc in dup)) sc += 18;
          out.push({S:s, A:a, T:t, B:b, sc});
        }
      }
    }
  }
  out.sort((x, y) => x.sc - y.sc);
  return limit ? out.slice(0, limit) : out;
}

function satbVoicing(tones, bassPc){
  const c = satbCandidates(tones, bassPc, 1);
  if(!c.length) return null;
  const {S, A, T, B} = c[0];
  return {S, A, T, B};
}

/* 整条进行：用动态规划挑解，把「平行五/八度、隐伏五/八度、导音不解决、七音不解决、间距过大」
   都算进代价里，让自动写出来的四声部尽量不自相矛盾。
   贪心只看前一步，会在 V→I 这种地方写出平行八度；整条一起求最优就不会。
   specs = [{tones:[绝对音级], bassPc}]，返回等长的 voicing 数组（解不出时给 null） */
function satbSequence(specs, opts){
  opts = opts || {};
  const POOL = 24, n = (specs || []).length;
  const pools = [], tones = [], sevens = [];
  for(const sp of (specs || [])){
    if(!sp || !sp.tones || !sp.tones.length){ pools.push(null); tones.push(null); sevens.push(null); continue; }
    const p = satbCandidates(sp.tones, sp.bassPc, POOL);
    pools.push(p.length ? p : null);
    const tn = sp.tones.map(x => ((x % 12) + 12) % 12);
    tones.push(tn);
    sevens.push(seventhOf(tn));
  }

  // cost[i][j]：走到第 i 槽、取第 j 个候选时的最小总代价；back[i][j]：上一槽取第几个
  const cost = [], back = [];
  for(let i = 0; i < n; i++){
    cost.push(pools[i] ? pools[i].map(c => c.sc) : []);
    back.push(pools[i] ? pools[i].map(() => -1) : []);
  }
  for(let i = 1; i < n; i++){
    if(!pools[i] || !pools[i - 1]) continue;
    for(let b = 0; b < pools[i].length; b++){
      let bestK = -1, bestV = Infinity;
      for(let a = 0; a < pools[i - 1].length; a++){
        let pen = 0;
        for(const h of satbCheck(pools[i - 1][a], pools[i][b],
          {tonic: opts.tonic, seven: sevens[i - 1], nextTones: tones[i]}))
          pen += SATB_WEIGHT[h.kind] || 20;
        const v = cost[i - 1][a] + pen;
        if(v < bestV){ bestV = v; bestK = a; }
      }
      if(bestK >= 0){ cost[i][b] = pools[i][b].sc + bestV; back[i][b] = bestK; }
    }
  }

  // 从头往后回溯：每段（中间被休止/解不出切断）取段尾最优，再顺着 back 往回走
  const out = new Array(n).fill(null);
  let j = -1;
  for(let i = n - 1; i >= 0; i--){
    if(!pools[i]){ j = -1; continue; }
    if(j < 0){
      j = 0;
      for(let x = 1; x < pools[i].length; x++) if(cost[i][x] < cost[i][j]) j = x;
    }
    const v = pools[i][j];
    out[i] = {S: v.S, A: v.A, T: v.T, B: v.B};
    j = back[i][j];
  }
  return out;
}

/* 和弦音里的七音（四个音按三度叠置时，第四个与根音成十度或十一度），
   没有七音就 null。作为「七音必须下行级进」的判据。 */
function seventhOf(tones){
  const t = [...new Set(tones.map(p => ((p % 12) + 12) % 12))];
  if(t.length < 4) return null;
  const iv = ((t[3] - t[0]) % 12 + 12) % 12;
  return (iv === 10 || iv === 11) ? t[3] : null;
}

// 每条违规的罚分。硬规矩（平行五八、导音、间距）压过候选本身十几分的软分差，
// 隐伏五八与七音给中等罚分（现实写作里偶尔可接受，但能避开就避开）。
const SATB_WEIGHT = {
  "平行五度": 140, "平行八度": 140,
  "导音未解决": 120, "间距过大": 100,
  "七音未解决": 80,
  "三全音跳进": 30,
  "隐伏八度": 20, "隐伏五度": 16,
};

/* 相邻两个和弦的检查。opts = {tonic: 主音 pc, seven: 上一和弦七音 pc, nextTones: 这一和弦的音级}
   返回 [{kind, voices, detail}]，空数组表示没查到大问题。
   查的东西：平行五/八度、隐伏五/八度（外声部同向进入纯音程且高音跳进）、
   导音解决（外声部的导音必须上行小二度到主音）、七音解决（下行级进）、间距。 */
function satbCheck(prev, cur, opts){
  opts = opts || {};
  const out = [];
  if(!prev || !cur) return out;
  const pcOf = m => ((m % 12) + 12) % 12;

  // 1. 平行五度 / 平行八度：任两声部之间，两个纯音程同向同度进行
  const pairs = [["S","A"],["S","T"],["S","B"],["A","T"],["A","B"],["T","B"]];
  for(const [x, y] of pairs){
    const p0 = prev[x] - prev[y], p1 = cur[x] - cur[y];
    if(p0 <= 0 || p1 <= 0) continue;                          // 交叉或同度，不归这一条管
    const d0 = pcOf(p0), d1 = pcOf(p1);
    if(d0 !== d1) continue;
    if(d0 === 7) out.push({kind:"平行五度", voices:x + "/" + y, detail:"两声部同向进到纯五度"});
    else if(d0 === 0) out.push({kind:"平行八度", voices:x + "/" + y, detail:"两声部同向进到纯八度"});
  }

  // 2. 隐伏五度 / 隐伏八度：外声部（S、B）同向进入纯五度或纯八度，
  //    且高声部是跳进（斯波索宾：外声部同向+高音跳进进入纯音程，禁止）
  const ds = cur.S - prev.S, db = cur.B - prev.B;
  if(ds && db && Math.sign(ds) === Math.sign(db) && Math.abs(ds) > 2){
    const iv = pcOf(cur.S - cur.B);
    if(iv === 7) out.push({kind:"隐伏五度", voices:"S/B", detail:"外声部同向 + 高音跳进"});
    else if(iv === 0) out.push({kind:"隐伏八度", voices:"S/B", detail:"外声部同向 + 高音跳进"});
  }

  // 3. 导音解决：外声部（S、B）上的导音必须上行小二度到主音
  if(opts.tonic != null){
    const lt = pcOf(opts.tonic + 11);
    for(const v of ["S", "B"]){
      if(pcOf(prev[v]) !== lt) continue;
      if(cur[v] === prev[v] + 1) continue;                    // 上行小二度，正解
      out.push({kind:"导音未解决", voices:v, detail:"导音该上行小二度到主音"});
    }
  }

  // 4. 七音解决：和弦七音下行级进（小二度或大二度）；还是新和弦的音就没问题
  if(opts.seven != null){
    for(const v of ["S","A","T","B"]){
      if(pcOf(prev[v]) !== pcOf(opts.seven)) continue;
      const step = cur[v] - prev[v];
      if(step === -1 || step === -2) continue;
      if(opts.nextTones && opts.nextTones.some(p => pcOf(p) === pcOf(cur[v]))) continue;
      out.push({kind:"七音未解决", voices:v, detail:"和弦七音该下行级进"});
    }
  }

  // 5. 间距：上三声部相邻不超过八度，男高音与男低音不超过十二度
  const gaps = [["S","A",12,"上两声部不超过八度"],["A","T",12,"中两声部不超过八度"],["T","B",19,"T–B 不超过十二度"]];
  for(const [x, y, mx, why] of gaps){
    const g = cur[x] - cur[y];
    if(g > mx) out.push({kind:"间距过大", voices:x + "/" + y, detail:`${g} 半音 · ${why}`});
  }

  // 6. 旋律里的三全音跳进（增四度/减五度），传统四部写作要避免
  for(const v of ["S","A","T","B"]){
    if(Math.abs(cur[v] - prev[v]) === 6) out.push({kind:"三全音跳进", voices:v, detail:"旋律里的增四度/减五度"});
  }
  return out;
}

/* 整条进行一次性体检：voicings 是 [{S,A,T,B}] 数组，
   opts = {tonic, sevenths:[pc|null], tones:[[pc]]}。
   返回 [{from, to, kind, voices, detail}]，供界面显示。 */
function satbViolations(voicings, opts){
  opts = opts || {};
  const out = [];
  for(let k = 1; k < (voicings || []).length; k++){
    const a = voicings[k - 1], b = voicings[k];
    if(!a || !b) continue;
    const seven = opts.sevenths ? opts.sevenths[k - 1] : null;
    const nextTones = opts.tones ? opts.tones[k] : null;
    for(const h of satbCheck(a, b, {tonic: opts.tonic, seven, nextTones}))
      out.push(Object.assign({from: k - 1, to: k}, h));
  }
  return out;
}
