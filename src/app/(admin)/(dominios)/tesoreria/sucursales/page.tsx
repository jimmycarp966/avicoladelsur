import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  BarChart3,
  Download,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react'
import { obtenerSucursalesAction } from '@/actions/sucursales.actions'
import { format } from 'date-fns'

interface FiltrosTesoreria {
  sucursalId?: string
  fechaDesde: string
  fechaHasta: string
}

async function getReportesTesoreriaSucursales(filtros: FiltrosTesoreria) {
  const supabase = await createClient()

  // Obtener sucursales
  const sucursalesResult = await obtenerSucursalesAction()
  const sucursales = sucursalesResult.success ? sucursalesResult.data || [] : []

  if (filtros.sucursalId && filtros.sucursalId !== 'todas') {
    // Reporte específico de una sucursal
    const sucursalId = filtros.sucursalId

    // Movimientos de tesorería de la sucursal
    const { data: movimientos, error: movimientosError } = await supabase
      .from('tesoreria_movimientos')
      .select(`
        id,
        tipo,
        monto,
        descripcion,
        saldo_anterior,
        saldo_nuevo,
        origen_tipo,
        origen_id,
        created_at,
        cajas (
          nombre
        )
      `)
      .eq('sucursal_id', sucursalId)
      .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      .lte('created_at', `${filtros.fechaHasta}T23:59:59`)
      .order('created_at', { ascending: false })

    // Cajas de la sucursal
    const { data: cajas, error: cajasError } = await supabase
      .from('tesoreria_cajas')
      .select('id, nombre, saldo_actual')
      .eq('sucursal_id', sucursalId)

    const sucursal = sucursales.find(s => s.id === sucursalId)

    return {
      tipo: 'sucursal_especifica',
      sucursal,
      movimientos: movimientos || [],
      cajas: cajas || []
    }
  }

  // Vista consolidada de todas las sucursales
  const consolidado = await Promise.all(
    sucursales.map(async (sucursal) => {
      // Movimientos de tesorería por sucursal
      const { data: movimientos } = await supabase
        .from('tesoreria_movimientos')
        .select('tipo, monto, origen_tipo')
        .eq('sucursal_id', sucursal.id)
        .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
        .lte('created_at', `${filtros.fechaHasta}T23:59:59`)

      // Saldo actual de cajas por sucursal
      const { data: cajas } = await supabase
        .from('tesoreria_cajas')
        .select('saldo_actual')
        .eq('sucursal_id', sucursal.id)

      const ingresos = movimientos?.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0) || 0
      const egresos = movimientos?.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + m.monto, 0) || 0
      const saldoCajas = cajas?.reduce((sum, c) => sum + (c.saldo_actual || 0), 0) || 0

      return {
        ...sucursal,
        ingresos,
        egresos,
        saldoNeto: ingresos - egresos,
        saldoCajas
      }
    })
  )

  return {
    tipo: 'consolidado',
    consolidado,
    fechaDesde: filtros.fechaDesde,
    fechaHasta: filtros.fechaHasta
  }
}

function TesoreriaSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default async function TesoreriaSucursalesPage({
  searchParams
}: {
  searchParams: { sucursal?: string; desde?: string; hasta?: string }
}) {
  const filtros: FiltrosTesoreria = {
    sucursalId: searchParams.sucursal || 'todas',
    fechaDesde: searchParams.desde || format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    fechaHasta: searchParams.hasta || format(new Date(), 'yyyy-MM-dd')
  }

  const reportesData = await getReportesTesoreriaSucursales(filtros)
  const sucursalesResult = await obtenerSucursalesAction()
  const sucursales = sucursalesResult.success ? sucursalesResult.data || [] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-8 h-8" />
            Tesorería por Sucursal
          </h1>
          <p className="text-muted-foreground">
            Análisis financiero detallado por sucursal
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Selecciona período y sucursal para generar reportes financieros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="sucursal">Sucursal</Label>
              <Select name="sucursal" defaultValue={filtros.sucursalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las sucursales</SelectItem>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desde">Fecha Desde</Label>
              <Input
                id="desde"
                name="desde"
                type="date"
                defaultValue={filtros.fechaDesde}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hasta">Fecha Hasta</Label>
              <Input
                id="hasta"
                name="hasta"
                type="date"
                defaultValue={filtros.fechaHasta}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full">
                <BarChart3 className="w-4 h-4 mr-2" />
                Generar Reporte
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Suspense fallback={<TesoreriaSkeleton />}>
        {reportesData.tipo === 'consolidado' ? (
          <ReportesTesoreriaConsolidados
            data={reportesData.consolidado || []}
            fechaDesde={filtros.fechaDesde}
            fechaHasta={filtros.fechaHasta}
          />
        ) : (
          <ReporteTesoreriaSucursalEspecifica data={reportesData} />
        )}
      </Suspense>
    </div>
  )
}

