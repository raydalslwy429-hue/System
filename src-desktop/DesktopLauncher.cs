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
        private System.Windows.Forms.Timer timer;
        private Process serverProcess = null;
        private string projectRoot = "";
        private int checkCount = 0;

        public LauncherForm()
        {
            InitializeComponent();
            DetermineProjectRoot();
            StartServerAndApp();
        }

        private void InitializeComponent()
        {
            this.Text = "مطاعم المراسيم - منظومة حوكمة الجودة";
            this.Size = new Size(540, 290);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.None;
            this.BackColor = Color.FromArgb(28, 18, 16); // #1C1210
            this.TopMost = true;

            // Paint Gold Border
            this.Paint += (s, e) =>
            {
                using (Pen goldPen = new Pen(Color.FromArgb(212, 154, 61), 3))
                {
                    e.Graphics.DrawRectangle(goldPen, 1, 1, this.Width - 3, this.Height - 3);
                }
            };

            lblTitle = new Label();
            lblTitle.Text = "مطاعم المراسيم - AL-MARASEEM";
            lblTitle.Font = new Font("Segoe UI", 16, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(255, 194, 23); // #FFC217
            lblTitle.TextAlign = ContentAlignment.MiddleCenter;
            lblTitle.Size = new Size(500, 40);
            lblTitle.Location = new Point(20, 35);
            this.Controls.Add(lblTitle);

            lblSubtitle = new Label();
            lblSubtitle.Text = "منظومة الرقابة والتفتيش وحوكمة الجودة الشاملة (CAPA)";
            lblSubtitle.Font = new Font("Segoe UI", 10, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(240, 220, 190);
            lblSubtitle.TextAlign = ContentAlignment.MiddleCenter;
            lblSubtitle.Size = new Size(500, 25);
            lblSubtitle.Location = new Point(20, 80);
            this.Controls.Add(lblSubtitle);

            progressBar = new ProgressBar();
            progressBar.Style = ProgressBarStyle.Marquee;
            progressBar.MarqueeAnimationSpeed = 30;
            progressBar.Size = new Size(460, 12);
            progressBar.Location = new Point(40, 140);
            this.Controls.Add(progressBar);

            lblStatus = new Label();
            lblStatus.Text = "جاري تهيئة بيئة العمل والاتصال بالنظام...";
            lblStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblStatus.ForeColor = Color.FromArgb(200, 200, 200);
            lblStatus.TextAlign = ContentAlignment.MiddleCenter;
            lblStatus.Size = new Size(500, 25);
            lblStatus.Location = new Point(20, 170);
            this.Controls.Add(lblStatus);

            Label lblFooter = new Label();
            lblFooter.Text = "الإصدار المكتبي المعتمد v2.0 - بيئة العمل المحلية والسحابية";
            lblFooter.Font = new Font("Segoe UI", 8, FontStyle.Italic);
            lblFooter.ForeColor = Color.FromArgb(140, 120, 110);
            lblFooter.TextAlign = ContentAlignment.MiddleCenter;
            lblFooter.Size = new Size(500, 20);
            lblFooter.Location = new Point(20, 245);
            this.Controls.Add(lblFooter);
        }

        private void DetermineProjectRoot()
        {
            string current = AppDomain.CurrentDomain.BaseDirectory;
            // Check if running inside Releases/ folder
            if (File.Exists(Path.Combine(current, "..", "package.json")))
            {
                projectRoot = Path.GetFullPath(Path.Combine(current, ".."));
            }
            else if (File.Exists(Path.Combine(current, "package.json")))
            {
                projectRoot = Path.GetFullPath(current);
            }
            else
            {
                projectRoot = @"C:\Users\مطعم المراسيم\Downloads\مجلد جديد (5)\marasim_app_latest_ready";
            }
        }

        private bool IsServerResponsive()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://localhost:3000/login");
                req.Timeout = 1200;
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
                if (!IsServerResponsive())
                {
                    UpdateStatus("جاري تشغيل خادم المنظومة المحلي...");
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo();
                        psi.FileName = "cmd.exe";
                        // Start Next.js production or dev server
                        string startCmd = "npm run dev";
                        psi.Arguments = "/c " + startCmd;
                        psi.WorkingDirectory = projectRoot;
                        psi.WindowStyle = ProcessWindowStyle.Hidden;
                        psi.CreateNoWindow = true;
                        psi.UseShellExecute = true;
                        serverProcess = Process.Start(psi);
                    }
                    catch (Exception ex)
                    {
                        UpdateStatus("تنبيه: " + ex.Message);
                    }
                }

                // Poll until server is ready
                while (!IsServerResponsive() && checkCount < 30)
                {
                    checkCount++;
                    Thread.Sleep(1000);
                    UpdateStatus("جاري التحقق من جاهزية النظام (" + checkCount + "/30)...");
                }

                UpdateStatus("تم الاتصال بنجاح! جاري فتح نافذة التطبيق...");
                Thread.Sleep(600);

                this.Invoke((MethodInvoker)delegate
                {
                    LaunchAppWindow();
                    this.Close();
                });
            }).Start();
        }

        private void UpdateStatus(string message)
        {
            if (this.IsHandleCreated)
            {
                this.Invoke((MethodInvoker)delegate
                {
                    lblStatus.Text = message;
                });
            }
        }

        private void LaunchAppWindow()
        {
            string url = "http://localhost:3000";

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
                // Chromium --app mode turns any web app into a native borderless desktop window
                psi.Arguments = "--app=" + url + " --window-size=1366,850";
                Process.Start(psi);
            }
            else
            {
                // Fallback to default browser
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
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
