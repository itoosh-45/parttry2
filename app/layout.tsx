import type { Metadata } from "next";
import "./globals.css";
import "./library.css";

export const metadata: Metadata = {
  title: "הספרייה שלי | My Library",
  description: "ספרייה אישית — ספרים, קריאה והשאלות במקום אחד",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
