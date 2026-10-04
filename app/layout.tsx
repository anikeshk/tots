import type { Metadata } from "next";
import Link from "next/link";
import { VercelToolbar } from "@vercel/toolbar/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOTS — Threat Opinion & Technical Scrutiny",
  description: "Is this CVE technically real for this package version, disputed, overstated, or noise?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-4 py-4">
            <Link href="/" className="font-mono text-lg font-semibold tracking-tight">
              TOTS
            </Link>
            <span className="text-sm text-zinc-500">Threat Opinion &amp; Technical Scrutiny</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        {process.env.NODE_ENV === "development" && <VercelToolbar />}
      </body>
    </html>
  );
}
