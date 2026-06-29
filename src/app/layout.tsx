import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Futures Friend — Trend & Flow Adviser",
  description:
    "Multi-timeframe trend direction and market flow adviser for futures markets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}