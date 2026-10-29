/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* ---------- 5x. 备份与恢复 ----------
 * 桌面版的数据在 userdata\ 或 %LOCALAPPDATA%\GengoetoriPalette 里，用户看不见也搬不走。
 * 这里把「所有 mlab- 开头的键」打包成一个带格式与版本号的 JSON：
 *   - 导出 = 快照，换机器/重装前先存一份
 *   - 导入 = 整体覆盖，只覆盖 mlab- 前缀，不碰别的站点数据
 * 纯函数（backupPayload / parseBackup）不碰 DOM，测试直接调。
 */
const BACKUP_FORMAT = "gengoetori-palette-backup";
const BACKUP_VERSION = 1;
const BACKUP_PREFIX = "mlab-";
const BACKUP_MAX_BYTES = 4 * 1024 * 1024;
const BACKUP_MAX_KEYS = 300;
const APP_VERSION = "__VERSION__";   // 构建时由 build.mjs 注入

/* 当前所有应用键（进行台、设置、视图、会话都在里面） */
function backupEntries(){
  const out = {};
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.indexOf(BACKUP_PREFIX) === 0) out[k] = localStorage.getItem(k);
    }
  }catch(_){}
  return out;
}

/* 估算体积：localStorage 按 UTF-16 存，这里报字符数，界面上说"约" */
function storageChars(){
  let n = 0;
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(!k || k.indexOf(BACKUP_PREFIX) !== 0) continue;
      n += k.length + (localStorage.getItem(k) || "").length;
    }
  }catch(_){}
  return n;
}

function backupPayload(appVersion){
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "幻歌鸟调色盘 · Gengoetori Palette",
    appVersion: String(appVersion || ""),
    exportedAt: new Date().toISOString(),
    entries: backupEntries(),
  };
}

/* 解析并校验；不认识的一律拒绝，不做"尽力而为"的猜测 */
function parseBackup(text){
  let data;
  try{ data = JSON.parse(text); }
  catch(_){ return { ok:false, reason:"不是合法的 JSON 文件" }; }
  if(!data || typeof data !== "object" || Array.isArray(data))
    return { ok:false, reason:"文件内容不是对象" };
  if(data.format !== BACKUP_FORMAT)
    return { ok:false, reason:"不是幻歌鸟调色盘的备份文件" };
  if(typeof data.version !== "number" || data.version < 1)
    return { ok:false, reason:"备份缺少版本号" };
  if(data.version > BACKUP_VERSION)
    return { ok:false, reason:`备份来自更新的版本（v${data.version}），请先升级程序` };
  const src = data.entries;
  if(!src || typeof src !== "object" || Array.isArray(src))
    return { ok:false, reason:"备份里没有数据条目" };

  const keys = Object.keys(src);
  if(keys.length > BACKUP_MAX_KEYS)
    return { ok:false, reason:"备份条目过多，疑似不是本程序的备份" };

  const out = {};
  let chars = 0;
  for(const k of keys){
    if(typeof k !== "string" || k.indexOf(BACKUP_PREFIX) !== 0) continue;
    if(!/^mlab-[a-z0-9-]+$/i.test(k)) continue;
    const v = src[k];
    if(v !== null && typeof v !== "string") continue;
    chars += k.length + String(v == null ? "" : v).length;
    if(chars > BACKUP_MAX_BYTES) return { ok:false, reason:"备份体积超限" };
    out[k] = v;
  }
  return {
    ok:true,
    entries: out,
    count: Object.keys(out).length,
    appVersion: String(data.appVersion || ""),
    exportedAt: String(data.exportedAt || ""),
  };
}

function applyBackup(entries){
  if(!entries) return 0;
  let n = 0;
  Object.keys(entries).forEach(k => {
    try{ localStorage.setItem(k, entries[k] == null ? "" : entries[k]); n++; }
    catch(_){}
  });
  return n;
}

function clearBackupData(){
  let n = 0;
  try{
    const keys = [];
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.indexOf(BACKUP_PREFIX) === 0) keys.push(k);
    }
    keys.forEach(k => { try{ localStorage.removeItem(k); n++; }catch(_){} });
  }catch(_){}
  return n;
}

function backupFileName(appVersion){
  const d = new Date();
  const p = n => (n < 10 ? "0" : "") + n;
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return `幻歌鸟调色盘-备份-${appVersion || "app"}-${stamp}.json`;
}

/* ---------- 界面接线 ---------- */
function dataWhereText(){
  const root = typeof window !== "undefined" ? window.__ML_DATA_ROOT__ : null;
  const portable = typeof window !== "undefined" ? window.__ML_PORTABLE__ : null;
  if(root){
    return `数据位置：${root}${portable ? "（便携模式，整个文件夹拷走就带走）" : "（普通模式，存在这台机器的用户目录）"}`;
  }
  return "数据位置：网页版存在浏览器里；桌面版在 userdata\\（便携）或 %LOCALAPPDATA%\\GengoetoriPalette（普通）";
}

function refreshDataPanel(){
  const where = $("#dataWhere");
  if(where) where.textContent = dataWhereText();
  const size = $("#dataSize");
  if(size){
    const n = storageChars();
    size.textContent = n
      ? `已存 ${Object.keys(backupEntries()).length} 项，约 ${(n / 1024).toFixed(1)} KB${APP_VERSION ? " · 版本 " + APP_VERSION : ""}`
      : "还没有保存过设置或进行台";
  }
}

function exportBackup(){
  const payload = backupPayload(APP_VERSION);
  const text = JSON.stringify(payload, null, 2);
  try{
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName(payload.appVersion);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if(typeof toast === "function") toast(`已导出 ${Object.keys(payload.entries).length} 项备份`);
  }catch(err){
    if(typeof toast === "function") toast("导出失败：" + (err && err.message ? err.message : "未知错误"));
  }
}

function importBackupFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseBackup(String(reader.result || ""));
    if(!parsed.ok){
      if(typeof toast === "function") toast("导入失败：" + parsed.reason);
      return;
    }
    const when = parsed.exportedAt ? parsed.exportedAt.slice(0, 10) : "未知日期";
    const ok = confirm(`导入 ${parsed.count} 项数据（导出于 ${when}${parsed.appVersion ? "，版本 " + parsed.appVersion : ""}）？\n\n当前设置与进行台会被整体覆盖。`);
    if(!ok) return;
    const n = applyBackup(parsed.entries);
    if(typeof toast === "function") toast(`已导入 ${n} 项，正在重新载入…`);
    setTimeout(() => location.reload(), 600);
  };
  reader.onerror = () => {
    if(typeof toast === "function") toast("读取文件失败");
  };
  reader.readAsText(file, "utf-8");
}

function resetAllData(){
  const ok = confirm("恢复出厂设置会清空本机的音阶选择、进行台、主题和全部偏好。\n\n建议先「导出备份」。确定继续？");
  if(!ok) return;
  const n = clearBackupData();
  if(typeof toast === "function") toast(`已清空 ${n} 项，正在重新载入…`);
  setTimeout(() => location.reload(), 600);
}

function bindData(){
  const exp = $("#dataExport");
  if(exp) exp.onclick = exportBackup;
  const inp = $("#dataImport");
  const file = $("#dataFile");
  if(inp && file) inp.onclick = () => file.click();
  if(file) file.onchange = () => {
    const f = file.files && file.files[0];
    importBackupFile(f);
    file.value = "";
  };
  const rst = $("#dataReset");
  if(rst) rst.onclick = resetAllData;
  refreshDataPanel();
}
