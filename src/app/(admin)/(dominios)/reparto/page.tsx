import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function RepartoPage() {
  // Redirigir automáticamente a la página de rutas
  redirect('/reparto/rutas')
}

