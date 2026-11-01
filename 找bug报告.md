# 幻歌鸟调色盘 v1.1.4 · 找 Bug 报告

> 审查日期：2026-11-01
> 范围：`src/js` 全部 33 个模块（8150 行）+ `shell.html` + `build.mjs` / `发版.mjs` / `packaging-webview2`
> 方法：全量通读 + 5 个探针脚本实证（假 AudioContext 模拟、60 调式 × 12 主音拼写/和弦/SATB 全量数值检查、MIDI 字节级解析、节奏切分不变量、构建一致性比对）
> 基线：14 套测试全部通过；`index.html` 与 `src` 逐字节一致（仅构建时间戳差），以下问题在成品里全部存在。

---

## 🔴 严重（功能坏掉）

### 1. 播放时间线被自我掐断：4 处「多批次播放」只响最后一批

`playEvents()` 每次都先调 `stopVoices()`（`src/js/10-audio-engine.js:241`），而 `stopVoices` 会把**还没开始的未来音符也停掉**（`o.stop(now+0.06)` 早于已计划的 `o.start(t)`，按 Web Audio 规范该振荡器永远不发声）。任何「先播 A、再排 B」的调用，A 都会被 B 的 `stopVoices` 杀死。

用假 AudioContext 逐振荡器验证了 4 个受害点（56 个振荡器里 40 个永不发声、8 个被剪成 60ms 咔哒、只剩最后一批完整发声）：

| 调用点 | 现象 |
|---|---|
| `#btnProg` ▶ 播放七个和弦（`60-main.js:105`，7 次 `playDegree` + `when: i*0.62`） | 只听到最后一个和弦；前 6 个全灭，第 1 个只剩 60ms 咔哒。高亮循环却照常走 620ms 一步 |
| `#btnAB` ▶ 试听差异（`60-main.js:118`） | README 承诺「先 A、再 B、再差异音」——实际 A 只剩 60ms 咔哒，只有 B 和差异音出声 |
| `playQuiz` ▶ 听题（`48-ui-quiz.js:25`） | **音阶完全听不到**：playScale 刚排好就被 playDegree(when:2.1) 清场，用户只听到 2.1 秒后的主和弦——听辨测验没法靠耳朵做 |
| 变形页 ▶ 试听变形后的音阶（`46-ui-morph.js:139`） | 同上，变形结果听不见 |

### 2. 五声「偏音」（清角/变徵/闰/变宫）整套功能是死的

`baseMode()` 里唯一的消费点写着 `if(m.id === "pen" && ...)`（`40-ui-pipeline.js:25`）——但五声的 id 是 `penG/penS/penJ/penZ/penY`，**没有任何 id 叫 "pen"**（应是拆分五调前遗留的判断）。后果：

- 按钮（`43-ui-detail.js:31-33` 生成，`60-main.js:73-74` 写入 `state.b4/b7`）只会高亮自己，谱面、和弦卡、半音条、试听全部还是 5 声；
- README v11 专门宣传的功能（166–174 行：「偏音一插，音阶立刻变成 6 声或 7 声……清角上的和弦是 E♭maj7」）完全无效果；
- `pentaMode()`（`01-core-scales.js:524`）本身算法是对的——验证过 penS+清角+变宫 恰好产出 README 承诺的 `C D Eb F G A Bb`（清乐商调），只是永远没人调它；
- 顺带：`pentaMode` 的英文名在同时加两个偏音时只取第一个（`.map(...)[0]`，`01-core-scales.js:543`），中文写「加清角变宫」、英文却只写 `+ BianZhi`；
- 另外 `state.rot5` 和 `data-rot` 分支（`60-main.js:72`）没有任何 UI 会生成 `data-rot`，纯遗留。

### 3. 带拍号的谱面丢标签、丢违规红点（进行台 100% 中招）

`drawStaffMetered()` 画音符/休止/延音线，但**不画 `g.label` / `g.sub` / `g.warn`**（对比 `drawStaff` 的 99–108 行有画；探针实测：带 meter 时输出里 `class="lab"`、`class="cnm"`、`class="warn"` 全部消失）。而进行台永远走 metered 路径（`47-ui-deck.js:457` 固定传 `meter: deckMeter()`，且所有槽都带 `dur`），所以：

- 进行台谱面上**从来看不到级数标签（I、ii…）和和弦记号**；
- 四部和声的违规红点也画不出来——`deckStaffGroups`（`47-ui-deck.js:482`）把 `warn` 挂到组上、README 写明「违规在谱面上打点」，实际全被 metered 分支吞掉，只有提示行里的文字还有效。

---

## 🟡 中等

### 4. 进行台无视「五度叠置」设置：筹码标签和实际内容对不上

五声选了「和弦构成 = 五度叠置」后：底部筹码行走 `chordOf(m, i)`（无 size → 走 quintal，`47-ui-deck.js:250`）显示「宫 = C G D A」；但点进槽位后 `slotChord()` 传了显式 size（`47-ui-deck.js:52`），而 `chordDegrees` 的五度分支要求 `!want`（`02-core-chords.js:88`）→ 实际渲染/播放/导出的是三度叠置的 **C E A**。探针实测 `match: false`。

### 5. 变形激活时，排列/转位/主和弦试听播的是未变形的音

`setSpread`/`setInv`/`#btnTonic` 用 `byId(state.A)` 取音阶来发声（`60-main.js:38,46,99`），而谱面与和弦卡走 `activeMode()`（含变形）。变形滑杆动过之后：画的是变形后的音，响的是变形前的音。

