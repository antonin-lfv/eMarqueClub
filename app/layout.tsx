import type { Metadata } from "next";
import "./globals.css";
import { AppTheme } from "./theme";

export const metadata: Metadata = {
  title: "eMarque Club · Table de marque",
  description:
    "Table de marque de basketball pour vos tournois internes et corpo.",
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
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased">
        <AppTheme>{children}</AppTheme>
      </body>
    </html>
  );
}
