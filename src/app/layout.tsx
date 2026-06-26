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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
