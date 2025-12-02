'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Package, RefreshCw, Database } from 'lucide-react'
import { toast } from 'sonner'

interface StockData {
    sucursal: string
    sucursal_id: string
    lotes: Array<{
        id: string
        cantidad_disponible: number
        estado: string
        producto: {
            id: string
            nombre: string
            codigo: string
            unidad_medida: string
        }
    }>
    totalProductos: number
}

interface DiagnosticoData {
    stockPorSucursal: StockData[]
    productosCentral: Array<{
        id: string
        nombre: string
        codigo: string
        is_central_catalog: boolean
    }>
    resumen: {
        totalSucursales: number
        sucursalesConStock: number
        sucursalesSinStock: number
    }
}

export default function DiagnosticoStockPage() {
    const [data, setData] = useState<DiagnosticoData | null>(null)
    const [loading, setLoading] = useState(true)
    const [creandoDatos, setCreandoDatos] = useState(false)
    const [configurandoAlmacen, setConfigurandoAlmacen] = useState(false)

    const cargarDiagnostico = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/debug-stock')
            const result = await response.json()

            if (result.success) {
                setData(result.data)
            } else {
                toast.error('Error cargando diagnóstico: ' + result.error)
            }
        } catch (error) {
            toast.error('Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    const crearDatosPrueba = async () => {
        try {
            setCreandoDatos(true)
            const response = await fetch('/api/setup-test-stock', {
                method: 'POST'
            })
            const result = await response.json()

            if (result.success) {
                toast.success('Datos de prueba creados exitosamente')
                await cargarDiagnostico() // Recargar datos
            } else {
                toast.error('Error creando datos: ' + result.error)
            }
        } catch (error) {
            toast.error('Error de conexión')
        } finally {
            setCreandoDatos(false)
        }
    }

    const configurarAlmacenCentral = async () => {
        try {
            setConfigurandoAlmacen(true)
            const response = await fetch('/api/setup-almacen-central', {
                method: 'POST'
            })
            const result = await response.json()

            if (result.success) {
                toast.success('Almacén central configurado para desarrollo')
                await cargarDiagnostico() // Recargar datos
            } else {
                toast.error('Error configurando almacén: ' + result.error)
            }
        } catch (error) {
            toast.error('Error de conexión')
        } finally {
            setConfigurandoAlmacen(false)
        }
    }

    useEffect(() => {
        cargarDiagnostico()
    }, [])

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                        <p>Cargando diagnóstico de stock...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Database className="w-8 h-8" />
                        Diagnóstico de Stock
                    </h1>
                    <p className="text-muted-foreground">
                        Verifica el estado del inventario por sucursal
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={cargarDiagnostico} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Recargar
                    </Button>
                    <Button onClick={crearDatosPrueba} disabled={creandoDatos}>
                        <Package className="w-4 h-4 mr-2" />
                        {creandoDatos ? 'Creando...' : 'Crear Datos de Prueba'}
                    </Button>
                    <Button onClick={configurarAlmacenCentral} disabled={configurandoAlmacen} variant="secondary">
                        <Database className="w-4 h-4 mr-2" />
                        {configurandoAlmacen ? 'Configurando...' : 'Configurar Almacén Central'}
                    </Button>
                </div>
            </div>

            {/* Resumen */}
            {data && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Sucursales</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.resumen.totalSucursales}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Con Stock</CardTitle>
                            <Package className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{data.resumen.sucursalesConStock}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{data.resumen.sucursalesSinStock}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Stock por Sucursal */}
            {data && (
                <div className="grid gap-6 md:grid-cols-2">
                    {data.stockPorSucursal.map((sucursal) => (
                        <Card key={sucursal.sucursal_id}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    {sucursal.sucursal}
                                    <Badge variant={sucursal.totalProductos > 0 ? 'default' : 'destructive'}>
                                        {sucursal.totalProductos} productos
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {sucursal.lotes.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">
                                        No hay productos disponibles en esta sucursal
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {sucursal.lotes.slice(0, 5).map((lote) => (
                                            <div key={lote.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div>
                                                    <p className="font-medium">{lote.producto.nombre}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Código: {lote.producto.codigo}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-medium">
                                                        {lote.cantidad_disponible} {lote.producto.unidad_medida}
                                                    </p>
                                                    <Badge variant="outline" className="text-xs">
                                                        {lote.estado}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                        {sucursal.lotes.length > 5 && (
                                            <p className="text-sm text-muted-foreground text-center">
                                                ... y {sucursal.lotes.length - 5} productos más
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Productos Centrales */}
            {data && data.productosCentral.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Productos del Catálogo Central</CardTitle>
                        <CardDescription>
                            Productos disponibles para asignar a sucursales
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2 md:grid-cols-3">
                            {data.productosCentral.map((producto) => (
                                <div key={producto.id} className="p-3 border rounded-lg">
                                    <p className="font-medium">{producto.nombre}</p>
                                    <p className="text-sm text-muted-foreground">{producto.codigo}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Instrucciones */}
            <Card>
                <CardHeader>
                    <CardTitle>¿Cómo usar este diagnóstico?</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <h4 className="font-semibold mb-2">🔍 Para diagnosticar problemas:</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Verifica que las sucursales tengan productos</li>
                                <li>• Confirma que los lotes estén marcados como "disponible"</li>
                                <li>• Asegúrate de que haya cantidad_disponible &gt; 0</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">🛠️ Para crear datos de prueba:</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• "Crear Datos de Prueba": Crea productos y lotes en sucursales</li>
                                <li>• "Configurar Almacén Central": Da 1000 unidades de TODOS los productos existentes al almacén central</li>
                                <li>• Ideal para desarrollo: almacén central siempre tiene stock disponible</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
