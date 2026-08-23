import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import ThemeInstallIcon from "./components/ThemeInstallIcon";

export const metadata: Metadata = {
  metadataBase: new URL("https://neighborlykc.com"),
  title: "NeighborlyKC — Kansas City Neighbors, Connected",
  description: "Join NeighborlyKC for local updates, recommendations, events, safety alerts and neighbor-to-neighbor conversations across Kansas City.",
  manifest: "/api/manifest?theme=royals",
  alternates: { canonical: "/" },
  openGraph: {
    title: "NeighborlyKC — Kansas City Neighbors, Connected",
    description: "Local updates, recommendations, events and conversations for neighbors across Kansas City.",
    url: "/",
    siteName: "NeighborlyKC",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "NeighborlyKC Kansas City neighborhood network" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NeighborlyKC — Kansas City Neighbors, Connected",
    description: "Local updates, recommendations, events and conversations for neighbors across Kansas City.",
    images: ["/icon-512.png"],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem('nkc_theme');var b={royals:'#f0f6ff',aim:'#fef9d6',sporting:'#070f1f',chiefs:'#0a0000','pip-boy':'#000b00',space:'#10081d','kc-current':'#eefbfd',kcpd:'#eef5ff',kcfd:'#fff4ef',army:'#11160d',navy:'#061324',marines:'#170707','air-force':'#061629',cowtown:'#160f0b','kc-bbq':'#140706','city-fountains':'#031820'}[t]||'#070a0f';document.documentElement.style.background=b;}catch(e){}`}} />
        <link rel="icon" href="/favicon-64.png" type="image/png" sizes="64x64" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0b2b52" />
      </head>
      <body className="bg-[#f0f6ff]">
        <ThemeInstallIcon />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
