import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dirOf } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "Bills · Darb",
  description: "Darb Bill Pay prototype (demo, not production)",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    // Font variables sit on <html> so `html { font-family: var(--font-sans) }` and the
    // `html[lang="ar"]` Cairo rule in globals.css can resolve them.
    <html
      lang={lang}
      dir={dirOf(lang)}
      className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable}`}
    >
      <body className="antialiased">
        <I18nProvider lang={lang}>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
          {/* Light theme only (Darb app); bottom-end so toasts never cover the demo bar (flips in Arabic). */}
          <Toaster theme="light" position={lang === "ar" ? "bottom-left" : "bottom-right"} dir={dirOf(lang)} />
        </I18nProvider>
      </body>
    </html>
  );
}
