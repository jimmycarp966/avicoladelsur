import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdvancedOptimizer } from '@/components/reparto/AdvancedOptimizer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default async function OptimizarRutaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Verificar autenticación
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Obtener información de la ruta
  const { data: ruta, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(`
      id,
      numero_ruta,
      fecha_ruta,
      distancia_estimada_km,
      tiempo_estimado_min,
      vehiculos (
        id,
        patente,
        marca,
        modelo,
        capacidad_kg
      )
    `)
    .eq('id', id)
    .single()

  if (rutaError || !ruta) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Ruta no encontrada</h3>
              <p className="text-muted-foreground mb-4">
                La ruta solicitada no existe o no tienes permisos para verla.
              </p>
              <Button asChild>
                <Link href="/reparto/rutas">Volver a Rutas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const vehiculo = (ruta as any).vehiculos

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/reparto/rutas/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Optimizar Ruta: {ruta.numero_ruta}
            </h1>
            <p className="text-muted-foreground">
              Optimización avanzada usando Google Cloud AI Services
            </p>
          </div>
        </div>
      </div>

      {/* Información de la ruta */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Fecha</Label>
              <p className="font-medium">
                {new Date(ruta.fecha_ruta).toLocaleDateString('es-AR')}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Vehículo</Label>
              <p className="font-medium">
                {vehiculo?.marca} {vehiculo?.modelo} ({vehiculo?.patente})
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Distancia Actual</Label>
              <p className="font-medium">
                {ruta.distancia_estimada_km?.toFixed(1) || '0'} km
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Tiempo Actual</Label>
              <p className="font-medium">
                {ruta.tiempo_estimado_min || 0} minutos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimizador avanzado */}
      <AdvancedOptimizer
        rutaId={id}
        distanciaOriginal={ruta.distancia_estimada_km || 0}
        tiempoOriginal={ruta.tiempo_estimado_min || 0}
      />
    </div>
  )
}

