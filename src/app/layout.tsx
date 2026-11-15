import type { Metadata } from "next";
import { Providers } from './providers'
import "./globals.css";

export const metadata: Metadata = {
  title: "RFID Scans",
  description: "Save details on RFID Scans",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
