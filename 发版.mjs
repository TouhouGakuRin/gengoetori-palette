/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 发版.mjs —— 一条命令做完：构建网页版 → 跑全部测试 → 打 Windows 包 → 归位到 release/
 *
 *   node 发版.mjs             完整发版（构建 + 测试 + 打包 + 归位）
 *   node 发版.mjs --fast      跳过测试（只构建 + 打包，自用快速验证）
 *   node 发版.mjs --build     只构建网页版（不改版本、不打包）
 *
 * 版本号从 VERSION 读；产物：release/幻歌鸟调色盘-<版本>-win-x64.zip + -web.zip + manifest.json
 *
 * 注：本机沙箱禁命名管道，child_process 的 stdio: "pipe" 会 EPERM。
 *     所以子进程一律把 stdout/stderr 直接写进临时文件（fd 不是管道），再从文件读。
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = new Set(process.argv.slice(2));
const FAST = argv.has("--fast");
const ONLY_BUILD = argv.has("--build");

const version = fs.readFileSync(path.join(HERE, "VERSION"), "utf8").trim();
// PR #1 之后的第二轮回归（tests/pr2-regression.test.mjs）必须进发版闸门，别漏跑
const SUITES = ["core", "key", "staff", "state", "satb", "rhythm", "map", "deck", "ear", "borrow", "settings", "link", "modules", "backup", "pr2-regression"];
const LOG_DIR = path.join(os.tmpdir(), "gengoetori-release");
fs.mkdirSync(LOG_DIR, { recursive: true });

const say = (s) => console.log(s);
const fail = (s) => { console.error("\n✗ " + s + "\n"); process.exit(1); };

/* 跑一个子进程，输出落到文件再读回来（绕开管道限制） */
function run(script, args = [], tag = "run") {
  const log = path.join(LOG_DIR, tag + ".log");
  const fd = fs.openSync(log, "w");
  let ok = true, code = 0;
  try {
    execFileSync(process.execPath, [script, ...args], { cwd: HERE, stdio: ["ignore", fd, fd] });
  } catch (e) {
    ok = false;
    code = e.status == null ? -1 : e.status;
  } finally {
    fs.closeSync(fd);
  }
  return { ok, code, out: fs.readFileSync(log, "utf8") };
}

/* ---------- 1. 构建网页版 ---------- */
say(`· 版本 ${version} — 构建网页版`);
const built = run("build.mjs", [], "build");
const builtLine = (built.out.match(/built index\.html.*/) || [""])[0];
if (!fs.existsSync(path.join(HERE, "index.html"))) fail("构建失败：没有生成 index.html\n" + built.out);
say(`  ${builtLine || "index.html 已更新"}`);

if (ONLY_BUILD) { say("\n只构建，结束。"); process.exit(0); }

