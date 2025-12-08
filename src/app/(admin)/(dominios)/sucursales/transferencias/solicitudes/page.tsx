import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Loader2 } from 'lucide-react'
import { obtenerSolicitudesAutomaticasAction } from '@/actions/sucursales-transferencias.actions'
import { SolicitudTransferenciaCard } from '@/components/sucursales/SolicitudTransferenciaCard'

async function getSolicitudesAutomaticas() {
    const data = await obtenerSolicitudesAutomaticasAction()
    return data
}

export default async function SolicitudesAutomaticasPage() {
    const solicitudes = await getSolicitudesAutomaticas()

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <AlertCircle className="w-8 h-8" />
                    Solicitudes Automáticas de Transferencia
                </h1>
                <p className="text-muted-foreground mt-2">
                    Revisa y gestiona las solicitudes automáticas generadas por stock bajo
                </p>
            </div>

            {/* Estadísticas */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Pendientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{solicitudes.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Sucursales Afectadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Set(solicitudes.map(s => s.sucursal_destino_id)).size}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Productos Solicitados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {solicitudes.reduce((acc, s) => acc + (s.items?.length || 0), 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de Solicitudes */}
            {solicitudes.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-lg">
                            No hay solicitudes automáticas pendientes
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Las solicitudes se generan automáticamente cuando una sucursal tiene stock bajo
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {solicitudes.map((solicitud) => (
                        <SolicitudTransferenciaCard
                            key={solicitud.id}
                            solicitud={solicitud}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

