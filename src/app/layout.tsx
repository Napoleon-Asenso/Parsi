import type { Metadata } from "next";
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
            <div className="flex items-center gap-3">
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
            </div>

            <span className="hidden items-center gap-1.5 text-[11px] font-medium text-on-surface-variant sm:inline-flex">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Direct-to-storage upload
            </span>
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
