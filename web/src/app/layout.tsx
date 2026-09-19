import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: {
    default: "TrustLayer — AI Scam, Phishing & Social-Engineering Defense",
    template: "%s · TrustLayer",
  },
  description:
    "TrustLayer scores messages, URLs and screenshots for phishing and social-engineering risk in real time, explains every verdict, and gives security teams a live SOC view.",
  applicationName: "TrustLayer",
  keywords: [
    "phishing detection",
    "scam detection",
    "social engineering",
    "threat intelligence",
    "SOC dashboard",
  ],
  robots: { index: true, follow: true },
};

/**
 * Applied before first paint so the chosen theme never flashes. The storage
 * key must match THEME_STORAGE_KEY in components/ThemeToggle.tsx.
 */
const THEME_BOOTSTRAP = `(function(){try{var s=localStorage.getItem('trustlayer.theme');var dark=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
