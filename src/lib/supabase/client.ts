import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Obtener y limpiar valores (eliminar espacios en blanco)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  // Debug: mostrar qué valores se están recibiendo (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Supabase Client] URL recibida:', url ? `${url.substring(0, 30)}...` : 'UNDEFINED')
    console.log('[Supabase Client] Key recibida:', key ? `${key.substring(0, 20)}...` : 'UNDEFINED')
  }

  if (!url || !key) {
    const missing = []
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!key) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    throw new Error(
      `❌ Variables de entorno de Supabase no configuradas\n\n` +
      `Faltan: ${missing.join(', ')}\n\n` +
      `Valores recibidos:\n` +
      `- NEXT_PUBLIC_SUPABASE_URL: ${url ? '✓ Configurada' : '✗ FALTA'}\n` +
      `- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${key ? '✓ Configurada' : '✗ FALTA'}\n\n` +
      `Solución:\n` +
      `1. Verifica que el archivo .env.local existe en la raíz del proyecto\n` +
      `2. Asegúrate de que las variables empiezan con NEXT_PUBLIC_\n` +
      `3. Reinicia el servidor de desarrollo (Ctrl+C y luego npm run dev)\n` +
      `4. Las variables de entorno solo se cargan al iniciar Next.js\n\n` +
      `Obtén tus credenciales en: https://supabase.com/dashboard/project/_/settings/api`
    )
  }

  // Validar que la URL sea válida
  try {
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('La URL debe usar HTTP o HTTPS')
    }
  } catch (error: any) {
    throw new Error(
      `❌ URL de Supabase inválida\n\n` +
      `Valor recibido: "${url}"\n` +
      `Tipo: ${typeof url}\n` +
      `Longitud: ${url?.length || 0} caracteres\n\n` +
      `La URL debe ser una URL HTTP o HTTPS válida.\n` +
      `Ejemplo válido: https://tu-proyecto.supabase.co\n\n` +
      `Verifica tu archivo .env.local:\n` +
      `- No debe tener comillas alrededor del valor\n` +
      `- No debe tener espacios antes o después del =\n` +
      `- Debe estar en una sola línea\n\n` +
      `Formato correcto:\n` +
      `NEXT_PUBLIC_SUPABASE_URL=https://tvijhnglmryjmrstfvbv.supabase.co`
    )
  }

  return createBrowserClient(url, key)
}
