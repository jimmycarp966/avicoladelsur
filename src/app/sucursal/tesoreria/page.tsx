import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, DollarSign, TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight, AlertTriangle, Building2 } from 'lucide-react'
import { TesoreriaTable } from '@/components/sucursales/TesoreriaTable'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

async function getTesoreriaSucursal(sidParam?: string) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario con soporte para admin
  const { sucursalId, esAdmin } = await getSucursalUsuarioConAdmin(supabase, user.id, user.email || '', sidParam)

  if (!sucursalId && !esAdmin) {
    throw new Error('Usuario no tiene sucursal asignada')
  }

  if (!sucursalId) {
    // Admin sin sucursales activas
    return {
      caja: null,
      movimientos: [],
      estadisticas: {
        saldoActual: 0,
        saldoInicial: 0,
        movimientosRecientes: 0,
        ingresosMes: 0,
        egresosMes: 0,
        balanceMes: 0,
        movimientosHoy: 0
      },
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener caja de la sucursal
  const { data: caja, error: cajaError } = await supabase
    .from('tesoreria_cajas')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .eq('active', true)
    .single()

  if (cajaError || !caja) {
    throw new Error('No se encontró caja para esta sucursal')
  }

  // Obtener movimientos recientes (últimos 30 días)
  const treintaDiasAtras = new Date()
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30)

  const { data: movimientos, error: movimientosError } = await supabase
    .from('tesoreria_movimientos')
    .select('*')
    .eq('caja_id', caja.id)
    .gte('created_at', treintaDiasAtras.toISOString())
    .order('created_at', { ascending: false })

  // Obtener estadísticas del mes actual
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const { data: movimientosMes, error: mesError } = await supabase
    .from('tesoreria_movimientos')
    .select('tipo, monto')
    .eq('caja_id', caja.id)
    .gte('created_at', inicioMes.toISOString())

  if (movimientosError || mesError) {
    throw new Error('Error al obtener movimientos')
  }

  // Calcular estadísticas
  const movimientosList = movimientos || []
  const movimientosMesList = movimientosMes || []

  const ingresosMes = movimientosMesList
    .filter(m => m.tipo === 'ingreso')
    .reduce((sum, m) => sum + (m.monto || 0), 0)

  const egresosMes = movimientosMesList
    .filter(m => m.tipo === 'egreso')
    .reduce((sum, m) => sum + (m.monto || 0), 0)

  const estadisticas = {
    saldoActual: caja.saldo_actual || 0,
    saldoInicial: caja.saldo_inicial || 0,
    movimientosRecientes: movimientosList.length,
    ingresosMes,
    egresosMes,
    balanceMes: ingresosMes - egresosMes,
    movimientosHoy: movimientosList.filter(m => {
      const fechaMovimiento = new Date(m.created_at).toDateString()
      const hoy = new Date().toDateString()
      return fechaMovimiento === hoy
    }).length
  }

  return {
    caja,
    movimientos: movimientosList,
    estadisticas,
    sinSucursal: false,
    esAdmin
  }
}

export default async function SucursalTesoreriaPage({ searchParams }: PageProps) {
  const params = await searchParams
  try {
    const data = await getTesoreriaSucursal(params.sid)

    // Si es admin sin sucursal, mostrar mensaje informativo
    if (data.sinSucursal && data.esAdmin) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-amber-900">
                  No hay sucursales activas
                </h3>
                <p className="text-amber-800 mb-4">
                  Como administrador, necesitas crear una sucursal antes de poder ver la tesorería.
                </p>
                <Button asChild>
                  <Link href="/sucursales/nueva">
                    <Building2 className="w-4 h-4 mr-2" />
                    Crear Primera Sucursal
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <CreditCard className="w-8 h-8" />
              Tesorería de Sucursal
            </h1>
            <p className="text-muted-foreground">
              Control y seguimiento de caja y movimientos financieros
            </p>
          </div>
        </div>

        {/* Información de Caja */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {data.caja.nombre}
            </CardTitle>
            <CardDescription>
              Estado actual de la caja de tu sucursal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Saldo Actual</p>
                <p className="text-3xl font-bold text-green-600">
                  ${data.estadisticas.saldoActual.toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                <p className="text-2xl font-semibold">
                  ${data.estadisticas.saldoInicial.toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge variant={data.caja.active ? "default" : "secondary"}>
                  {data.caja.active ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Movimientos Hoy</p>
                <p className="text-2xl font-semibold">
                  {data.estadisticas.movimientosHoy}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas del Mes */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${data.estadisticas.ingresosMes.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total de ingresos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Egresos del Mes</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ${data.estadisticas.egresosMes.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total de egresos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance del Mes</CardTitle>
              <TrendingUp className={`h-4 w-4 ${data.estadisticas.balanceMes >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.estadisticas.balanceMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${data.estadisticas.balanceMes.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.estadisticas.balanceMes >= 0 ? 'Superávit' : 'Déficit'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Movimientos Recientes</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.estadisticas.movimientosRecientes}</div>
              <p className="text-xs text-muted-foreground">
                Últimos 30 días
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Movimientos Recientes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Movimientos Recientes</CardTitle>
                <CardDescription>
                  Últimos movimientos de caja (30 días)
                </CardDescription>
              </div>

              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <Suspense fallback={
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                    <div className="w-20 h-8 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            }>
              <TesoreriaTable movimientos={data.movimientos} />
            </Suspense>
          </CardContent>
        </Card>

        {/* Información adicional */}
        <Card>
          <CardHeader>
            <CardTitle>Información de Tesorería</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold">Tipos de Movimiento</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <Badge variant="default" className="mr-1">INGRESO</Badge> Ventas, cobros, depósitos</li>
                  <li>• <Badge variant="destructive" className="mr-1">EGRESO</Badge> Compras, gastos, retiros</li>
                  <li>• Todos los movimientos afectan el saldo de caja automáticamente</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Orígenes de Movimientos</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Ventas:</strong> Ingresos por pedidos completados</li>
                  <li>• <strong>Transferencias:</strong> Movimientos entre sucursales</li>
                  <li>• <strong>Gastos:</strong> Egresos por gastos operativos</li>
                  <li>• <strong>Ajustes:</strong> Correcciones manuales</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CreditCard className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar tesorería</h3>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
