import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function VentasPage() {
  // Redirigir automáticamente a la página de presupuestos
  redirect('/ventas/presupuestos')
}

