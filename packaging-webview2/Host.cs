/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 *
 * WebView2 外壳（.NET Framework 4.8 + 系统 WebView2 运行时）
 * 编译：csc /target:winexe /platform:x64 …（见 make-webview2.mjs）
 * 资源：app\index.html、app\fonts\Bravura.otf —— 通过虚拟主机 https://app.local/ 提供
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("幻歌鸟调色盘")]
[assembly: AssemblyDescription("幻歌鸟调色盘 · Gengoetori Palette —— 音阶色彩与音阶和弦的学习工具")]
[assembly: AssemblyProduct("幻歌鸟调色盘")]
[assembly: AssemblyCompany("TouhouGakurin")]
[assembly: AssemblyCopyright("© 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License")]
// 版本号由 make-webview2.mjs 从根目录 VERSION 生成到 AssemblyInfo.g.cs（别再写死在这里）

static class Program
{
    [DllImport("user32.dll")]
    static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    // 清单里已经写了 PerMonitorV2；这里再调一次是给「清单被剥离/系统太老」兜底。
    // 必须在建任何窗口之前调用，否则窗口已经按 96 DPI 画好，后面再调也没用。
    static void EnableHighDpi()
    {
        try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch { }
        try { if (SetProcessDpiAwarenessContext(new IntPtr(-3))) return; } catch { }
        try { SetProcessDPIAware(); } catch { }
    }

