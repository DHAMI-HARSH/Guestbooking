import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guest House Management System",
  description: "College guest house booking and approval management",
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
