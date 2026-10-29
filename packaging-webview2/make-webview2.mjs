/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 *
 * 打 WebView2 版：node make-webview2.mjs [--dist]
 *   1. 跑上级目录的 build.mjs（网页版）
 *   2. 把 index.html 与 fonts/ 拷进 app/
 *   3. 用系统自带的 csc.exe 编 Host.cs（.NET Framework 4.8）
 *   4. 把 WebView2 的两个托管 DLL 与 WebView2Loader.dll 摆到输出目录
 *   5. --dist 时打成 幻歌鸟调色盘-<版本>-win-x64-webview2.zip
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
// --out=<目录> 可换输出目录（正在运行的程序会锁住 out\ 里的 exe）
const outArg = process.argv.find(a => a.startsWith("--out="));
const out = path.resolve(here, outArg ? outArg.slice(6) : "out");
const appDir = path.join(out, "app");
const nupkgDir = path.join(here, "_nuget", "x", "lib", "net462");
const loaderSrc = path.join(here, "_nuget", "x", "runtimes", "win-x64", "native", "WebView2Loader.dll");
const CSC = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
const pkg = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8"));
// 版本号以根目录 VERSION 为准（发版时只改那一处）
const versionFile = path.join(root, "VERSION");
const version = fs.existsSync(versionFile)
  ? fs.readFileSync(versionFile, "utf8").trim()
  : pkg.version;
const NO_BUILD = process.argv.includes("--no-build");

function step(msg) { console.log("· " + msg); }
function die(msg) { console.error("✗ " + msg); process.exit(1); }

if (!fs.existsSync(CSC)) die("找不到 csc.exe（.NET Framework 4.8 应当自带）");
for (const f of ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll"]) {
  if (!fs.existsSync(path.join(nupkgDir, f))) die("缺少 NuGet 里的 " + f + "，先把 nupkg 解到 _nuget/x/");
}
if (!fs.existsSync(loaderSrc)) die("缺少 WebView2Loader.dll");

// 1) 网页版
if (NO_BUILD) {
  step("跳过网页版构建（--no-build，由上级 发版.mjs 负责）");
} else {
  step("构建网页版（build.mjs）");
  try {
    execFileSync(process.execPath, ["build.mjs"], { cwd: root, stdio: "inherit" });
  } catch (e) {
    // build.mjs 末尾那句「输出里没找到 ML_BOOT 标记」是既有警告，会让退出码非零；
    // 只要 index.html 真的更新了就不算失败。
    step("build.mjs 以非零码退出（已知的最后一句警告），检查产物");
  }
}
const built = path.join(root, "index.html");
if (!fs.existsSync(built)) die("没有生成 index.html");