    [STAThread]
    static void Main()
    {
        EnableHighDpi();
        bool owned = false;
        // 单实例锁按「数据目录」区分：同一份程序开两次仍然只有一个窗口，
        // 但 D 盘和 U 盘各拷一份、各自带 userdata 时不会互相顶掉。
        // --fresh-profile 例外：它是从上一个实例的失败窗口里拉起来的，
        // 那个实例还握着锁，这里必须放行，否则「换新目录重开」永远打不开。
        bool fresh = false;
        foreach (string a in Environment.GetCommandLineArgs())
            if (string.Equals(a, "--fresh-profile", StringComparison.OrdinalIgnoreCase)) fresh = true;

        using (Mutex mtx = new Mutex(true, MainForm.MutexName(), out owned))
        {
            if (!owned && !fresh)
            {
                MessageBox.Show("这份「幻歌鸟调色盘」已经在运行了。", "幻歌鸟调色盘",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try
            {
                Application.Run(new MainForm());
            }
            catch (Exception ex)
            {
                MessageBox.Show("启动失败：\n\n" + ex.ToString(), "幻歌鸟调色盘",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}

class MainForm : Form
{
    const string HOST = "app.local";
    const string START_URL = "https://" + HOST + "/index.html";
    const string APP_ID = "GengoetoriPalette";

    WebView2 view = new WebView2();
    bool fullscreen = false;
    FormWindowState lastState = FormWindowState.Normal;
    Rectangle lastBounds = new Rectangle(0, 0, 1440, 940);

    static string AppDir
    {
        get { return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app"); }
    }

    // 当前屏幕的缩放比例（96 DPI = 1.0）。清单生效后拿到的就是真实 DPI。
    internal static float DpiScale()
    {
        try
        {
            using (Graphics g = Graphics.FromHwnd(IntPtr.Zero))
            {
                float d = g.DpiX / 96f;
                return d <= 0 ? 1f : d;
            }
        }
        catch { return 1f; }
    }

    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

    // 深色标题栏：不然白底标题栏架在深色页面上，一眼就是「浏览器套了个壳」
    void ApplyDarkTitleBar()
    {
        int on = 1;
        try
        {
            if (DwmSetWindowAttribute(Handle, 20, ref on, sizeof(int)) != 0)
                DwmSetWindowAttribute(Handle, 19, ref on, sizeof(int)); // Win10 1809–1909 用 19
        }
        catch { }
        try
        {
            int round = 2; // DWMWCP_ROUND
            DwmSetWindowAttribute(Handle, 33, ref round, sizeof(int));
        }
        catch { }
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        ApplyDarkTitleBar();
    }

    static string ExeDir
    {
        get { return AppDomain.CurrentDomain.BaseDirectory; }
    }

    // 便携模式：程序目录里放一个 userdata\（或 portable.flag）就把「所有」数据都写在程序旁边。
    // 没有标记文件就走系统的 %LOCALAPPDATA%，两种模式互不干扰。
    static bool PortableRequested()
    {
        try
        {
            return Directory.Exists(Path.Combine(ExeDir, "userdata"))
                || File.Exists(Path.Combine(ExeDir, "portable.flag"));
        }
        catch { return false; }
    }

    static string LocalRoot()
    {
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), APP_ID);
    }

    // 真写一个探测文件，比「能不能建目录」更接近真实的写权限
    static bool CanWrite(string dir)
    {
        try
        {
            string probe = Path.Combine(dir, ".write-probe");
            File.WriteAllText(probe, "ok");
            File.Delete(probe);
            return true;
        }
        catch { return false; }
    }

    static string dataRoot = null;
    internal static bool portableFallback = false;
    // 主目录建不起来时的真实原因，直接给用户看，不猜
    internal static string dataRootError = "";

    // 所有可变数据（窗口尺寸、日志、最近导出目录、WebView2 缓存）都从这个根下面派生：
    // 便携模式 = 程序目录\userdata；常规模式 = %LOCALAPPDATA%\GengoetoriPalette。
    // 一个目录建不起来不等于没救：按 LOCALAPPDATA → APPDATA → TEMP 依次换，选第一个真能写的。
    static string DataRoot()
    {
        if (dataRoot != null) return dataRoot;
        string exeData = Path.Combine(ExeDir, "userdata");
        string first = PortableRequested() ? exeData : LocalRoot();
        string[] fallbacks = new string[]
        {
            // 程序旁边的 userdata 永远排第一：有的机器上 %LOCALAPPDATA% 会被策略、
            // 安全软件或受限令牌挡住，而程序所在目录（桌面、文档、U 盘）通常写得进去。
            // 这条路径不通才按用户目录、临时目录依次退。
            exeData,
            LocalRoot(),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), APP_ID),
            Path.Combine(Path.GetTempPath(), APP_ID + "-data")
        };

        for (int i = 0; i < fallbacks.Length; i++)
        {
            string root = fallbacks[i];
            if (string.IsNullOrEmpty(root)) continue;
            try
            {
                Directory.CreateDirectory(root);
                if (!CanWrite(root))
                    throw new IOException("目录不可写");
                if (i > 0)
                {
                    // 记下来：这次没能在首选位置落盘，设置面板会显示更靠后的路径
                    dataRootError = "首选目录 " + first + " 建不起来，已改用 " + root;
                    portableFallback = PortableRequested();
                }
                dataRoot = root;
                return root;
            }
            catch (Exception ex)
            {
                if (i == 0) dataRootError = ex.Message;
            }
        }
        // 全部失败：仍返回首选路径，让调用方按失败处理并显示 dataRootError
        dataRoot = first;
        return first;
    }

    // 单实例锁按数据目录区分：同一份程序只能开一个，不同副本（各自的 userdata）可以并存
    internal static string MutexName()
    {
        try
        {
            string h = DataRoot().ToLowerInvariant();
            uint acc = 2166136261u;
            foreach (char c in h) { acc ^= c; acc *= 16777619u; }
            return "Local\\GengoetoriPalette." + acc.ToString("x8");
        }
        catch { return "Local\\GengoetoriPalette.default"; }
    }

    // 把数据目录告诉页面（设置面板要显示"数据在哪"），JSON 转义走最小实现
    internal static string JsonString(string s)
    {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '\\' || c == '"') sb.Append('\\').Append(c);
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }

    static string StateFile
    {
        get { return Path.Combine(DataRoot(), "window.txt"); }
    }

    // 启动日志跟数据放在一起：便携模式下拷走文件夹，日志也跟着走
    static string LogFile
    {
        get { return Path.Combine(DataRoot(), "run.log"); }
    }

    static string LastExportDirFile
    {
        get { return Path.Combine(DataRoot(), "last-export-dir.txt"); }
    }

    // 日志有两处落点：数据目录优先，写不进去就退到临时目录。
    // 数据目录建不起来时（权限、安全软件、只读介质）用户仍能拿到一份日志。
    internal static string TempLogFile
    {
        get { return Path.Combine(Path.GetTempPath(), "gengoetori-host.log"); }
    }

    internal static void Log(string msg)
    {
        string line = DateTime.Now.ToString("HH:mm:ss.fff") + "  " + msg + "\r\n";
        try
        {
            Directory.CreateDirectory(DataRoot());
            File.AppendAllText(LogFile, line, Encoding.UTF8);
            return;
        }
        catch { }
        try { File.AppendAllText(TempLogFile, line, Encoding.UTF8); }
        catch { }
    }

    static bool FreshProfile()
    {
        foreach (string a in Environment.GetCommandLineArgs())
            if (string.Equals(a, "--fresh-profile", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    // 用户数据目录，按顺序试：
    //   ① DataRoot\WebView2（便携模式下是 userdata\WebView2，跟着程序走）
    //   ② %LOCALAPPDATA%\GengoetoriPalette\WebView2（便携目录被占用时退回系统目录）
    //   ③ 临时目录（前两个都失败时兜底）
    // 0x800700AA「请求的资源在使用中」几乎总是用户数据目录被占，换一个就能起来。
    static string[] UserDataCandidates()
    {
        // --fresh-profile：跳过所有旧目录，用一个本次启动独有的临时目录。
        // 上一次的窗口/浏览器进程没退干净、或安全软件锁着旧目录时，这是唯一一定能起来的路。
        if (FreshProfile())
            return new string[] { Path.Combine(Path.GetTempPath(),
                APP_ID + "-WebView2-" + Process.GetCurrentProcess().Id) };

        string a = Path.Combine(DataRoot(), "WebView2");
        string b = Path.Combine(LocalRoot(), "WebView2");
        string c = Path.Combine(Path.GetTempPath(), APP_ID + "-WebView2");
        if (string.Equals(a, b, StringComparison.OrdinalIgnoreCase))
            return new string[] { a, c };
        return new string[] { a, b, c };
    }

    static bool WebViewRuntimePresent()
    {
        try
        {
            string v = CoreWebView2Environment.GetAvailableBrowserVersionString();
            return !string.IsNullOrEmpty(v);
        }
        catch { return false; }
    }

    // 失败说明做成可复制、可打开数据目录的窗口：用户把这段贴出来就够定位，不用猜 run.log 在哪
    static void ShowFatal(string headline, string body)
    {
        ShowFatal(headline, body, false);
    }

    static void ShowFatal(string headline, string body, bool offerFresh)
    {
        using (Form f = new Form())
        {
            f.Text = "幻歌鸟调色盘";
            f.StartPosition = FormStartPosition.CenterScreen;
            f.ClientSize = new Size(640, 440);
            f.MinimumSize = new Size(480, 320);
            f.BackColor = ColorTranslator.FromHtml("#14181e");
            f.ForeColor = ColorTranslator.FromHtml("#d8dee9");
            f.Font = new Font("Microsoft YaHei UI", 9f);

            Label head = new Label();
            head.Text = headline;
            head.Dock = DockStyle.Top;
            head.Height = 34;
            head.Font = new Font("Microsoft YaHei UI", 11f, FontStyle.Bold);
            head.ForeColor = Color.White;
            head.Padding = new Padding(12, 8, 12, 0);

            TextBox text = new TextBox();
            text.Multiline = true;
            text.ReadOnly = true;
            text.ScrollBars = ScrollBars.Vertical;
            text.Dock = DockStyle.Fill;
            text.BackColor = ColorTranslator.FromHtml("#0f1318");
            text.ForeColor = ColorTranslator.FromHtml("#c8d0da");
            text.BorderStyle = BorderStyle.FixedSingle;
            text.Font = new Font("Consolas", 9f);
            text.Text = body;

            Panel pad = new Panel();
            pad.Dock = DockStyle.Fill;
            pad.Padding = new Padding(12, 6, 12, 8);
            pad.Controls.Add(text);

            FlowLayoutPanel bar = new FlowLayoutPanel();
            bar.Dock = DockStyle.Bottom;
            bar.Height = 50;
            bar.FlowDirection = FlowDirection.RightToLeft;
            bar.Padding = new Padding(12, 10, 12, 10);
            bar.BackColor = ColorTranslator.FromHtml("#14181e");

            Button close = new Button();
            close.Text = "关闭";
            close.Size = new Size(84, 28);
            close.FlatStyle = FlatStyle.Flat;
            close.Click += delegate { f.Close(); };

            Button copy = new Button();
            copy.Text = "复制详情";
            copy.Size = new Size(92, 28);
            copy.FlatStyle = FlatStyle.Flat;
            copy.Click += delegate
            {
                try { Clipboard.SetText(headline + "\r\n\r\n" + body); copy.Text = "已复制"; }
                catch { }
            };

            Button open = new Button();
            open.Text = "打开数据目录";
            open.Size = new Size(108, 28);
            open.FlatStyle = FlatStyle.Flat;
            open.Click += delegate
            {
                try { System.Diagnostics.Process.Start("explorer.exe", "\"" + DataRoot() + "\""); }
                catch { }
            };

            bar.Controls.Add(close);
            bar.Controls.Add(copy);
            bar.Controls.Add(open);

            if (offerFresh)
            {
                Button fresh = new Button();
                fresh.Text = "换新目录重开";
                fresh.Size = new Size(112, 28);
                fresh.FlatStyle = FlatStyle.Flat;
                fresh.Click += delegate
                {
                    try
                    {
                        System.Diagnostics.Process.Start(
                            System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName,
                            "--fresh-profile");
                        f.Close();
                    }
                    catch { }
                };
                bar.Controls.Add(fresh);
            }

            f.Controls.Add(pad);
            f.Controls.Add(bar);
            f.Controls.Add(head);
            f.AcceptButton = close;
            f.ShowDialog();
        }
    }

    public MainForm()
    {
        Text = "幻歌鸟调色盘";
        BackColor = ColorTranslator.FromHtml("#14181e");
        StartPosition = FormStartPosition.CenterScreen;

        // 尺寸按当前屏幕的 DPI 换算：清单生效后窗口是「物理像素」，不乘就会在 150% 屏上显得很小。
        // 但乘完必须夹进工作区——1080p@150% 时 1440×940 会变成 2160×1410，标题栏直接跑到屏幕外。
        float s = DpiScale();
        Rectangle wa = Screen.PrimaryScreen.WorkingArea;
        int minW = Math.Min((int)(900 * s), Math.Max(640, wa.Width - 80));
        int minH = Math.Min((int)(620 * s), Math.Max(480, wa.Height - 80));
        MinimumSize = new Size(minW, minH);
        Size = new Size(Math.Max(minW, Math.Min((int)(1440 * s), wa.Width)),
                        Math.Max(minH, Math.Min((int)(940 * s), wa.Height)));
        KeyPreview = true;
        LoadState();

        view.Dock = DockStyle.Fill;
        view.DefaultBackgroundColor = ColorTranslator.FromHtml("#14181e");
        Controls.Add(view);

        try
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        }
        catch { }

        Load += OnLoad;
        FormClosing += OnClosing;
    }

    async void OnLoad(object sender, EventArgs e)
    {
        Log("== start, exe=" + Application.ExecutablePath + " app=" + AppDir);
        if (!Directory.Exists(AppDir) || !File.Exists(Path.Combine(AppDir, "index.html")))
        {
            Log("! app/index.html missing");
            MessageBox.Show("程序缺少 app\\index.html，请重新解压后再运行。", "幻歌鸟调色盘",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }

        string[] tries = UserDataCandidates();
        Exception lastError = null;
        bool ok = false;
        string usedDir = "";
        List<string> tried = new List<string>();

        foreach (string dir in tries)
        {
            // Ensure 失败过的控件不能复用，每次都换一个新的
            WebView2 v = new WebView2();
            v.Dock = DockStyle.Fill;
            v.DefaultBackgroundColor = ColorTranslator.FromHtml("#14181e");
            Controls.Remove(view);
            try { view.Dispose(); } catch { }
            view = v;
            Controls.Add(v);

            try
            {
                Log("try userdata=" + dir);
                // 先自己建目录：建不出来是权限问题，建得出来还失败才是运行时问题。
                // 这两种情况以前都只报 0x800700AA，根本分不清。
                try { Directory.CreateDirectory(dir); Log("mkdir ok " + dir); }
                catch (Exception mex)
                {
                    Log("! mkdir failed " + dir + " :: " + mex.Message);
                    if (!ok && lastError == null) lastError = mex;
                }
                // 同一目录偶发被安全软件短暂锁住，等半秒重试两次通常就过去了
                for (int attempt = 1; attempt <= 3 && !ok; attempt++)
                {
                    try
                    {
                        CoreWebView2Environment env =
                            await CoreWebView2Environment.CreateAsync(null, dir, null);
                        await v.EnsureCoreWebView2Async(env);
                        ok = true;
                        usedDir = dir;
                        lastError = null;
                        Log("core ready, userdata=" + dir + (attempt > 1 ? " (retry " + attempt + ")" : ""));
                    }
                    catch (Exception ex)
                    {
                        // C# 5 不允许在 catch 里 await，重试的等待放到 catch 外面
                        lastError = ex;
                        Log("! attempt " + attempt + " failed at " + dir + " :: " + ex.Message);
                    }
                    if (!ok && attempt < 3) await Task.Delay(400);
                }
            }
            catch (Exception ex)
            {
                lastError = ex;
                Log("! failed at " + dir + " :: " + ex.Message);
            }
            if (!ok && lastError != null)
                tried.Add(dir + "\n      → " + lastError.Message);
            if (ok) break;
        }

        if (!ok)
        {
            bool hasRuntime = WebViewRuntimePresent();
            bool dataOk = true;
            try { Directory.CreateDirectory(DataRoot()); }
            catch { dataOk = false; }

            string head = !dataOk ? "数据目录建不起来"
                        : (hasRuntime ? "WebView2 内核没起来" : "这台机器缺少 WebView2 运行时");

            string body;
            if (!dataOk)
            {
                body = "程序要把设置、进行台和浏览器数据存在一个可写目录里，但这个目录建不起来：\n   " +
                       DataRoot() + "\n\n" +
                       "原因：" + (dataRootError == "" ? "未知（目录不可写）" : dataRootError) + "\n\n" +
                       "常见原因是目录属于管理员、被安全软件锁住，或程序放在只读位置（光盘、只读 U 盘）。\n" +
                       "把程序解压到「文档」或桌面这类可写位置再打开即可。\n\n";
            }
            else if (dataRootError != "")
            {
                body = "首选数据目录建不起来，已经退到别处。原因：\n   " + dataRootError + "\n\n" +
                       "现在用的目录：" + DataRoot() + "\n\n" +
                       "运行时在，但内核初始化失败。\n\n" +
                       "① 先关掉所有「幻歌鸟调色盘」窗口；② 在任务管理器里结束残留的\n" +
                       "   msedgewebview2.exe；③ 再打开。安全软件（尤其是「文件夹保护」）也可能锁住数据目录。\n\n";
            }
            else if (hasRuntime)
            {
                body = "运行时在，但内核初始化失败。\n\n" +
                       "① 先关掉所有「幻歌鸟调色盘」窗口；② 在任务管理器里结束残留的\n" +
                       "   msedgewebview2.exe；③ 再打开。安全软件（尤其是「文件夹保护」）也可能锁住数据目录。\n\n";
            }
            else
            {
                body = "这个包用系统里的 WebView2 运行时显示界面，装一次以后就不用再管。\n" +
                       "微软官方下载（约 2 MB）：\n  https://go.microsoft.com/fwlink/p/?LinkId=2124703\n" +
                       "装完重新打开本程序即可；装不了的话，浏览器版 index.html 功能一样。\n\n";
            }

            body += "已经试过这些用户数据目录：\n   " + string.Join("\n   ", tried.Count > 0 ? tried.ToArray() : tries) + "\n\n" +
                    "日志：" + (File.Exists(TempLogFile) ? TempLogFile : LogFile) + "\n" +
                    "数据目录：" + DataRoot() +
                    (portableFallback ? "\n\n注意：便携目录不可写，已退回用户目录，数据不会跟着程序文件夹走。" : "") +
                    "\n\n仍然打不开时：点下面的「换新目录重开」，程序会用本次启动独有的临时目录重试，不碰旧数据。";

            Log("FATAL " + head + " :: " + (lastError == null ? "" : lastError.Message) +
                (dataRootError == "" ? "" : " | dataRoot: " + dataRootError));
            // TextBox 只认 \r\n，只写 \n 会整段挤成一行
            ShowFatal(head, body.Replace("\r\n", "\n").Replace("\n", "\r\n"), true);
            Close();
            return;
        }

        CoreWebView2 core = view.CoreWebView2;
        core.SetVirtualHostNameToFolderMapping(HOST, AppDir, CoreWebView2HostResourceAccessKind.Allow);
        core.Settings.AreDefaultContextMenusEnabled = false;   // 右键菜单是浏览器味最重的一样东西
        core.Settings.AreDevToolsEnabled = true;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsSwipeNavigationEnabled = false;
        core.Settings.AreBrowserAcceleratorKeysEnabled = false;
        core.DownloadStarting += OnDownload;
        core.NewWindowRequested += OnNewWindow;
        core.DocumentTitleChanged += OnTitle;

        view.CoreWebView2.NavigationCompleted += (s, ev) =>
        {
            Log(ev.IsSuccess ? "navigation ok" : ("! navigation failed :: " + ev.WebErrorStatus));
            if (!ev.IsSuccess) return;
            try
            {
                // 页面拿这两个值在设置里显示真实落盘位置与模式，不靠猜
                string js = "window.__ML_DATA_ROOT__=" + JsonString(DataRoot()) +
                            ";window.__ML_PORTABLE__=" + (PortableRequested() && !portableFallback ? "true" : "false") + ";";
                core.ExecuteScriptAsync(js);
            }
            catch { }
        };
        view.Source = new Uri(START_URL);
        Log("navigating to " + START_URL);
        // 页面自己会按 WebView2 的 rasterization scale 渲染；宿主 DPI 感知后这里不用再管
        view.Focus();
    }

    void OnTitle(object sender, object e)
    {
        string t = view.CoreWebView2.DocumentTitle;
        Text = string.IsNullOrEmpty(t) ? "幻歌鸟调色盘" : t;
    }

    void OnNewWindow(object sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        // 站外链接交给系统浏览器，站内的在新窗口里开不了就原地导航
        e.Handled = true;
        try
        {
            if (e.Uri.StartsWith("https://" + HOST + "/", StringComparison.OrdinalIgnoreCase))
            {
                view.Source = new Uri(e.Uri);
            }
            else
            {
                System.Diagnostics.Process.Start(e.Uri);
            }
        }
        catch { }
    }

    void OnDownload(object sender, CoreWebView2DownloadStartingEventArgs e)
    {
        string suggested = e.ResultFilePath;
        string ext = Path.GetExtension(suggested);
        string name = Path.GetFileName(suggested);
        if (string.IsNullOrEmpty(name)) name = "幻歌鸟调色盘-导出" + ext;

        try
        {
            using (SaveFileDialog dlg = new SaveFileDialog())
            {
                dlg.Title = "保存";
                dlg.FileName = name;
                dlg.InitialDirectory = LastExportDir();
                if (string.Equals(ext, ".svg", StringComparison.OrdinalIgnoreCase))
                    dlg.Filter = "SVG 矢量图 (*.svg)|*.svg|所有文件 (*.*)|*.*";
                else if (string.Equals(ext, ".png", StringComparison.OrdinalIgnoreCase))
                    dlg.Filter = "PNG 图片 (*.png)|*.png|所有文件 (*.*)|*.*";
                else if (string.Equals(ext, ".mid", StringComparison.OrdinalIgnoreCase))
                    dlg.Filter = "MIDI 文件 (*.mid)|*.mid|所有文件 (*.*)|*.*";
                else
                    dlg.Filter = "所有文件 (*.*)|*.*";

                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    e.ResultFilePath = dlg.FileName;
                    e.Handled = true;
                    RememberExportDir(Path.GetDirectoryName(dlg.FileName));
                }
                else
                {
                    e.Cancel = true;
                    e.Handled = true;
                }
            }
        }
        catch (Exception ex)
        {
            Log("! save dialog failed :: " + ex.Message);
            e.Cancel = true;
            e.Handled = true;
            MessageBox.Show("保存对话框打不开：" + ex.Message +
                "\n\n可以先在浏览器版里导出，功能一样。", "幻歌鸟调色盘",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    static string LastExportDir()
    {
        try
        {
            if (File.Exists(LastExportDirFile))
            {
                string d = File.ReadAllText(LastExportDirFile, Encoding.UTF8).Trim();
                if (d.Length > 0 && Directory.Exists(d)) return d;
            }
        }
        catch { }
        return Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
    }

    static void RememberExportDir(string dir)
    {
        try
        {
            if (!string.IsNullOrEmpty(dir))
                File.WriteAllText(LastExportDirFile, dir, Encoding.UTF8);
        }
        catch { }
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (keyData == Keys.F12)
        {
            try { view.CoreWebView2.OpenDevToolsWindow(); } catch { }
            return true;
        }
        if (keyData == Keys.F11)
        {
            ToggleFullscreen();
            return true;
        }
        if (keyData == Keys.Escape && fullscreen)
        {
            ToggleFullscreen();
            return true;
        }
        if (keyData == (Keys.Control | Keys.R) || keyData == Keys.F5)
        {
            try { view.CoreWebView2.Reload(); } catch { }
            return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    void ToggleFullscreen()
    {
        if (!fullscreen)
        {
            lastState = WindowState;
            lastBounds = Bounds;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            fullscreen = true;
        }
        else
        {
            FormBorderStyle = FormBorderStyle.Sizable;
            WindowState = lastState;
            Bounds = lastBounds;
            fullscreen = false;
        }
    }

    void LoadState()
    {
        try
        {
            if (!File.Exists(StateFile)) return;
            string[] p = File.ReadAllText(StateFile, Encoding.UTF8).Split(',');
            if (p.Length >= 5)
            {
                int x, y, w, h;
                if (int.TryParse(p[0], out x) && int.TryParse(p[1], out y) &&
                    int.TryParse(p[2], out w) && int.TryParse(p[3], out h))
                {
                    // 信任存档尺寸：MinimumSize 在构造里已设好，WinForms 会自己夹；
                    // 不再强制抬到 900×620 的 DPI 倍数，小屏用户上次的窄窗口不该被撑大。
                    Rectangle r = new Rectangle(x, y, w, h);
                    // 换屏、拔掉副屏、改缩放之后，旧坐标可能落在屏幕外——一律夹回可见区域
                    Bounds = ClampToScreen(r);
                }
                if (p[4] == "1") WindowState = FormWindowState.Maximized;
            }
        }
        catch { }
    }

    // 屏幕已经不在（拔了副屏）时回到主屏；窗口比工作区大时缩到工作区，标题栏永远留在屏幕里
    static Rectangle ClampToScreen(Rectangle r)
    {
        Screen best = Screen.PrimaryScreen;
        int bestArea = -1;
        foreach (Screen s in Screen.AllScreens)
        {
            Rectangle hit = Rectangle.Intersect(s.WorkingArea, r);
            int area = hit.Width * hit.Height;
            if (area > bestArea) { bestArea = area; best = s; }
        }
        Rectangle wa = best.WorkingArea;
        r.Width = Math.Min(r.Width, wa.Width);
        r.Height = Math.Min(r.Height, wa.Height);
        r.X = Math.Min(Math.Max(r.X, wa.Left), wa.Right - r.Width);
        r.Y = Math.Min(Math.Max(r.Y, wa.Top), wa.Bottom - r.Height);
        return r;
    }

    void SaveState()
    {
        try
        {
            Rectangle r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            string line = string.Format("{0},{1},{2},{3},{4}",
                r.X, r.Y, r.Width, r.Height,
                WindowState == FormWindowState.Maximized ? "1" : "0");
            File.WriteAllText(StateFile, line, Encoding.UTF8);
        }
        catch { }
    }

    void OnClosing(object sender, FormClosingEventArgs e)
    {
        SaveState();
        try { view.Dispose(); } catch { }
    }
}