/* ---------- 2. 测试 ---------- */
let totalPass = 0, totalFail = 0;
const suiteResult = [];
if (FAST) {
  say("· 跳过测试（--fast）");
} else {
  say("· 跑测试");
  for (const name of SUITES) {
    const file = path.join("tests", `${name}.test.mjs`);
    if (!fs.existsSync(path.join(HERE, file))) { suiteResult.push({ name, skip: true }); continue; }
    const r = run(file, [], "test-" + name);
    // Node 22 在非 TTY 下默认输出 TAP（# pass），老版本/TTY 是 spec（ℹ pass），两种都认
    const pass = Number((r.out.match(/(?:ℹ|#) pass (\d+)/) || [0, 0])[1]);
    const bad = Number((r.out.match(/(?:ℹ|#) fail (\d+)/) || [0, 0])[1]);
    totalPass += pass; totalFail += bad;
    /* 某套崩在汇总行之前（语法错、import 抛错）时输出里没有 pass/fail 行：
       bad 会是 0，只有 r.ok 为 false。不记进来的话测试挂了照样往下打包发版。 */
    if (!r.ok) totalFail++;
    suiteResult.push({ name, pass, fail: bad, ok: r.ok });
    say(`  ${bad === 0 && r.ok ? "✓" : "✗"} ${name.padEnd(9)} ${pass} 通过${bad ? " / " + bad + " 失败" : ""}`);
    if (bad > 0 || !r.ok) {
      console.error(r.out.split("\n").filter(l => /not ok|✖|Error|AssertionError/.test(l)).slice(0, 20).join("\n"));
    }
  }
  say(`  合计 ${totalPass} 通过 / ${totalFail} 失败`);
  if (totalFail > 0) fail("测试没全绿，不发版。");
}

/* ---------- 3. 打 Windows 包（WebView2 宿主） ---------- */
say("· 打 Windows 包（WebView2 宿主）");
const pkg = run(path.join("packaging-webview2", "make-webview2.mjs"), ["--dist", "--no-build"], "pkg");
if (!pkg.ok) { console.error(pkg.out); fail("打包失败（退出码 " + pkg.code + "）"); }
for (const line of pkg.out.split("\n")) {
  if (/^·|^zip/.test(line)) say("  " + line.replace(/^·\s*/, ""));
}
const distZip = path.join(HERE, "packaging-webview2", `幻歌鸟调色盘-${version}-win-x64-webview2.zip`);
if (!fs.existsSync(distZip)) fail("打包失败：找不到 zip\n" + pkg.out);

/* ---------- 4. 归位到 release/ ---------- */
say("· 归位到 release/");
const releaseDir = path.join(HERE, "release");
fs.mkdirSync(releaseDir, { recursive: true });
const outName = `幻歌鸟调色盘-${version}-win-x64.zip`;
const outPath = path.join(releaseDir, outName);
fs.copyFileSync(distZip, outPath);

const buf = fs.readFileSync(outPath);
const sha = crypto.createHash("sha256").update(buf).digest("hex");

/* ---------- 4b. 纯网页版 zip（index.html + 字体 + 图标） ---------- */
say("· 打纯网页版 zip");
const webStage = path.join(os.tmpdir(), "gengoetori-web-" + version);
fs.rmSync(webStage, { recursive: true, force: true });
fs.mkdirSync(webStage, { recursive: true });
for (const f of ["index.html", "LICENSE"]) fs.copyFileSync(path.join(HERE, f), path.join(webStage, f));
for (const d of ["assets", "fonts"]) {
  fs.cpSync(path.join(HERE, d), path.join(webStage, d), { recursive: true });
}
const webName = `幻歌鸟调色盘-${version}-web.zip`;
const webPath = path.join(releaseDir, webName);
fs.rmSync(webPath, { force: true });
if (process.platform === "win32") {
  execFileSync("powershell", ["-NoProfile", "-Command",
    `Compress-Archive -Path '${webStage}\\*' -DestinationPath '${webPath}' -CompressionLevel Optimal`],
    { stdio: "inherit" });
} else {
  execFileSync("zip", ["-r", webPath, "."], { cwd: webStage, stdio: "inherit" });
}
const webBuf = fs.readFileSync(webPath);
const webSha = crypto.createHash("sha256").update(webBuf).digest("hex");
say(`  ${webName}  (${(webBuf.length / 1048576).toFixed(2)} MB)`);

const exePath = path.join(HERE, "packaging-webview2", "out", "幻歌鸟调色盘.exe");
const exeSize = fs.existsSync(exePath) ? fs.statSync(exePath).size : null;

/* 提交号：直接读 .git，不调 git（子进程限制） */
function headHash() {
  try {
    const head = fs.readFileSync(path.join(HERE, ".git", "HEAD"), "utf8").trim();
    if (head.startsWith("ref: ")) {
      return fs.readFileSync(path.join(HERE, ".git", head.slice(5)), "utf8").trim().slice(0, 12);
    }
    return head.slice(0, 12);
  } catch { return null; }
}

const manifest = {
  产品: "幻歌鸟调色盘 · Gengoetori Palette",
  版本: version,
  发布: new Date().toISOString(),
  产物: outName,
  打包体积: buf.length,
  校验: { sha256: sha },
  网页版产物: webName,
  网页版体积: webBuf.length,
  网页版校验: { sha256: webSha },
  宿主: "WebView2（.NET Framework 4.8 + WinForms）",
  外壳体积: exeSize,
  测试: FAST ? "跳过" : { 套件: suiteResult, 通过: totalPass, 失败: totalFail },
  发版前提交: headHash(),
  说明: "解压即用；依赖系统 WebView2 运行时（Win10/11 自带，Win7/8 需装一次）。网页版解压后双击 index.html。",
};
fs.writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

/* ---------- 5. 小结 ---------- */
const mb = (n) => (n / 1048576).toFixed(2) + " MB";
say("");
say("────────────────────────────────────────");
say(`  版本    ${version}`);
say(`  产物    release/${outName}  (${mb(buf.length)})`);
say(`          release/${webName}  (${mb(webBuf.length)})`);
say(`  外壳    ${exeSize ? Math.round(exeSize / 1024) + " KB" : "?"}（解开后整包约 1.2 MB）`);
if (!FAST) say(`  测试    ${totalPass} 通过 / ${totalFail} 失败（${suiteResult.filter(s => !s.skip).length} 套）`);
say(`  校验    ${sha.slice(0, 16)}…`);
say("────────────────────────────────────────");
say('  下一步：git add -A && git commit -m "release ' + version + '"，再把 release/ 里的 zip 挂到 GitHub Release。');
