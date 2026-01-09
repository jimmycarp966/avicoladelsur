import { Suspense } from 'react'
import { Factory, TrendingDown, TrendingUp, Scale, Package, AlertTriangle, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { obtenerEstadisticasProduccionAction } from '@/actions/produccion.actions'
import { ProduccionReporteContent } from './produccion-reporte-content'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata = {
    title: 'Reportes de Producción - Avícola del Sur ERP',
    description: 'Análisis inteligente de producción con métricas de merma, rendimiento y eficiencia',
}

export default async function ReportesProduccionPage({
    searchParams
}: {
    searchParams: { fechaDesde?: string; fechaHasta?: string }
}) {
    const { fechaDesde, fechaHasta } = searchParams

    // Obtener estadísticas
    const result = await obtenerEstadisticasProduccionAction({
        fechaDesde,
        fechaHasta
    })

    const stats = result.data

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white shadow-lg">
                <div className="flex items-center gap-3">
                    <Factory className="h-8 w-8" />
                    <div>
                        <h1 className="text-2xl font-bold">Reportes de Producción</h1>
                        <p className="text-indigo-100 mt-1">
                            Análisis inteligente de mermas, rendimientos y eficiencia
                        </p>
                    </div>
                </div>
            </div>

            {/* KPIs principales */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-t-4 border-t-blue-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Órdenes Completadas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-600">
                                {stats.resumen.ordenesCompletadas}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                de {stats.resumen.totalOrdenes} totales
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-t-4 border-t-green-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="h-4 w-4" />
                                Eficiencia
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-600">
                                {stats.metricas.eficienciaPorcentaje.toFixed(1)}%
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Conversión entrada → salida
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-t-4 border-t-orange-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                <TrendingDown className="h-4 w-4" />
                                Merma Líquida
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-600">
                                {stats.metricas.mermaPorcentaje.toFixed(1)}%
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stats.metricas.mermaTotal.toFixed(1)} kg totales
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-t-4 border-t-red-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4" />
                                Desperdicio Sólido
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-600">
                                {stats.metricas.desperdicioSolido.toFixed(1)} kg
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Piel, huesos, etc.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Balance de producción */}
            {stats && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Scale className="h-5 w-5" />
                            Balance de Producción
                        </CardTitle>
                        <CardDescription>
                            Comparación entre stock consumido y productos generados
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Entrada (Consumido)</p>
                                <p className="text-3xl font-bold text-blue-600">{stats.metricas.pesoTotalEntrada.toFixed(1)} kg</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Salida (Generado)</p>
                                <p className="text-3xl font-bold text-green-600">{stats.metricas.pesoTotalSalida.toFixed(1)} kg</p>
                            </div>
                            <div className="text-center p-4 bg-orange-50 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Pérdida Total</p>
                                <p className="text-3xl font-bold text-orange-600">
                                    {(stats.metricas.mermaTotal + stats.metricas.desperdicioSolido).toFixed(1)} kg
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Merma: {stats.metricas.mermaTotal.toFixed(1)} + Desp: {stats.metricas.desperdicioSolido.toFixed(1)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Contenido detallado del reporte */}
            <Suspense fallback={<div className="text-center py-8">Cargando estadísticas...</div>}>
                <ProduccionReporteContent stats={stats} />
            </Suspense>
        </div>
    )
}
