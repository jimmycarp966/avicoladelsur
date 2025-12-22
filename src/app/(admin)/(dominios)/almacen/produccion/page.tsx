import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Factory, Package, Scale, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { obtenerOrdenesProduccionAction } from '@/actions/produccion.actions'
import { formatDate } from '@/lib/utils'

export const revalidate = 30

function LoadingSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
        </div>
    )
}

async function OrdenesProduccionList() {
    const { data: ordenes, success } = await obtenerOrdenesProduccionAction()

    if (!success || !ordenes?.length) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay órdenes de producción</p>
                    <p className="text-sm text-muted-foreground mb-4">
                        Crea tu primera orden para comenzar el proceso de desposte
                    </p>
                    <Link href="/almacen/produccion/nueva">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Orden
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        )
    }

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'en_proceso':
                return <Badge variant="default" className="bg-yellow-500">En Proceso</Badge>
            case 'completada':
                return <Badge variant="default" className="bg-green-500">Completada</Badge>
            case 'cancelada':
                return <Badge variant="destructive">Cancelada</Badge>
            default:
                return <Badge variant="outline">{estado}</Badge>
        }
    }

    return (
        <div className="space-y-4">
            {ordenes.map((orden) => (
                <Card key={orden.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <Factory className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-lg">{orden.numero_orden}</h3>
                                        {getEstadoBadge(orden.estado)}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {formatDate(orden.fecha_produccion)}
                                        {orden.operario && ` • ${orden.operario.nombre} ${orden.operario.apellido || ''}`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-center">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <Package className="h-4 w-4" />
                                        <span className="text-sm">Entrada</span>
                                    </div>
                                    <p className="font-semibold">{orden.peso_total_entrada?.toFixed(2) || '0'} kg</p>
                                </div>

                                <div className="text-center">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <Scale className="h-4 w-4" />
                                        <span className="text-sm">Salida</span>
                                    </div>
                                    <p className="font-semibold">{orden.peso_total_salida?.toFixed(2) || '0'} kg</p>
                                </div>

                                {orden.estado === 'completada' && (
                                    <div className="text-center">
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <TrendingDown className="h-4 w-4" />
                                            <span className="text-sm">Merma</span>
                                        </div>
                                        <p className="font-semibold text-orange-600">
                                            {orden.merma_porcentaje?.toFixed(1) || '0'}%
                                        </p>
                                    </div>
                                )}

                                <Link href={`/almacen/produccion/${orden.id}`}>
                                    <Button variant="outline" size="sm">
                                        Ver Detalle
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

export default function ProduccionPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Producción / Desposte</h1>
                    <p className="text-muted-foreground">
                        Gestión de transformación de productos y trazabilidad
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/almacen/produccion/configuracion">
                        <Button variant="outline">
                            <Scale className="mr-2 h-4 w-4" />
                            Configurar Balanza
                        </Button>
                    </Link>
                    <Link href="/almacen/produccion/nueva">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Orden
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>En Proceso</CardDescription>
                        <CardTitle className="text-2xl text-yellow-600">-</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Completadas Hoy</CardDescription>
                        <CardTitle className="text-2xl text-green-600">-</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Kg Procesados Hoy</CardDescription>
                        <CardTitle className="text-2xl">-</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Merma Promedio</CardDescription>
                        <CardTitle className="text-2xl text-orange-600">-</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Lista de órdenes */}
            <Card>
                <CardHeader>
                    <CardTitle>Órdenes de Producción</CardTitle>
                    <CardDescription>
                        Historial de órdenes de desposte y transformación
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={<LoadingSkeleton />}>
                        <OrdenesProduccionList />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
