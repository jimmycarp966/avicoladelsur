import { redirect } from 'next/navigation'

export const revalidate = 300 // Revalida cada 5 minutos

export default function AlmacenPage() {
  // Redirigir automáticamente a la página de productos
  redirect('/almacen/productos')
}

