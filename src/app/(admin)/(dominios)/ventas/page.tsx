import { redirect } from 'next/navigation'

export default function VentasPage() {
  // Redirigir automáticamente a la página de pedidos
  redirect('/ventas/pedidos')
}

