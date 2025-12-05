import type { Metadata, Viewport } from "next";
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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/images/logo-avicola.svg", type: "image/svg+xml" },
      { url: "/images/logo-avicola.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/images/logo-avicola.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Avícola ERP",
  },
};

export const viewport: Viewport = {
  themeColor: "#2F7058",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
