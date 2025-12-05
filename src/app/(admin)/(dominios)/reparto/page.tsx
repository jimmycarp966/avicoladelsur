import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // Revalida cada 5 minutos

export default function RepartoPage() {
  // Redirigir automáticamente a la página de rutas
  redirect('/reparto/rutas')
}

