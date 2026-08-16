import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import Script from "next/script";
import { PreviewInspector } from "@/components/eazo/preview-inspector";
import "./globals.css";

const INSPECTOR_ENABLED = process.env.NEXT_PUBLIC_EAZO_INSPECTOR === "1";

const serif = Noto_Serif_SC({
  weight: ["300", "400", "600", "700", "900"],
  subsets: ["latin"],
  variable: "--font-serif-sc",
  display: "swap",
});
const sans = Noto_Sans_SC({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-sans-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "尼采 · 最后的十二年",
  description: "以电影卡片流重体验尼采生命最后十二年的沉浸之作。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07070a",
};

const APP_ID = process.env.NEXT_PUBLIC_EAZO_APP_ID || "";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body className={`${serif.variable} ${sans.variable}`}>
        {children}
        <Script
          src="https://cdn.eazo.ai/branding/eazo-brand-banner.js"
          strategy="afterInteractive"
          data-eazo-app-id={APP_ID}
        />
        {INSPECTOR_ENABLED && <PreviewInspector />}
      </body>
    </html>
  );
}
