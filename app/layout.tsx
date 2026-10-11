import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "Bills · Darb",
  description: "Darb Bill Pay prototype (demo, not production)",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
