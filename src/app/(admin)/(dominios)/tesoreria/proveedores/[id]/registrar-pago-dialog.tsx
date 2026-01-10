'use client'

import { useState, useEffect } from 'react'
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
import { CreditCard, Plus } from 'lucide-react'
import { registrarPagoProveedorAction, obtenerFacturasPendientesProveedorAction } from '@/actions/proveedores.actions'
import { listarCajasAction } from '@/actions/tesoreria.actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

interface RegistrarPagoDialogProps {
    proveedorId: string
    proveedorNombre: string
}

interface Factura {
    id: string
    numero_factura: string
    monto_total: number
    monto_pagado: number
    saldo_pendiente: number
    fecha_vencimiento: string | null
}

interface Caja {
    id: string
    nombre: string
    saldo_actual: number
}

export function RegistrarPagoDialog({ proveedorId, proveedorNombre }: RegistrarPagoDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [facturas, setFacturas] = useState<Factura[]>([])
    const [cajas, setCajas] = useState<Caja[]>([])
    const [selectedFactura, setSelectedFactura] = useState<string>('')
    const [monto, setMonto] = useState('')
    const router = useRouter()

    useEffect(() => {
        if (open) {
            loadData()
        }
    }, [open])

    async function loadData() {
        const [facturasResult, cajasResult] = await Promise.all([
            obtenerFacturasPendientesProveedorAction(proveedorId),
            listarCajasAction()
        ])

        if (facturasResult.success) {
            setFacturas(facturasResult.data || [])
        }
        setCajas(cajasResult || [])
    }

    function handleFacturaChange(facturaId: string) {
        setSelectedFactura(facturaId)
        if (facturaId && facturaId !== 'a_cuenta') {
            const factura = facturas.find(f => f.id === facturaId)
            if (factura) {
                setMonto(factura.saldo_pendiente.toString())
            }
        } else {
            setMonto('')
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        formData.set('proveedor_id', proveedorId)

        // Si es pago a cuenta, no enviar factura_id
        if (selectedFactura === 'a_cuenta') {
            formData.delete('factura_id')
        }

        const result = await registrarPagoProveedorAction(formData)

        if (result.success) {
            toast.success(result.message)
            setOpen(false)
            setSelectedFactura('')
            setMonto('')
            router.refresh()
        } else {
            toast.error(result.error)
        }

        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="default" className="gap-2 bg-green-600 hover:bg-green-700">
                    <CreditCard className="h-4 w-4" />
                    Registrar Pago
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-green-600" />
                        Registrar Pago
                    </DialogTitle>
                    <DialogDescription>
                        Registra un pago a {proveedorNombre}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="factura_id">Factura (opcional)</Label>
                            <Select
                                name="factura_id"
                                value={selectedFactura}
                                onValueChange={handleFacturaChange}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar factura o pago a cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="a_cuenta">
                                        💰 Pago a cuenta (sin factura)
                                    </SelectItem>
                                    {facturas.map(f => (
                                        <SelectItem key={f.id} value={f.id}>
                                            {f.numero_factura} - Pendiente: {formatCurrency(f.saldo_pendiente)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {facturas.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                    No hay facturas pendientes. El pago se registrará a cuenta.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="caja_id">Caja de Origen *</Label>
                            <Select name="caja_id" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar caja" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cajas.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.nombre} ({formatCurrency(c.saldo_actual)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="monto">Monto *</Label>
                                <Input
                                    id="monto"
                                    name="monto"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0.00"
                                    value={monto}
                                    onChange={(e) => setMonto(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="metodo_pago">Método de Pago</Label>
                                <Select name="metodo_pago" defaultValue="transferencia">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="transferencia">Transferencia</SelectItem>
                                        <SelectItem value="efectivo">Efectivo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="numero_transaccion">Nº Transacción (opcional)</Label>
                            <Input
                                id="numero_transaccion"
                                name="numero_transaccion"
                                placeholder="Número de transferencia bancaria"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="descripcion">Descripción</Label>
                            <Textarea
                                id="descripcion"
                                name="descripcion"
                                placeholder="Detalle del pago..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
                            {loading ? 'Procesando...' : 'Registrar Pago'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
