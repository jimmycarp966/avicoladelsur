import { ListaPrecioForm } from './lista-precio-form'
import { obtenerListasPreciosAction } from '@/actions/listas-precios.actions'

export const metadata = {
  title: 'Nueva Lista de Precios | Avícola del Sur',
  description: 'Crear nueva lista de precios',
}

export default async function NuevaListaPrecioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Lista de Precios</h1>
        <p className="text-muted-foreground">
          Crea una nueva lista de precios para el sistema
        </p>
      </div>

      <ListaPrecioForm />
    </div>
  )
}