### 6. 导出 SVG/PNG 在没装系统 Bravura 的机器上会变豆腐块

`EXPORT_CSS`（`50-ui-export.js:20-32`）没有 `@font-face`，SVG-as-`<img>` 也加载不了外部字体——导出走的是「本机已装 Bravura」的假设（注释里自己写了）。桌面版的 Bravura 只在 `app\fonts\` 里，**并没有装进系统**；只有碰巧装过 Dorico/Sibelius 等软件的机器能正常出字形。另外 `EXPORT_CSS` 漏了 `.brk`（四行谱直连谱号两端的短横，页面 CSS 有 `.svstaff .brk{fill:none;stroke:currentColor}`），四行谱导出后括号端头会变成默认黑色填充；`.warn` 同样缺失。

### 7. 「匈牙利大调」音级表与主流定义不符（数据问题）——【用户决定不修】

`hungM` pcs = `[0,2,4,6,7,8,11]` = C D E F♯ G A♭ B（1,2,3,♯4,5,♭6,7）。主流定义（Wikipedia、Dziuba《Ultimate Guitar Scale Bible》、Rechberger）的 Hungarian major 是 **[0,3,4,6,7,9,10]** = C D♯ E F♯ G A B♭（1,♯2,3,♯4,5,6,♭7）；app 的这份其实是「Lydian ♭6」。个别来源（GuitarMasterClass）确实把它叫 Hungarian Major，属命名口径分歧，**经用户确认保持现状不改**。

---

## 🟢 轻微 / 代码卫生

### 8. 距离百分比能超过 100

`distance()` 按 score/8 折算（`03-core-theory.js:24`），最极端的 wt0↔wt1 实测 pct=150，对比页会显示「150 / 100」。

### 9. SATB 打分的三个小瑕疵（`07-core-satb.js:28-33`，都不影响排序、只影响可读性/精度）

- `fifth = pcs[2]` 对五度叠置顺序的 tones 会取错（把九音当五音）；
- `sevPc` 恒为 root+11，而 `isSev` 认 root+10——属七和弦全体候选被白加 18 分（均匀罚分不改变排序，但「省略七音」的候选没被真正惩罚）；
- 无三度和弦（如 sus）被统一罚 18 分「缺三音」。

### 10. 死代码

- `noteOfMidi`（`47-ui-deck.js:103-109`，无人调用，且兜底 `SHARP_ORDER.indexOf(CHROM_SHARP[pc])` 拿字符串查数字数组恒为 -1，永远拼成 C）；
- `HASH_KEYS`（`50-ui-export.js:135`）；
- `rot5`/`data-rot`（见 #2）。

### 11. `octaveFor` 只搜 1–8 组（`00-core-pitch.js:74`）

MIDI 21–23（A0/B0）会被标成八度 1。现有 UI 够不着，仅防御性提醒。

### 12. Host.cs 恢复窗口尺寸强制 ≥900×scale 宽（`Host.cs:779`）

小屏用户上次的窄窗口会被撑大（随后又被 ClampToScreen 夹回），与 `MinimumSize` 允许的更小值自相矛盾。

### 13. `state.B` 绕过 `store.set`（`42-ui-list.js:99`）

靠 `saveSession` 兜底能落盘，但和旁边 `data-a` 走 `switchMode` 的写法不一致（A 走持久化订阅，B 不触发订阅者）。

---

## ✅ 查过没问题的（阴性结果）

- **拼写引擎**：60 调式 × 12 主音共 720 组拼写，字母+升降号与绝对音高全部一致，无双重升降号越界；调号始终在 ±7 内。
- **调号系统**：升/降号在线谱上的 14 个标准位（`SHARP_STEP`/`FLAT_STEP`）逐一对照无误；五声「按宫定调号」（商调式主音 C → Bb 宫 → 2 个降号）与 `gongTonic` 五组字母/半音推算全部正确。
- **和弦/排列**：全调式 × 全级 × size 2–5 × 全转位 × 密集/开放，共数万组：音程表首项恒为 0、开放排列逐音上抬不回降、转位不改变音高类集合。
- **四部和声 DP**：14,280 组声部候选全部 S>A>T>B 且在声部域内；I–vi–IV–V–VI–ii–V–I 整条零违规（平行/隐伏五八、导音、七音、间距、三全音跳进全避开）。
- **节奏切分**：2/3/4 拍号 × pos 0–24 × len 1–12 × 有无附点：总长守恒、不跨小节线、附点二分只在拍头、全音符只占整小节。
- **MIDI 导出**：字节级解析通过（format 0、轨长、EOT 位置、note on/off 配对），中文轨名 >127 字节的 VLQ 修复有效（240 字节编码正确）。
- **五度叠置链**：五条五声的 宫→徵→商→羽→角 全是纯五度。
- **URL 编解码**：v2 信封与旧版 `d=` 格式的防御性解析齐全。
- **构建链**：`build.mjs` 产物与 `index.html` 逐字节一致；`发版.mjs` 的 14 套测试清单与 tests/ 目录一致。
- **桌面壳**：单实例互斥按数据目录区分、用户数据目录三级回退、下载接管、DPI 清单都相当细致。

## 参考来源

- [Wikipedia — Hungarian major scale](https://en.wikipedia.org/wiki/Hungarian_major_scale)
- [Creative Guitar Studio — Hungarian Major](https://creativeguitarstudio.blogspot.com/2014/12/exotic-melody-and-hungarian-major-scale.html)
- [sonid.app — Hungarian major](https://sonid.app/en/scale/g/hungarian-major)