function ReportesTesoreriaConsolidados({ data, fechaDesde, fechaHasta }: { data: any[], fechaDesde: string, fechaHasta: string }) {
  const totalIngresos = data.reduce((sum, s) => sum + s.ingresos, 0)
  const totalEgresos = data.reduce((sum, s) => sum + s.egresos, 0)
  const totalSaldoNeto = data.reduce((sum, s) => sum + s.saldoNeto, 0)
  const totalSaldoCajas = data.reduce((sum, s) => sum + s.saldoCajas, 0)

  return (
    <div className="space-y-6">
      {/* Estadísticas consolidadas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalIngresos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Todas las sucursales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Egresos</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalEgresos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Todas las sucursales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Neto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalSaldoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalSaldoNeto.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos - Egresos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo en Cajas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalSaldoCajas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalSaldoCajas.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Saldo actual total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exportar</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada por sucursal */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Sucursal</CardTitle>
          <CardDescription>
            Estado financiero individual de cada sucursal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.map((sucursal) => (
              <div key={sucursal.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="font-semibold">{sucursal.nombre}</h3>
                    <Badge variant={sucursal.active ? "default" : "secondary"}>
                      {sucursal.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6 text-right">
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos</p>
                    <p className="font-semibold text-green-600">${sucursal.ingresos.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Egresos</p>
                    <p className="font-semibold text-red-600">${sucursal.egresos.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Neto</p>
                    <p className={`font-semibold ${sucursal.saldoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${sucursal.saldoNeto.toLocaleString()}
                    </p>
                  </div>
                  <div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/tesoreria/sucursales?sucursal=${sucursal.id}&desde=${fechaDesde}&hasta=${fechaHasta}`}>
                        Ver Detalle
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReporteTesoreriaSucursalEspecifica({ data }: { data: any }) {
  const { sucursal, movimientos, cajas } = data

  const ingresos = movimientos.filter((m: any) => m.tipo === 'ingreso').reduce((sum: number, m: any) => sum + m.monto, 0)
  const egresos = movimientos.filter((m: any) => m.tipo === 'egreso').reduce((sum: number, m: any) => sum + m.monto, 0)
  const saldoCajas = cajas.reduce((sum: number, c: any) => sum + (c.saldo_actual || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header específico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Tesorería - {sucursal.nombre}
          </CardTitle>
          <CardDescription>
            Estado financiero detallado de la sucursal
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Estadísticas específicas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Período</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${ingresos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {movimientos.filter((m: any) => m.tipo === 'ingreso').length} movimientos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos del Período</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${egresos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {movimientos.filter((m: any) => m.tipo === 'egreso').length} movimientos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Neto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(ingresos - egresos) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${(ingresos - egresos).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos - Egresos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo en Cajas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoCajas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${saldoCajas.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Saldo actual
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cajas de la sucursal */}
      <Card>
        <CardHeader>
          <CardTitle>Cajas de la Sucursal</CardTitle>
          <CardDescription>
            Estado actual de las cajas de {sucursal.nombre}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cajas.map((caja: any) => (
              <div key={caja.id} className="flex justify-between items-center p-3 border rounded-lg">
                <span className="font-medium">{caja.nombre}</span>
                <Badge variant={caja.saldo_actual >= 0 ? "default" : "destructive"}>
                  ${caja.saldo_actual?.toLocaleString() || '0'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Movimientos recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos del Período</CardTitle>
          <CardDescription>
            Historial de movimientos financieros de {sucursal.nombre}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {movimientos.slice(0, 20).map((mov: any) => (
              <div key={mov.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{mov.origen_tipo}</span>
                    <Badge variant={mov.tipo === 'ingreso' ? "default" : "destructive"}>
                      {mov.tipo}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {mov.descripcion} • {format(new Date(mov.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                    {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Saldo: ${mov.saldo_nuevo?.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
