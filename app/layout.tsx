import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HERACLES DAILY｜每日训练准备度",
  description: "基于 HRV、睡眠、静息心率、训练负荷与局部疲劳的每日训练决策仪表盘。",
  manifest: "./manifest.webmanifest",
  icons: { icon: "./favicon.svg", shortcut: "./favicon.svg" },
  appleWebApp: { capable: true, title: "HERACLES DAILY", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3f5f4" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
