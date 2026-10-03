import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parsi — Receipt & Document Parsing",
  description:
    "Asynchronous document processing pipeline turning receipts, invoices, and PDFs into strict, validated structured data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-app flex min-h-screen flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>

        <header className="w-full">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5 md:px-8 md:py-6">
            <Link
              href="/"
              className="flex items-center gap-3 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-token-sm"
              aria-label="Parsi homepage"
            >
              <span className="logo-mark" aria-hidden="true">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5" />
                  <path d="M9 13h6M9 17h4" />
                </svg>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold tracking-tight">
                  Parsi
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  Document Parsing Pipeline
                </span>
              </span>
            </Link>
          </div>
        </header>

        <main
          id="main"
          className="flex w-full flex-1 justify-center px-4 pb-28 pt-2 md:px-8 md:pb-32"
        >
          <div className="w-full max-w-3xl">{children}</div>
        </main>
      </body>
    </html>
  );
}
