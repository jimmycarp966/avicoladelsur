import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración de Turbopack
  // Nota: Turbopack se habilita con --turbo flag, no en config

  // Configuración para Supabase
  serverExternalPackages: ['@supabase/ssr', 'pdfkit'],

  // TEMPORAL: Deshabilitar TypeScript checking en build para evitar error interno de TS
  // con Zod v4 + @hookform/resolvers
  // TODO: Revisar cuando se actualice @hookform/resolvers con soporte completo para Zod v4
  typescript: {
    ignoreBuildErrors: true,
  },

  // Optimizaciones de rendimiento
  experimental: {
    // Optimizar imports de paquetes grandes (reduce bundle size)
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-select',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      'date-fns',
      '@tanstack/react-table',
      'recharts',
    ],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Configuración de Server Actions (Next 15/16)
  serverActions: {
    bodySizeLimit: '50mb',
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
