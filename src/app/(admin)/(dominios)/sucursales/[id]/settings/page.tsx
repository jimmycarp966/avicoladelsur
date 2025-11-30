'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { actualizarSettingSucursalAction } from '@/actions/sucursales.actions'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

interface PageProps {
    params: {
        id: string
    }
}

export default function SucursalSettingsPage({ params }: PageProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [threshold, setThreshold] = useState(5)

    async function handleSave() {
        setIsSubmitting(true)
        try {
            const result = await actualizarSettingSucursalAction({
                sucursalId: params.id,
                lowStockThresholdDefault: Number(threshold)
            })

            if (result.success) {
                toast.success('Configuración actualizada')
                router.refresh()
            } else {
                toast.error(result.error || 'Error al actualizar')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configuración de Sucursal</h1>
                <p className="text-muted-foreground">
                    Ajusta los parámetros operativos de esta sucursal
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Alertas de Stock</CardTitle>
                    <CardDescription>
                        Configura cuándo se deben generar alertas automáticas de stock bajo
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="threshold">Umbral de Stock Bajo (Unidades)</Label>
                        <Input
                            id="threshold"
                            type="number"
                            min="1"
                            value={threshold}
                            onChange={(e) => setThreshold(Number(e.target.value))}
                        />
                        <p className="text-sm text-muted-foreground">
                            Se generará una alerta cuando el stock de un producto caiga por debajo de este valor.
                        </p>
                    </div>

                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Cambios
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
