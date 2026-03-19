import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Wrench, FileCheck, AlertTriangle, Gauge, Fuel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { obtenerVehiculoPorIdAction } from '@/actions/reparto.actions'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

interface VehiculoDetallePageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Detalle Vehículo - Avícola del Sur ERP',
  description: 'Información detallada del vehículo',
}

const getEstadoConfig = (estado: string) => {
  const configs = {
    activo: { label: 'Activo', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
    mantenimiento: { label: 'En Mantenimiento', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' },
    inactivo: { label: 'Inactivo', variant: 'secondary' as const, color: 'bg-gray-100 text-gray-800' },
    averiado: { label: 'Averiado', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
  }
  return configs[estado as keyof typeof configs] || { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

function esVigente(fecha?: string | null) {
  if (!fecha) return true
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fecha)
  venc.setHours(0, 0, 0, 0)
  return venc >= hoy
}

function DocumentoItem({ label, fecha }: { label: string; fecha?: string | null }) {
  const vigente = esVigente(fecha)
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant={vigente ? 'default' : 'destructive'}>{vigente ? 'VIGENTE' : 'VENCIDO'}</Badge>
        {fecha && <span className="text-sm">{formatDate(fecha)}</span>}
      </div>
    </div>
  )
}

export default async function VehiculoDetallePage({ params }: VehiculoDetallePageProps) {
  const { id } = await params
  const result = await obtenerVehiculoPorIdAction(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const vehiculo = result.data
  const estadoConfig = getEstadoConfig(vehiculo.estado)

  const supabase = await createClient()
  const { data: mantenimientos } = await supabase
    .from('checklists_vehiculos')
    .select('*, usuario:usuarios(nombre, apellido)')
    .eq('vehiculo_id', id)
    .order('fecha_check', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/reparto/vehiculos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{vehiculo.patente}</h1>
            <p className="text-muted-foreground">{vehiculo.marca} {vehiculo.modelo}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/reparto/vehiculos/${id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/reparto/vehiculos/${id}/mantenimiento`}>
              <Wrench className="mr-2 h-4 w-4" />
              Programar mantenimiento
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/reparto/vehiculos/${id}/checklist`}>
              <FileCheck className="mr-2 h-4 w-4" />
              Checklist
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Patente</p>
              <p className="font-medium">{vehiculo.patente}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Marca y Modelo</p>
              <p className="font-medium">{vehiculo.marca} {vehiculo.modelo}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <Badge variant="outline">{vehiculo.tipo_vehiculo}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Capacidad</p>
              <p className="font-medium">{vehiculo.capacidad_kg} kg</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant={estadoConfig.variant} className={estadoConfig.color}>{estadoConfig.label}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activo</p>
              <Badge variant={vehiculo.activo ? 'default' : 'secondary'}>{vehiculo.activo ? 'Sí' : 'No'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentacion y Combustible</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DocumentoItem label="Seguro" fecha={vehiculo.fecha_vto_seguro} />
            <DocumentoItem label="SENASA" fecha={vehiculo.fecha_vto_senasa} />
            <DocumentoItem label="VTV" fecha={vehiculo.fecha_vto_vtv} />

            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Gauge className="h-4 w-4" /> Kilometraje
              </p>
              <p className="font-medium">{vehiculo.kilometraje?.toLocaleString() || vehiculo.km_inicial?.toLocaleString() || '-'} km</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Fuel className="h-4 w-4" /> Combustible
              </p>
              <p className="font-medium">
                {vehiculo.combustible_actual_litros !== undefined && vehiculo.capacidad_tanque_litros !== undefined
                  ? `${Number(vehiculo.combustible_actual_litros).toFixed(1)} / ${Number(vehiculo.capacidad_tanque_litros).toFixed(1)} L`
                  : 'Sin datos'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {mantenimientos && mantenimientos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial Reciente</CardTitle>
            <CardDescription>Ultimos mantenimientos y checklists</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Kilometraje</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mantenimientos.map((mant: any) => (
                  <TableRow key={mant.id}>
                    <TableCell>{formatDate(mant.fecha_check)}</TableCell>
                    <TableCell>{mant.usuario?.nombre} {mant.usuario?.apellido}</TableCell>
                    <TableCell>{mant.kilometraje ? `${mant.kilometraje.toLocaleString()} km` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={mant.aprobado ? 'default' : 'secondary'}>{mant.aprobado ? 'Aprobado' : 'Pendiente'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{mant.observaciones || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
