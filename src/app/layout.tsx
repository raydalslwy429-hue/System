import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1B1111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "النظام الإداري لمطاعم المراسيم",
  description: "النظام الإداري الموحد لإدارة الجودة والعمليات الميدانية - مطاعم المراسيم",
  manifest: "/manifest.json",
  icons: {
    icon: "/brand/logo.png",
    apple: "/brand/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "النظام الإداري لمطاعم المراسيم",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/brand/logo.png" />
      </head>
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
