import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Plus, Users } from 'lucide-react'
import { listarProveedoresAction } from '@/actions/proveedores.actions'
import { ProveedoresTable } from './proveedores-table'
import { NuevoProveedorDialog } from './nuevo-proveedor-dialog'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Proveedores - Avícola del Sur ERP',
    description: 'Gestión de proveedores y pagos',
}

function LoadingSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
        </div>
    )
}

export default async function ProveedoresPage() {
    const result = await listarProveedoresAction(false) // Incluir inactivos
    const proveedores = result.success ? result.data : []

    const activos = proveedores.filter((p: any) => p.activo).length
    const inactivos = proveedores.filter((p: any) => !p.activo).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Building2 className="h-8 w-8 text-blue-600" />
                            Proveedores
                        </h1>
                        <p className="text-muted-foreground mt-2 text-base">
                            Gestión de proveedores para control de pagos y gastos
                        </p>
                    </div>
                    <NuevoProveedorDialog />
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Proveedores</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{proveedores.length}</div>
                    </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-900">Activos</CardTitle>
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{activos}</div>
                    </CardContent>
                </Card>

                <Card className="border-gray-200 bg-gray-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700">Inactivos</CardTitle>
                        <div className="h-3 w-3 rounded-full bg-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-500">{inactivos}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla */}
            <Card>
                <CardHeader>
                    <CardTitle>Listado de Proveedores</CardTitle>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={<LoadingSkeleton />}>
                        <ProveedoresTable proveedores={proveedores} />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
