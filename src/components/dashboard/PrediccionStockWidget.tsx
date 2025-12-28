'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Package, AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

interface PrediccionProducto {
    productoId: string
    productoNombre: string
    stockActual: number
    demandaPredicha: number
    diasCobertura: number
    alerta: 'critico' | 'bajo' | 'normal' | 'alto'
    confianza: number
    tendencia: 'subiendo' | 'estable' | 'bajando'
    sugerencia: string
}

export function PrediccionStockWidget() {
    const [predicciones, setPredicciones] = useState<PrediccionProducto[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadPredicciones()
    }, [])

    async function loadPredicciones() {
        try {
            setLoading(true)
            const response = await fetch('/api/ia/prediccion-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ diasFuturos: 7 }),
            })
            const data = await response.json()

            if (data.success) {
                setPredicciones(data.data || [])
            }
        } catch (error) {
            console.error('Error cargando predicciones:', error)
        } finally {
            setLoading(false)
        }
    }

    function getAlertaBadge(alerta: string) {
        switch (alerta) {
            case 'critico':
                return <Badge variant="destructive">Crítico</Badge>
            case 'bajo':
                return <Badge variant="default" className="bg-yellow-500">Bajo</Badge>
            case 'alto':
                return <Badge variant="secondary">Exceso</Badge>
            default:
                return null
        }
    }

    function getTendenciaIcon(tendencia: string) {
        switch (tendencia) {
            case 'subiendo':
                return <TrendingUp className="h-4 w-4 text-green-500" />
            case 'bajando':
                return <TrendingDown className="h-4 w-4 text-red-500" />
            default:
                return <Minus className="h-4 w-4 text-muted-foreground" />
        }
    }

    // Filtrar solo los que tienen alerta crítico o bajo
    const productosConAlerta = predicciones.filter(
        (p) => p.alerta === 'critico' || p.alerta === 'bajo'
    )

    if (loading) {
        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Predicción de Stock
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (productosConAlerta.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-green-500" />
                        Predicción de Stock
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6 text-muted-foreground">
                        <p>✅ Stock adecuado para los próximos 7 días</p>
                        <p className="text-sm mt-1">No hay productos con alerta</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Predicción de Stock (7 días)
                        {productosConAlerta.length > 0 && (
                            <Badge variant="destructive">{productosConAlerta.length}</Badge>
                        )}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={loadPredicciones}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {productosConAlerta.slice(0, 5).map((producto) => (
                        <div
                            key={producto.productoId}
                            className="space-y-2 pb-3 border-b last:border-b-0"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm truncate max-w-[150px]">
                                        {producto.productoNombre}
                                    </span>
                                    {getAlertaBadge(producto.alerta)}
                                </div>
                                <div className="flex items-center gap-1">
                                    {getTendenciaIcon(producto.tendencia)}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Stock: {producto.stockActual} kg</span>
                                <span>•</span>
                                <span>Demanda: {producto.demandaPredicha} kg</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${Math.min(100, (producto.stockActual / Math.max(1, producto.demandaPredicha)) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs font-medium">
                                    {producto.diasCobertura} días
                                </span>
                            </div>

                            <p className="text-xs text-primary">{producto.sugerencia}</p>
                        </div>
                    ))}
                </div>

                {productosConAlerta.length > 5 && (
                    <Link href="/almacen/productos?filtro=stock-bajo" className="block mt-4">
                        <Button variant="outline" size="sm" className="w-full">
                            Ver todos ({productosConAlerta.length})
                        </Button>
                    </Link>
                )}
            </CardContent>
        </Card>
    )
}