// 2) app 目录
//    正在运行的旧版会锁住 out\幻歌鸟调色盘.exe，rm 会 EPERM —— 重试几次再给一句人话
for (let i = 0; i < 3; i++) {
  try { fs.rmSync(out, { recursive: true, force: true }); break; } catch (e) {
    if (i === 2) {
      die("清空 " + out + " 失败：正在运行的「幻歌鸟调色盘」还开着这个 exe。\n" +
          "  把窗口关掉再发版（状态都存在本机，关掉不会丢），或者用 --out=<别的目录> 换个输出位置。");
    }
    const t = Date.now(); while (Date.now() - t < 800) { /* 等一下再试 */ }
  }
}
fs.mkdirSync(appDir, { recursive: true });
fs.copyFileSync(path.join(root, "index.html"), path.join(appDir, "index.html"));
const fontSrc = path.join(root, "fonts");
fs.mkdirSync(path.join(appDir, "fonts"), { recursive: true });
for (const f of fs.readdirSync(fontSrc)) {
  if (f.toLowerCase().endsWith(".otf") || f.toLowerCase().endsWith(".txt")) {
    fs.copyFileSync(path.join(fontSrc, f), path.join(appDir, "fonts", f));
  }
}
// 图标与品牌图（assets/：favicon、页眉徽标）+ 两份许可，跟包一起发出去
const assetSrc = path.join(root, "assets");
if (fs.existsSync(assetSrc)) {
  fs.mkdirSync(path.join(appDir, "assets"), { recursive: true });
  for (const f of fs.readdirSync(assetSrc)) {
    if (/\.(png|svg|ico|md)$/i.test(f) && !/^icon\.(png|ico)$/i.test(f)) {
      fs.copyFileSync(path.join(assetSrc, f), path.join(appDir, "assets", f));
    }
  }
}
const lic = path.join(root, "LICENSE");
if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(appDir, "LICENSE.txt"));
step("app/ 就绪：" + fs.readdirSync(appDir).join(", "));
// 3) 编译
const exeName = "幻歌鸟调色盘.exe";
const exePath = path.join(out, exeName);
const icon = path.join(here, "icon.ico");
const args = [
  "/nologo", "/target:winexe", "/platform:x64", "/optimize+", "/langversion:5",
  "/out:" + exePath,
  "/reference:System.dll", "/reference:System.Drawing.dll",
  "/reference:System.Windows.Forms.dll",
  "/reference:" + path.join(nupkgDir, "Microsoft.Web.WebView2.Core.dll"),
  "/reference:" + path.join(nupkgDir, "Microsoft.Web.WebView2.WinForms.dll"),
];
if (fs.existsSync(icon)) args.push("/win32icon:" + icon);
// 高 DPI 清单（PerMonitorV2）—— 没有它 Windows 会把窗口当 96 DPI 拉伸，页面就糊了
const manifest = path.join(here, "app.manifest");
if (!fs.existsSync(manifest)) die("缺少 app.manifest（高 DPI 清单）");
args.push("/win32manifest:" + manifest);

// 版本号只从 VERSION 来：生成一份 AssemblyInfo 跟着 Host.cs 一起编译，
// 这样 exe 属性里看到的就是发出去的版本（之前 Host.cs 写死 1.0.0.0，用户查版本只能靠猜）
const asmVer = /^\d+\.\d+\.\d+(\.\d+)?$/.test(version)
  ? (version.split(".").length === 4 ? version : version + ".0")
  : "1.0.0.0";
const asmInfo =
  "using System.Reflection;\n" +
  "[assembly: AssemblyVersion(\"" + asmVer + "\")]\n" +
  "[assembly: AssemblyFileVersion(\"" + asmVer + "\")]\n";
fs.writeFileSync(path.join(out, "AssemblyInfo.g.cs"), asmInfo, "utf8");

args.push(path.join(here, "Host.cs"));
args.push(path.join(out, "AssemblyInfo.g.cs"));
step("编译 Host.cs（版本 " + asmVer + "）");
execFileSync(CSC, args, { stdio: "inherit" });

// 4) 运行时依赖
for (const f of ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll"]) {
  fs.copyFileSync(path.join(nupkgDir, f), path.join(out, f));
}
fs.copyFileSync(loaderSrc, path.join(out, "WebView2Loader.dll"));

const kb = n => Math.round(n / 1024) + " KB";
const exeSize = fs.statSync(exePath).size;
step("产物 " + exeName + " = " + kb(exeSize));

// 5) 打包
if (process.argv.includes("--dist")) {
  const zipName = `幻歌鸟调色盘-${version}-win-x64-webview2.zip`;
  const zipPath = path.join(here, zipName);
  fs.rmSync(zipPath, { force: true });
  step("打包 " + zipName);
  if (process.platform === "win32") {
    execFileSync("powershell", ["-NoProfile", "-Command",
      `Compress-Archive -Path '${out}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal`],
      { stdio: "inherit" });
  } else {
    execFileSync("zip", ["-r", zipPath, "."], { cwd: out, stdio: "inherit" });
  }
  step("zip = " + Math.round(fs.statSync(zipPath).size / 1048576 * 10) / 10 + " MB → " + zipPath);
}

const total = fs.readdirSync(out).reduce((s, f) => {
  const p = path.join(out, f);
  const st = fs.statSync(p);
  if (st.isFile()) return s + st.size;
  return s + fs.readdirSync(p).reduce((t, g) => t + fs.statSync(path.join(p, g)).size, 0);
}, 0);
step("解开后总计 ≈ " + Math.round(total / 1048576 * 10) / 10 + " MB（含 app/ 里的网页本体）");
