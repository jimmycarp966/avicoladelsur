'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, Package, Database, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface DiagnosticoData {
    almacen_central: any
    productos_catalogo: number
    lotes_central: number
    productos_con_stock: number
    productos_detalle: Array<{
        id: string
        nombre: string
        codigo: string
        stock_total: number
        lotes_count: number
    }>
    diagnostico: {
        almacen_central_existe: boolean
        hay_productos_catalogo: boolean
        hay_lotes_central: boolean
        hay_productos_con_stock: boolean
    }
}

export default function DebugTransferenciasPage() {
    const [data, setData] = useState<DiagnosticoData | null>(null)
    const [loading, setLoading] = useState(true)

    const cargarDiagnostico = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/debug-transferencias')
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

    useEffect(() => {
        cargarDiagnostico()
    }, [])

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                        <p>Cargando diagnóstico de transferencias...</p>
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
                        Debug Transferencias
                    </h1>
                    <p className="text-muted-foreground">
                        Diagnóstico del sistema de transferencias y almacén central
                    </p>
                </div>

                <Button variant="outline" onClick={cargarDiagnostico} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Recargar
                </Button>
            </div>

            {/* Diagnóstico General */}
            {data && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Almacén Central</CardTitle>
                            {data.diagnostico.almacen_central_existe ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {data.diagnostico.almacen_central_existe ? '✅' : '❌'}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {data.almacen_central?.nombre || 'No encontrado'}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Productos Catálogo</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.productos_catalogo}</div>
                            <p className="text-xs text-muted-foreground">
                                En catálogo central
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Lotes en Central</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.lotes_central}</div>
                            <p className="text-xs text-muted-foreground">
                                Lotes disponibles
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Productos con Stock</CardTitle>
                            {data.diagnostico.hay_productos_con_stock ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.productos_con_stock}</div>
                            <p className="text-xs text-muted-foreground">
                                Disponibles para transferir
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Estado del Sistema */}
            {data && (
                <Card>
                    <CardHeader>
                        <CardTitle>Estado del Sistema</CardTitle>
                        <CardDescription>
                            Verificación de componentes necesarios para transferencias
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <h4 className="font-semibold">Componentes del Sistema:</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        {data.diagnostico.almacen_central_existe ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                        )}
                                        <span className="text-sm">
                                            Almacén Central configurado
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {data.diagnostico.hay_productos_catalogo ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                        )}
                                        <span className="text-sm">
                                            Productos en catálogo central
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {data.diagnostico.hay_lotes_central ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                        )}
                                        <span className="text-sm">
                                            Lotes en almacén central
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {data.diagnostico.hay_productos_con_stock ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                        )}
                                        <span className="text-sm">
                                            Productos disponibles para transferir
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-semibold">Solución si faltan productos:</h4>
                                <div className="text-sm text-muted-foreground space-y-2">
                                    <p>1. Ve a <code className="bg-muted px-1 rounded">/diagnostico-stock</code></p>
                                    <p>2. Haz click en "Crear Datos de Prueba"</p>
                                    <p>3. Vuelve a esta página y recarga</p>
                                    <p>4. Los productos deberían aparecer en transferencias</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Productos con Stock */}
            {data && data.productos_detalle.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Productos Disponibles para Transferir</CardTitle>
                        <CardDescription>
                            Productos del catálogo central con stock en almacén
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2">
                            {data.productos_detalle.map((producto) => (
                                <div key={producto.id} className="p-3 border rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{producto.nombre}</p>
                                            <p className="text-sm text-muted-foreground">{producto.codigo}</p>
                                        </div>
                                        <Badge variant="outline">
                                            {producto.stock_total} unidades
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {producto.lotes_count} lote{producto.lotes_count !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Mensaje si no hay productos */}
            {data && data.productos_con_stock === 0 && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No hay productos disponibles</h3>
                            <p className="text-muted-foreground mb-4">
                                No se encontraron productos con stock en el almacén central.
                            </p>
                            <Button onClick={() => window.location.href = '/diagnostico-stock'}>
                                Crear Datos de Prueba
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
