import type { Metadata } from "next";
import Link from "next/link";
import { VercelToolbar } from "@vercel/toolbar/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tots",
  description: "Is this CVE technically real for this package version, disputed, overstated, or noise?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex max-w-6xl items-baseline gap-8 px-4 py-5">
            <Link href="/" className="font-mono text-2xl font-bold tracking-tight">
              tots
            </Link>
            <Link
              href="/how-it-works"
              className="text-base font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              How it works
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        {process.env.NODE_ENV === "development" && <VercelToolbar />}
      </body>
    </html>
  );
}
