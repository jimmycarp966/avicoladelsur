import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración para Supabase
  serverExternalPackages: ['@supabase/ssr'],
  // Marcar todas las páginas como dinámicas si usan Supabase
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
};

export default nextConfig;
