import { getCurrentUser } from '@/actions/auth.actions'
import { obtenerRutaActiva } from '@/actions/reparto.actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, AlertCircle, CheckSquare } from 'lucide-react'
import Link from 'next/link'
import { ChecklistInicioForm } from '../ruta/[ruta_id]/checklist-inicio-form'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CheckinPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  if (!user) {
    redirect('/login')
  }

  // Obtener ruta activa del repartidor
  const rutaActivaResponse = await obtenerRutaActiva(user.id)
  const rutaActiva = rutaActivaResponse.success ? rutaActivaResponse.data : null

  // Si no hay ruta activa, mostrar mensaje
  if (!rutaActiva) {
    return (
      <div className="space-y-6 p-4">
        <Card className="border-l-4 border-l-orange-400 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              No hay ruta activa
            </CardTitle>
            <CardDescription>
              No tienes ninguna ruta planificada o en curso para hoy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contacta al administrador para que te asigne una ruta, o revisa tus rutas del día.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/repartidor/ruta-diaria">
                  Ver Rutas del Día
                </Link>
              </Button>
              <Button asChild>
                <Link href="/repartidor/home">
                  Ir al Inicio
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Obtener información completa de la ruta
  const { data: ruta, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(`
      *,
      vehiculo:vehiculos(id, patente, marca, modelo),
      zona:zonas(nombre)
    `)
    .eq('id', rutaActiva.ruta_id)
    .single()

  if (rutaError || !ruta) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Error al cargar ruta</h3>
            <p className="text-muted-foreground">
              No se pudo cargar la información de la ruta
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si la ruta ya tiene checklist de inicio, mostrar mensaje
  if (ruta.checklist_inicio_id) {
    return (
      <div className="space-y-6 p-4">
        <Card className="border-l-4 border-l-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-green-600" />
              Checklist Completado
            </CardTitle>
            <CardDescription>
              El checklist de inicio de ruta ya fue completado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Información de la ruta:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><strong>Ruta:</strong> {ruta.numero_ruta}</p>
                  <p><strong>Vehículo:</strong> {ruta.vehiculo?.patente} - {ruta.vehiculo?.marca} {ruta.vehiculo?.modelo}</p>
                  <p><strong>Zona:</strong> {ruta.zona?.nombre}</p>
                  <p><strong>Turno:</strong> {ruta.turno === 'mañana' ? 'Mañana' : 'Tarde'}</p>
                  <p><strong>Estado:</strong> {ruta.estado === 'planificada' ? 'Planificada' : ruta.estado === 'en_curso' ? 'En Curso' : ruta.estado}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {ruta.estado === 'planificada' && (
                  <Button asChild>
                    <Link href={`/repartidor/ruta/${ruta.id}`}>
                      Iniciar Ruta
                    </Link>
                  </Button>
                )}
                {ruta.estado === 'en_curso' && (
                  <Button asChild>
                    <Link href={`/repartidor/ruta/${ruta.id}`}>
                      Ver Hoja de Ruta
                    </Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/repartidor/home">
                    Ir al Inicio
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si la ruta está en curso o completada, no mostrar checklist
  if (ruta.estado !== 'planificada') {
    return (
      <div className="space-y-6 p-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle>Ruta {ruta.estado === 'en_curso' ? 'En Curso' : 'Completada'}</CardTitle>
            <CardDescription>
              Esta ruta ya fue iniciada o completada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button asChild>
                <Link href={`/repartidor/ruta/${ruta.id}`}>
                  Ver Hoja de Ruta
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/repartidor/home">
                  Ir al Inicio
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mostrar checklist de inicio
  return (
    <div className="space-y-6 p-4 pb-20">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Checklist de Inicio de Ruta
          </CardTitle>
          <CardDescription>
            Ruta {ruta.numero_ruta} - {ruta.vehiculo?.patente} - {ruta.zona?.nombre}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Vehículo</p>
                <p className="text-foreground">{ruta.vehiculo?.patente} - {ruta.vehiculo?.marca} {ruta.vehiculo?.modelo}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Turno</p>
                <p className="text-foreground">{ruta.turno === 'mañana' ? 'Mañana' : 'Tarde'}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Zona</p>
                <p className="text-foreground">{ruta.zona?.nombre}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Fecha</p>
                <p className="text-foreground">
                  {new Date(ruta.fecha_ruta).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          <ChecklistInicioForm
            rutaId={ruta.id}
            vehiculoId={ruta.vehiculo_id}
            onComplete={() => {
              // Redirigir a la hoja de ruta después de completar
              window.location.href = `/repartidor/ruta/${ruta.id}`
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}




