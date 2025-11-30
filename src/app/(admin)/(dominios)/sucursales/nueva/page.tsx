import { SucursalForm } from '@/components/sucursales/SucursalForm'
import { Building2 } from 'lucide-react'

export default function NuevaSucursalPage() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Building2 className="w-8 h-8" />
                    Nueva Sucursal
                </h1>
                <p className="text-muted-foreground">
                    Registra una nueva sucursal para gestionar inventario y ventas
                </p>
            </div>

            <SucursalForm />
        </div>
    )
}
