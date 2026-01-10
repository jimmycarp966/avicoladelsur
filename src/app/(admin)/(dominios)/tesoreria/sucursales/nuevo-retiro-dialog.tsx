'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Banknote, Loader2, Truck } from 'lucide-react'
import { registrarRetiroSucursalAction } from '@/actions/tesoreria.actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NuevoRetiroDialogProps {
    sucursalId: string
    sucursalNombre: string
}

export function NuevoRetiroDialog({ sucursalId, sucursalNombre }: NuevoRetiroDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [rutasActivas, setRutasActivas] = useState<any[]>([])
    const [vehiculos, setVehiculos] = useState<any[]>([])
    const [tipoAsignacion, setTipoAsignacion] = useState<'ruta' | 'vehiculo'>('ruta')
    const router = useRouter()
    const supabase = createClient()

    // Cargar rutas activas y vehículos
    useEffect(() => {
        if (open) {
            const fetchData = async () => {
                // Rutas en curso hoy
                const hoy = new Date().toISOString().split('T')[0]
                const { data: rutas } = await supabase
                    .from('rutas_reparto')
                    .select(`
            id,
            numero_ruta,
            repartidor:usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido),
            vehiculo:vehiculos(patente)
          `)
                    .eq('estado', 'en_curso')
                    .gte('fecha_ruta', hoy)

                setRutasActivas(rutas || [])

                // Vehículos disponibles
                const { data: vehs } = await supabase
                    .from('vehiculos')
                    .select('id, patente, marca, modelo')
                    .eq('activo', true)

                setVehiculos(vehs || [])
            }

            fetchData()
        }
    }, [open])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const formData = new FormData(e.currentTarget)
            formData.set('sucursal_id', sucursalId)

            const result = await registrarRetiroSucursalAction(formData)

            if (result.success) {
                toast.success(result.message)
                setOpen(false)
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error('Error al registrar retiro')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Banknote className="h-4 w-4" />
                    Entregar Retiro a Chofer
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Nuevo Retiro de Sucursal
                    </DialogTitle>
                    <DialogDescription>
                        Registrar entrega de efectivo al chofer para envío a Casa Central.
                        <br />
                        <span className="font-medium">Sucursal: {sucursalNombre}</span>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4">
                        {/* Monto */}
                        <div className="space-y-2">
                            <Label htmlFor="monto">Monto a Retirar *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="monto"
                                    name="monto"
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="pl-7"
                                    required
                                />
                            </div>
                        </div>

                        {/* Tipo de asignación */}
                        <div className="space-y-2">
                            <Label>Asignar a</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={tipoAsignacion === 'ruta' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTipoAsignacion('ruta')}
                                >
                                    Ruta Activa
                                </Button>
                                <Button
                                    type="button"
                                    variant={tipoAsignacion === 'vehiculo' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTipoAsignacion('vehiculo')}
                                >
                                    Vehículo
                                </Button>
                            </div>
                        </div>

                        {/* Selector de ruta o vehículo */}
                        {tipoAsignacion === 'ruta' ? (
                            <div className="space-y-2">
                                <Label htmlFor="ruta_id">Ruta Activa</Label>
                                <Select name="ruta_id">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar ruta..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rutasActivas.length === 0 ? (
                                            <SelectItem value="none" disabled>
                                                No hay rutas activas
                                            </SelectItem>
                                        ) : (
                                            rutasActivas.map((ruta) => (
                                                <SelectItem key={ruta.id} value={ruta.id}>
                                                    Ruta {ruta.numero_ruta} - {ruta.repartidor?.nombre} {ruta.repartidor?.apellido}
                                                    {ruta.vehiculo?.patente && ` (${ruta.vehiculo.patente})`}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="vehiculo_id">Vehículo</Label>
                                <Select name="vehiculo_id">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar vehículo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehiculos.map((vehiculo) => (
                                            <SelectItem key={vehiculo.id} value={vehiculo.id}>
                                                {vehiculo.patente} - {vehiculo.marca} {vehiculo.modelo}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Nombre del chofer */}
                        <div className="space-y-2">
                            <Label htmlFor="chofer_nombre">Nombre del Chofer *</Label>
                            <Input
                                id="chofer_nombre"
                                name="chofer_nombre"
                                placeholder="Nombre completo del chofer"
                                required
                            />
                        </div>

                        {/* Descripción */}
                        <div className="space-y-2">
                            <Label htmlFor="descripcion">Descripción (opcional)</Label>
                            <Textarea
                                id="descripcion"
                                name="descripcion"
                                placeholder="Notas adicionales..."
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* Alerta informativa */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                        <strong>Nota:</strong> El monto se descontará inmediatamente de la caja de esta sucursal.
                        El ingreso a Casa Central se registrará cuando Tesorería valide la ruta.
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Registrando...
                                </>
                            ) : (
                                'Registrar Retiro'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
