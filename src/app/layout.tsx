import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 中文字型體積大，不預載；瀏覽器只會按需下載用到的字
const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  weight: ["400", "500", "700"],
  preload: false,
});

const notoSerifTC = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  weight: ["600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "我的股票摘要站",
  description: "即時報價、歷史走勢、籌碼與新聞，一站看完你追蹤的台股",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} ${notoSerifTC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
