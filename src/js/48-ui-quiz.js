/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 4h. 听辨测验 ---------- */
const quiz = {m:null, to:0, opts:[], answered:false, pick:null, score:0, n:0};

function newQuiz(){
  // 听辨只出成套的七声调式：教会、旋律小调、和声小调三套旋法
  const pool = MODES.filter(x => x.rot && ["church", "melodic", "harmonic"].includes(x.src));
  const m = pool[Math.floor(Math.random()*pool.length)];
  const to = Math.floor(Math.random()*12);
  const opts = [m];
  let guard = 0;
  while(opts.length < 4 && guard++ < 400){
    const c = pool[Math.floor(Math.random()*pool.length)];
    if(!opts.some(o => o.id === c.id)) opts.push(c);
  }
  opts.sort(() => Math.random() - 0.5);
  quiz.m = m; quiz.to = to; quiz.opts = opts;
  quiz.answered = false; quiz.pick = null;
  renderQuiz();
}

function playQuiz(){
  if(!quiz.m) return;
  const t = TONICS[quiz.to];
  audio();
  /* 音阶 + 主和弦拼成一份计划一次排上：playEvents 每次都会清总线，
     分两次调用会把先排的音阶整体掐掉（只能听到最后的主和弦）。 */
  const o = withTune({});
  playEvents(planScale(quiz.m, t, o)
    .concat(planDegree(quiz.m, 0, t, Object.assign({}, o, {when: 2.1, dur: 1.0, vel: 0.9}))), o.a4);
}

function renderQuiz(){
  const t = TONICS[quiz.to];
  let html = `<div class="qopts">` + quiz.opts.map(o => {
    let cls = "qopt";
    if(quiz.answered){
      if(o.id === quiz.m.id) cls += " ok";
      else if(o.id === quiz.pick) cls += " no";
    }
    return `<button class="${cls}" data-q="${o.id}">${o.cn}<small>${o.n}</small></button>`;
  }).join("") + `</div>`;
  if(quiz.answered){
    const ok = quiz.pick === quiz.m.id;
    html += `<p class="hint">${ok ? "✓ 对了" : "✗ 错了"} —— 答案是 <b>${quiz.m.cn}</b>（${quiz.m.n}），`
      + `主音 ${noteName(t.li, t.acc)}，音阶 <span class="mono">${quiz.m.pcs.map((p,i)=>accStr(p-IONIAN[i])+(i+1)).join(" ")}</span></p>`;
  } else {
    html += `<p class="hint">主音与调式都是随机的。先点「▶ 听题」听音阶和主和弦，再选一个。</p>`;
  }
  $("#quizBody").innerHTML = html;
  $("#quizBody").querySelectorAll("[data-q]").forEach(el => {
    el.onclick = () => {
      if(quiz.answered) return;
      quiz.answered = true; quiz.pick = el.dataset.q; quiz.n++;
      if(quiz.pick === quiz.m.id) quiz.score++;
      $("#quizScore").textContent = `${quiz.score} / ${quiz.n}`;
      renderQuiz();
    };
  });
}

uiRegister("quiz", renderQuiz);
