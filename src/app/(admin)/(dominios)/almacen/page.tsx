import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AlmacenPage() {
  // Redirigir automáticamente a la página de productos
  redirect('/almacen/productos')
}

