'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { FileText, Plus } from 'lucide-react'
import { crearFacturaProveedorAction } from '@/actions/proveedores.actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface RegistrarFacturaDialogProps {
    proveedorId: string
    proveedorNombre: string
}

export function RegistrarFacturaDialog({ proveedorId, proveedorNombre }: RegistrarFacturaDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        formData.set('proveedor_id', proveedorId)

        const result = await crearFacturaProveedorAction(formData)

        if (result.success) {
            toast.success(result.message)
            setOpen(false)
            router.refresh()
        } else {
            toast.error(result.error)
        }

        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva Factura
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Registrar Factura
                    </DialogTitle>
                    <DialogDescription>
                        Registra una nueva factura de {proveedorNombre}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="numero_factura">Número de Factura *</Label>
                                <Input
                                    id="numero_factura"
                                    name="numero_factura"
                                    placeholder="0001-00012345"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tipo_comprobante">Tipo</Label>
                                <Select name="tipo_comprobante" defaultValue="factura">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="factura">Factura</SelectItem>
                                        <SelectItem value="remito">Remito</SelectItem>
                                        <SelectItem value="recibo">Recibo</SelectItem>
                                        <SelectItem value="nota_credito">Nota de Crédito</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fecha_emision">Fecha Emisión *</Label>
                                <Input
                                    id="fecha_emision"
                                    name="fecha_emision"
                                    type="date"
                                    required
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fecha_vencimiento">Fecha Vencimiento</Label>
                                <Input
                                    id="fecha_vencimiento"
                                    name="fecha_vencimiento"
                                    type="date"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="monto_total">Monto Total *</Label>
                            <Input
                                id="monto_total"
                                name="monto_total"
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="descripcion">Descripción</Label>
                            <Textarea
                                id="descripcion"
                                name="descripcion"
                                placeholder="Detalle de la factura..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : 'Registrar Factura'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
