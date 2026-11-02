import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Providers from './providers';

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
 * Applied before first paint so the chosen theme never flashes. Defaults to the
 * signature warm-ivory light design unless the user explicitly chose dark mode.
 */
const THEME_BOOTSTRAP = `(function(){try{var s=localStorage.getItem('trustlayer.theme.v2');if(s==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
