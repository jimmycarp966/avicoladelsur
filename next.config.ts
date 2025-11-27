import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración para Supabase
  // IMPORTANTE: En Next.js 16 con Turbopack, serverExternalPackages es necesario
  // pero NO debe haber conflicto con transpilePackages
  serverExternalPackages: ['@supabase/ssr'],
  
  // Optimizaciones de rendimiento
  experimental: {
    // Optimizar imports de paquetes grandes (reduce bundle size)
    optimizePackageImports: ['lucide-react'],
  },
  
  // Headers de caché para assets estáticos
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
    ]
  },
};

export default nextConfig;
