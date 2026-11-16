using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace AlMaraseem.Desktop
{
    public class LauncherForm : Form
    {
        private Label lblTitle;
        private Label lblSubtitle;
        private Label lblStatus;
        private ProgressBar progressBar;
        private string projectRoot = "";
        private int checkCount = 0;
        private const string CLOUD_URL = "https://system-ok9k.vercel.app/login";

        public LauncherForm()
        {
            InitializeComponent();
            DetermineProjectRoot();
            StartServerAndApp();
        }

        private void InitializeComponent()
        {
            this.Text = "مطاعم المراسيم - حوكمة الجودة";
            this.Size = new Size(520, 270);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.None;
            this.BackColor = Color.FromArgb(27, 17, 17); // #1B1111 AlMaraseem Deep Burgundy
            this.TopMost = true;

            // Paint Gold Border (#D49A3D)
            this.Paint += (s, e) =>
            {
                using (Pen goldPen = new Pen(Color.FromArgb(212, 154, 61), 3))
                {
                    e.Graphics.DrawRectangle(goldPen, 1, 1, this.Width - 3, this.Height - 3);
                }
            };

            lblTitle = new Label();
            lblTitle.Text = "مطاعم المراسيم - AL-MARASEEM";
            lblTitle.Font = new Font("Segoe UI", 15, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(255, 194, 23); // #FFC217 Gold
            lblTitle.TextAlign = ContentAlignment.MiddleCenter;
            lblTitle.Size = new Size(480, 36);
            lblTitle.Location = new Point(20, 30);
            this.Controls.Add(lblTitle);

            lblSubtitle = new Label();
            lblSubtitle.Text = "منظومة الرقابة والتفتيش وحوكمة الجودة الشاملة (CAPA)";
            lblSubtitle.Font = new Font("Segoe UI", 10, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(240, 220, 190);
            lblSubtitle.TextAlign = ContentAlignment.MiddleCenter;
            lblSubtitle.Size = new Size(480, 25);
            lblSubtitle.Location = new Point(20, 72);
            this.Controls.Add(lblSubtitle);

            progressBar = new ProgressBar();
            progressBar.Style = ProgressBarStyle.Marquee;
            progressBar.MarqueeAnimationSpeed = 30;
            progressBar.Size = new Size(440, 10);
            progressBar.Location = new Point(40, 130);
            this.Controls.Add(progressBar);

            lblStatus = new Label();
            lblStatus.Text = "جاري التحقق من الاتصال السحابي بالنظام...";
            lblStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblStatus.ForeColor = Color.FromArgb(210, 210, 210);
            lblStatus.TextAlign = ContentAlignment.MiddleCenter;
            lblStatus.Size = new Size(480, 25);
            lblStatus.Location = new Point(20, 155);
            this.Controls.Add(lblStatus);

            Label lblFooter = new Label();
            lblFooter.Text = "الإصدار المكتبي v2.0 - السحابي والمحلي";
            lblFooter.Font = new Font("Segoe UI", 8, FontStyle.Italic);
            lblFooter.ForeColor = Color.FromArgb(150, 130, 120);
            lblFooter.TextAlign = ContentAlignment.MiddleCenter;
            lblFooter.Size = new Size(480, 20);
            lblFooter.Location = new Point(20, 225);
            this.Controls.Add(lblFooter);
        }

        private void DetermineProjectRoot()
        {
            string current = AppDomain.CurrentDomain.BaseDirectory;
            if (File.Exists(Path.Combine(current, "..", "package.json")))
            {
                projectRoot = Path.GetFullPath(Path.Combine(current, ".."));
            }
            else if (File.Exists(Path.Combine(current, "package.json")))
            {
                projectRoot = Path.GetFullPath(current);
            }
            else if (Directory.Exists(@"C:\Users\مطعم المراسيم\Downloads\مجلد جديد (5)\marasim_app_latest_ready"))
            {
                projectRoot = @"C:\Users\مطعم المراسيم\Downloads\مجلد جديد (5)\marasim_app_latest_ready";
            }
            else
            {
                projectRoot = current;
            }
        }

        private bool IsCloudResponsive()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(CLOUD_URL);
                req.Timeout = 3000;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK || resp.StatusCode == HttpStatusCode.TemporaryRedirect;
                }
            }
            catch
            {
                return false;
            }
        }

        private bool IsLocalServerResponsive()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://localhost:3000/login");
                req.Timeout = 2000;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK || resp.StatusCode == HttpStatusCode.TemporaryRedirect;
                }
            }
            catch
            {
                return false;
            }
        }

        private void StartServerAndApp()
        {
            new Thread(() =>
            {
                string targetUrl = CLOUD_URL;

                // 1. First priority: Check if Cloud is online
                UpdateStatus("جاري فحص الاتصال بالخادم السحابي المباشر...");
                if (IsCloudResponsive())
                {
                    targetUrl = CLOUD_URL;
                    UpdateStatus("تم الاتصال بالسحابة بنجاح! جاري فتح نافذة المنظومة...");
                }
                else
                {
                    // 2. Fallback to Local Server if offline or internet down
                    UpdateStatus("الإنترنت غير متاح: جاري التحقق من الخادم المحلي...");
                    if (!IsLocalServerResponsive())
                    {
                        UpdateStatus("جاري تشغيل خادم المنظومة المحلي في الخلفية...");
                        try
                        {
                            string npmPath = @"C:\Program Files\nodejs\npm.cmd";
                            if (!File.Exists(npmPath)) npmPath = "npm.cmd";

                            ProcessStartInfo psi = new ProcessStartInfo();
                            psi.FileName = npmPath;
                            psi.Arguments = "run start";
                            psi.WorkingDirectory = projectRoot;
                            psi.WindowStyle = ProcessWindowStyle.Hidden;
                            psi.CreateNoWindow = true;
                            psi.UseShellExecute = false;
                            Process.Start(psi);
                        }
                        catch (Exception ex)
                        {
                            UpdateStatus("تنبيه: " + ex.Message);
                        }

                        while (!IsLocalServerResponsive() && checkCount < 20)
                        {
                            checkCount++;
                            Thread.Sleep(1000);
                            UpdateStatus("جاري تجهيز الخادم المحلي (" + checkCount + "/20)...");
                        }
                    }

                    targetUrl = "http://localhost:3000/login";
                    UpdateStatus("تم تجهيز بيئة العمل المحلية! جاري فتح التطبيق...");
                }

                Thread.Sleep(400);

                if (this.IsHandleCreated)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        LaunchAppWindow(targetUrl);
                        this.Close();
                    });
                }
                else
                {
                    LaunchAppWindow(targetUrl);
                }
            }).Start();
        }

        private void UpdateStatus(string message)
        {
            if (this.IsHandleCreated)
            {
                try
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        lblStatus.Text = message;
                    });
                }
                catch { }
            }
        }

        private void LaunchAppWindow(string url)
        {
            // Find Edge or Chrome to run in pure App-Mode (No browser toolbars, pure desktop window)
            string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            if (!File.Exists(edgePath)) edgePath = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";

            string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
            if (!File.Exists(chromePath)) chromePath = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";

            string browserPath = File.Exists(edgePath) ? edgePath : (File.Exists(chromePath) ? chromePath : null);

            if (browserPath != null)
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = browserPath;
                psi.Arguments = "--app=\"" + url + "\" --window-size=1366,850";
                Process.Start(psi);
            }
            else
            {
                ProcessStartInfo psi = new ProcessStartInfo(url);
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm());
        }
    }
}
