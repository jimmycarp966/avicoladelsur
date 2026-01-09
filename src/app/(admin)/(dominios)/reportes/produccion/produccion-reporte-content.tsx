'use client'

import { Package, TrendingUp, TrendingDown, Factory, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface EstadisticasProduccion {
    resumen: {
        totalOrdenes: number
        ordenesCompletadas: number
        ordenesPendientes: number
        ordenesCanceladas: number
    }
    metricas: {
        pesoTotalEntrada: number
        pesoTotalSalida: number
        mermaTotal: number
        mermaPorcentaje: number
        desperdicioSolido: number
        eficienciaPorcentaje: number
    }
    tendencias: {
        fecha: string
        ordenes: number
        mermaKg: number
        mermaPct: number
        desperdicioKg: number
    }[]
    productosMasProducidos: {
        productoId: string
        nombre: string
        pesoTotal: number
        ordenesCount: number
    }[]
    comparacionRendimiento: {
        destinoId: string
        destinoNombre: string
        pesoEntrada: number
        pesoSalida: number
        mermaPct: number
        eficienciaPct: number
    }[]
}

interface ProduccionReporteContentProps {
    stats: EstadisticasProduccion | undefined
}

export function ProduccionReporteContent({ stats }: ProduccionReporteContentProps) {
    if (!stats) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No hay datos de producción disponibles
            </div>
        )
    }

    // Calcular métricas de alerta
    const mermaAlta = stats.metricas.mermaPorcentaje > 15
    const eficienciaBaja = stats.metricas.eficienciaPorcentaje < 80

    return (
        <div className="space-y-6">
            {/* Alertas inteligentes */}
            {(mermaAlta || eficienciaBaja) && (
                <Card className="border-l-4 border-l-red-500 bg-red-50/50">
                    <CardHeader>
                        <CardTitle className="text-red-700 flex items-center gap-2">
                            <TrendingDown className="h-5 w-5" />
                            Alertas de Producción
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {mermaAlta && (
                            <div className="flex items-start gap-2 text-red-700">
                                <Badge variant="destructive">Alto</Badge>
                                <p>La merma líquida ({stats.metricas.mermaPorcentaje.toFixed(1)}%) está por encima del umbral recomendado (15%). Revisar procesos de producción.</p>
                            </div>
                        )}
                        {eficienciaBaja && (
                            <div className="flex items-start gap-2 text-orange-700">
                                <Badge variant="outline" className="border-orange-500 text-orange-600">Atención</Badge>
                                <p>La eficiencia ({stats.metricas.eficienciaPorcentaje.toFixed(1)}%) está por debajo del objetivo (80%). Optimizar rendimientos.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Tendencias visuales */}
            {stats.tendencias.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Tendencias de Producción
                        </CardTitle>
                        <CardDescription>
                            Últimos {stats.tendencias.length} días con actividad
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {/* Gráfico simple de barras con CSS */}
                            <div className="flex items-end gap-1 h-32 mt-4">
                                {stats.tendencias.slice(-14).map((t, idx) => {
                                    const maxOrdenes = Math.max(...stats.tendencias.map(x => x.ordenes), 1)
                                    const height = (t.ordenes / maxOrdenes) * 100
                                    return (
                                        <div
                                            key={idx}
                                            className="flex-1 bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                                            style={{ height: `${Math.max(height, 5)}%` }}
                                            title={`${t.fecha}: ${t.ordenes} órdenes`}
                                        />
                                    )
                                })}
                            </div>
                            <p className="text-xs text-center text-muted-foreground">Órdenes por día (últimos 14 días)</p>

                            {/* Tabla de tendencias */}
                            <div className="mt-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="text-right">Órdenes</TableHead>
                                            <TableHead className="text-right">Merma (kg)</TableHead>
                                            <TableHead className="text-right">Merma %</TableHead>
                                            <TableHead className="text-right">Desperdicio</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stats.tendencias.slice(-7).reverse().map((t, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium">{t.fecha}</TableCell>
                                                <TableCell className="text-right">{t.ordenes}</TableCell>
                                                <TableCell className="text-right">{t.mermaKg.toFixed(1)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={t.mermaPct > 15 ? "destructive" : "secondary"}>
                                                        {t.mermaPct.toFixed(1)}%
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">{t.desperdicioKg.toFixed(1)} kg</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Productos más producidos */}
                {stats.productosMasProducidos.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Top Productos Generados
                            </CardTitle>
                            <CardDescription>
                                Productos con mayor peso producido
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {stats.productosMasProducidos.map((prod, idx) => (
                                    <div key={prod.productoId} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                                                {idx + 1}
                                            </Badge>
                                            <div>
                                                <p className="font-medium">{prod.nombre}</p>
                                                <p className="text-xs text-muted-foreground">{prod.ordenesCount} órdenes</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-600">{prod.pesoTotal.toFixed(1)} kg</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Rendimiento por destino */}
                {stats.comparacionRendimiento.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Factory className="h-5 w-5" />
                                Rendimiento por Destino
                            </CardTitle>
                            <CardDescription>
                                Eficiencia de cada área de producción
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {stats.comparacionRendimiento.map((dest) => (
                                    <div key={dest.destinoId} className="p-3 rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-medium">{dest.destinoNombre}</p>
                                            <Badge
                                                variant={dest.eficienciaPct >= 80 ? "default" : dest.eficienciaPct >= 60 ? "secondary" : "destructive"}
                                            >
                                                {dest.eficienciaPct.toFixed(1)}% eficiente
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <p className="text-muted-foreground">Entrada</p>
                                                <p className="font-medium">{dest.pesoEntrada.toFixed(1)} kg</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Salida</p>
                                                <p className="font-medium text-green-600">{dest.pesoSalida.toFixed(1)} kg</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Merma</p>
                                                <p className="font-medium text-orange-600">{dest.mermaPct.toFixed(1)}%</p>
                                            </div>
                                        </div>
                                        {/* Barra de progreso visual */}
                                        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                                                style={{ width: `${dest.eficienciaPct}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Resumen de insights */}
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                        Insights de Producción
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                            <p>
                                <strong>Mejor rendimiento:</strong>{' '}
                                {stats.comparacionRendimiento.length > 0
                                    ? `${stats.comparacionRendimiento.sort((a, b) => b.eficienciaPct - a.eficienciaPct)[0]?.destinoNombre} con ${stats.comparacionRendimiento[0]?.eficienciaPct.toFixed(1)}% de eficiencia`
                                    : 'Sin datos suficientes'}
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                            <p>
                                <strong>Producto estrella:</strong>{' '}
                                {stats.productosMasProducidos[0]
                                    ? `${stats.productosMasProducidos[0].nombre} (${stats.productosMasProducidos[0].pesoTotal.toFixed(1)} kg)`
                                    : 'Sin datos'}
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-500 mt-2" />
                            <p>
                                <strong>Merma promedio:</strong> {stats.metricas.mermaPorcentaje.toFixed(1)}%
                                {stats.metricas.mermaPorcentaje <= 10 ? ' (Excelente)' : stats.metricas.mermaPorcentaje <= 15 ? ' (Aceptable)' : ' (Requiere atención)'}
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500 mt-2" />
                            <p>
                                <strong>Ratio desperdicio/producción:</strong>{' '}
                                {stats.metricas.pesoTotalSalida > 0
                                    ? ((stats.metricas.desperdicioSolido / stats.metricas.pesoTotalSalida) * 100).toFixed(1)
                                    : 0}%
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
