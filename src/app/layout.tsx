import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OCIE — Guideline / Pipeline Mapping",
  description: "NSCLC drug-to-guideline mapping by biomarker and line of therapy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
