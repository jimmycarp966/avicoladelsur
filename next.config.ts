import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración de Turbopack
  // Nota: Turbopack se habilita con --turbo flag, no en config

  // Configuración para Supabase
  serverExternalPackages: ['@supabase/ssr'],

  // TEMPORAL: Deshabilitar TypeScript checking en build para evitar error interno de TS
  // con Zod v4 + @hookform/resolvers
  // TODO: Revisar cuando se actualice @hookform/resolvers con soporte completo para Zod v4
  typescript: {
    ignoreBuildErrors: true,
  },

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
