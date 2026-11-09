import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Outreach",
  description: "CRM personale per outreach",
};

const nav = [
  { href: "/", label: "Panoramica" },
  { href: "/review", label: "Revisione" },
  { href: "/companies", label: "Aziende" },
  { href: "/settings", label: "Impostazioni" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className="min-h-screen">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              CRM Outreach
            </Link>
            <nav className="flex gap-1 text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1 text-stone-600 hover:bg-stone-100 hover:text-stone-900">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
