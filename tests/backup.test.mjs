/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
// 备份格式：只认 mlab- 前缀、带 format/version，坏文件一律拒绝
// 跑法：node tests/backup.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const js = readFileSync(join(here, "..", "src", "js", "52-ui-backup.js"), "utf8");

const prelude = `
const localStorage = { _d: {},
  get length(){ return Object.keys(this._d).length; },
  key(i){ const k = Object.keys(this._d)[i]; return k === undefined ? null : k; },
  getItem(k){ return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v){ this._d[k] = String(v); },
  removeItem(k){ delete this._d[k]; } };
const window = {};
const document = { querySelector(){ return null; } };
`;
const api = new Function(prelude + js + `
return { backupPayload, parseBackup, applyBackup, backupEntries, storageChars,
         clearBackupData, backupFileName, BACKUP_FORMAT, BACKUP_VERSION, ls: localStorage };`)();

const ls = api.ls;
function fresh(){ api.clearBackupData(); ls.removeItem("other-site"); }

test("导出快照只带 mlab- 前缀", () => {
  fresh();
  ls.setItem("mlab-tone", "5");
  ls.setItem("mlab-deck", "[]");
  ls.setItem("other-site", "x");
  const p = api.backupPayload("1.1.1");
  assert.equal(p.format, api.BACKUP_FORMAT);
  assert.equal(p.version, api.BACKUP_VERSION);
  assert.equal(p.appVersion, "1.1.1");
  assert.deepEqual(Object.keys(p.entries).sort(), ["mlab-deck", "mlab-tone"]);
});

test("导出再导入，条目原样回来", () => {
  fresh();
  ls.setItem("mlab-a4", "442");
  const p = api.backupPayload("1.1.1");
  api.clearBackupData();
  assert.equal(api.storageChars(), 0);
  const back = api.parseBackup(JSON.stringify(p));
  assert.equal(back.ok, true);
  assert.equal(back.count, 1);
  api.applyBackup(back.entries);
  assert.equal(ls.getItem("mlab-a4"), "442");
});

test("拒绝不是本程序的 JSON", () => {
  assert.equal(api.parseBackup("{}").ok, false);
  assert.equal(api.parseBackup("not json").ok, false);
  assert.equal(api.parseBackup(JSON.stringify({ format: "x" })).ok, false);
});

test("拒绝未来版本", () => {
  const r = api.parseBackup(JSON.stringify({
    format: api.BACKUP_FORMAT, version: 99, entries: {} }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /更新/);
});

test("非 mlab- 键与非法值被丢弃", () => {
  const r = api.parseBackup(JSON.stringify({
    format: api.BACKUP_FORMAT, version: 1,
    entries: { "mlab-tone": "3", "evil": "x", "mlab-bad key": "y", "mlab-num": 5 } }));
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.entries), ["mlab-tone"]);
});

test("恢复出厂只清 mlab-，不动其他数据", () => {
  fresh();
  ls.setItem("mlab-theme", "light");
  ls.setItem("other-site", "keep");
  const n = api.clearBackupData();
  assert.equal(n, 1);
  assert.equal(ls.getItem("other-site"), "keep");
  assert.equal(ls.getItem("mlab-theme"), null);
});

test("备份文件名带版本与时间", () => {
  assert.match(api.backupFileName("1.1.1"), /^幻歌鸟调色盘-备份-1\.1\.1-\d{8}-\d{4}\.json$/);
});
