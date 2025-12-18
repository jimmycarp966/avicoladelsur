import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { RutaHojaContent } from './ruta-hoja-content'
import { Card, CardContent } from '@/components/ui/card'
import { Truck } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function RutaHojaPage({ params }: { params: Promise<{ ruta_id: string }> }) {
  const supabase = await createClient()
  const { ruta_id } = await params

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autorizado</div>

  // Obtener ruta básica
  const { data: rutaBasica, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(`
      *,
      repartidor:usuarios!rutas_reparto_repartidor_id_fkey(id, nombre, apellido),
      vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
      zona:zonas(nombre)
    `)
    .eq('id', ruta_id)
    .single()

  if (rutaError || !rutaBasica) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Ruta no encontrada</h3>
            <p className="text-muted-foreground">
              La ruta solicitada no existe o no tienes acceso
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Verificar que el repartidor sea el dueño de la ruta
  if (rutaBasica.repartidor_id !== user.id) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Acceso denegado</h3>
            <p className="text-muted-foreground">
              Esta ruta no está asignada a tu usuario
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // OPTIMIZACIÓN: Usar RPC batch para obtener todos los detalles en una sola query
  // Reduce ~20 queries N+1 a una sola llamada
  const { data: detallesCompletos, error: detallesError } = await supabase
    .rpc('fn_get_detalles_ruta_completos', { p_ruta_id: ruta_id })

  if (detallesError) {
    console.error('Error obteniendo detalles de ruta:', detallesError)
  }

  // Convertir el resultado JSONB a array de detalles
  // La RPC ya viene con clientes expandidos y coordenadas convertidas
  const detallesConCliente = Array.isArray(detallesCompletos)
    ? detallesCompletos
    : (detallesCompletos ? [detallesCompletos] : [])

  const ruta = {
    ...rutaBasica,
    detalles_ruta: detallesConCliente,
  }

  return <RutaHojaContent ruta={ruta} />
}


export default async function RutaHojaPageWrapper({
  params,
}: {
  params: Promise<{ ruta_id: string }>
}) {
  return <RutaHojaPage params={params} />
}

