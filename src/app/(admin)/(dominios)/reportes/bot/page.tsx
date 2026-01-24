import { format, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { obtenerMetricasBotAction, obtenerProductosMasPedidosAction, obtenerResumenMetricasBotAction } from '@/actions/bot-metricas.actions'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { MessageSquare, TrendingUp, CheckCircle, XCircle, AlertCircle, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const revalidate = 60

export default async function BotMetricasPage({
  searchParams
}: {
  searchParams: { fechaDesde?: string; fechaHasta?: string }
}) {
  const supabase = await createClient()

  // Filtros por defecto (últimos 7 días)
  const fechaHasta = searchParams.fechaHasta || format(new Date(), 'yyyy-MM-dd')
  const fechaDesde = searchParams.fechaDesde || format(subDays(new Date(fechaHasta), 6), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
  }

  // Obtener datos en paralelo
  const [metricasResult, productosResult, resumenResult] = await Promise.all([
    obtenerMetricasBotAction(filtros),
    obtenerProductosMasPedidosAction({ ...filtros, limite: 10 }),
    obtenerResumenMetricasBotAction(filtros)
  ])

  const metricas = metricasResult.data || []
  const productos = productosResult.data || []
  const resumen = resumenResult.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Métricas del Bot"
        description="Analítica completa del bot de WhatsApp"
      />

      {/* Cards de Resumen */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Mensajes"
          value={resumen?.totalMensajes || 0}
          subtitle={`${resumen?.tasaConversion || 0}% tasa de conversión`}
          icon={MessageSquare}
          variant="primary"
        />

        <StatCard
          title="Presupuestos Creados"
          value={resumen?.totalPresupuestos || 0}
          subtitle={`Últimos 7 días`}
          icon={Package}
          variant="success"
        />

        <StatCard
          title="Tasa de Conversión"
          value={`${resumen?.tasaConversion || 0}%`}
          subtitle="Mensajes a presupuestos"
          icon={TrendingUp}
          variant="info"
        />

        <StatCard
          title="Tiempo Promedio"
          value={resumen?.tiempoPromedio || '0ms'}
          subtitle="Respuesta del bot"
          icon={CheckCircle}
          variant="warning"
        />
      </div>

      {/* Top 10 Productos */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Productos Más Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {productos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay datos disponibles en este período
            </p>
          ) : (
            <div className="space-y-4">
              {productos.map((producto, index) => (
                <div
                  key={producto.producto_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{producto.producto_nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {producto.producto_codigo}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold text-foreground">
                      {producto.veces_pedido} pedidos
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {producto.cantidad_total.toFixed(1)} total kg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
