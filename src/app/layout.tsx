import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "منظومة حوكمة الجودة والبلاغات التصحيحية | CAPA V2",
  description: "نظام إدارة ومتابعة بلاغات عدم المطابقة الميدانية والإجراءات التصحيحية والوقائية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
