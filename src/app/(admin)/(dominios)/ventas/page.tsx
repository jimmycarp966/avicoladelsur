import { redirect } from 'next/navigation'

export const revalidate = 300 // Revalida cada 5 minutos

export default function VentasPage() {
  // Redirigir automáticamente a la página de presupuestos
  redirect('/ventas/presupuestos')
}

