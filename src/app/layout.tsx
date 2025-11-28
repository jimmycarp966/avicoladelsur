import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { GoogleMapsScript } from "@/components/providers/google-maps-script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Avícola del Sur ERP",
  description: "Sistema de Gestión Integral para Avícola del Sur",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <GoogleMapsScript />
          {children}
        </Providers>
      </body>
    </html>
  );
}
