import { TransferenciaForm } from '@/components/sucursales/TransferenciaForm'
import { ArrowRightLeft } from 'lucide-react'

export default function NuevaTransferenciaPage() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <ArrowRightLeft className="w-8 h-8" />
                    Nueva Transferencia
                </h1>
                <p className="text-muted-foreground">
                    Inicia un movimiento de stock entre sucursales
                </p>
            </div>

            <TransferenciaForm />
        </div>
    )
}
