import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document & Receipt Parsing Pipeline",
  description: "Asynchronous document processing pipeline transcribing any image or document into structured, validated data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
        <main className="w-full max-w-4xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
