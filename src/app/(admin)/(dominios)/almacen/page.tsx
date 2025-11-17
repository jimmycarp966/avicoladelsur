import { redirect } from 'next/navigation'

export default function AlmacenPage() {
  // Redirigir automáticamente a la página de productos
  redirect('/almacen/productos')
}

