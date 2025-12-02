import { TransferenciaForm } from '@/components/sucursales/TransferenciaForm'
import { ArrowRightLeft } from 'lucide-react'

export default function NuevaTransferenciaPage() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <ArrowRightLeft className="w-8 h-8" />
                    Distribuir desde Almacén Central
                </h1>
                <p className="text-muted-foreground">
                    Distribuye productos desde el almacén central hacia las sucursales operativas
                </p>
            </div>

            <TransferenciaForm />
        </div>
    )
}
