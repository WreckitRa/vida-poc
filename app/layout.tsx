import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vida AI Agent - Restaurant Concierge",
  description: "Vida AI Agent - Intelligent restaurant concierge powered by AI",
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
