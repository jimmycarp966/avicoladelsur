'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FacturaPendiente {
    id: string
    numero_factura: string
    total: number
    saldo_pendiente: number
    estado_pago: string
}

interface RegistrarPagoFormProps {
    clienteId: string
    saldoActual: number
    facturasPendientes: FacturaPendiente[]
}

export function RegistrarPagoForm({ clienteId, saldoActual, facturasPendientes }: RegistrarPagoFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [monto, setMonto] = useState('')
    const [metodoPago, setMetodoPago] = useState('efectivo')
    const [facturaId, setFacturaId] = useState<string>('none')
    const [descripcion, setDescripcion] = useState('')
    const [numeroTransaccion, setNumeroTransaccion] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const montoNum = parseFloat(monto)
        if (!montoNum || montoNum <= 0) {
            toast.error('Ingrese un monto válido')
            return
        }

        if (metodoPago === 'transferencia' && !numeroTransaccion) {
            toast.error('Ingrese el número de transacción')
            return
        }

        setLoading(true)

        try {
            const supabase = createClient()

            // Llamar a la función RPC
            const { data, error } = await supabase.rpc('fn_registrar_pago_cuenta_corriente', {
                p_cliente_id: clienteId,
                p_monto: montoNum,
                p_metodo_pago: metodoPago,
                p_descripcion: descripcion || `Pago ${metodoPago}${numeroTransaccion ? ` - Trans: ${numeroTransaccion}` : ''}`,
                p_factura_id: facturaId === 'none' ? null : facturaId,
            })

            if (error) throw error

            const result = data as any

            if (!result.success) {
                throw new Error(result.error || 'Error al registrar pago')
            }

            toast.success('Pago registrado exitosamente', {
                description: `Nuevo saldo: ${formatCurrency(result.saldo_nuevo)}`
            })

            // Limpiar formulario
            setMonto('')
            setDescripcion('')
            setNumeroTransaccion('')
            setFacturaId('none')

            // Refrescar página
            router.refresh()
        } catch (error: any) {
            console.error('Error registrando pago:', error)
            toast.error(error.message || 'Error al registrar el pago')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Saldo actual */}
            <div className="p-3 rounded-lg bg-muted/50 mb-4">
                <p className="text-sm text-muted-foreground">Saldo actual de cuenta corriente</p>
                <p className={`text-xl font-bold ${saldoActual > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(saldoActual)}
                </p>
            </div>

            {/* Monto */}
            <div className="space-y-2">
                <Label htmlFor="monto">Monto a abonar *</Label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                        id="monto"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        className="pl-7"
                        required
                    />
                </div>
                {parseFloat(monto) > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Saldo después del pago: {formatCurrency(saldoActual - parseFloat(monto))}
                    </p>
                )}
            </div>

            {/* Método de pago */}
            <div className="space-y-2">
                <Label htmlFor="metodoPago">Método de pago *</Label>
                <Select value={metodoPago} onValueChange={setMetodoPago}>
                    <SelectTrigger>
                        <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                        <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                        <SelectItem value="tarjeta">💳 Tarjeta</SelectItem>
                        <SelectItem value="cheque">📝 Cheque</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Número de transacción (si es transferencia) */}
            {metodoPago === 'transferencia' && (
                <div className="space-y-2">
                    <Label htmlFor="numeroTransaccion">Número de transacción *</Label>
                    <Input
                        id="numeroTransaccion"
                        placeholder="Ej: 12345678"
                        value={numeroTransaccion}
                        onChange={(e) => setNumeroTransaccion(e.target.value)}
                        required
                    />
                </div>
            )}

            {/* Asociar a factura (opcional) */}
            {facturasPendientes.length > 0 && (
                <div className="space-y-2">
                    <Label htmlFor="factura">Asociar a factura (opcional)</Label>
                    <Select value={facturaId} onValueChange={setFacturaId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Sin asociar a factura específica" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Sin asociar</SelectItem>
                            {facturasPendientes.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                    #{f.numero_factura} - Pendiente: {formatCurrency(f.saldo_pendiente)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Si selecciona una factura, el pago se aplicará primero a esa factura
                    </p>
                </div>
            )}

            {/* Descripción */}
            <div className="space-y-2">
                <Label htmlFor="descripcion">Observaciones (opcional)</Label>
                <Textarea
                    id="descripcion"
                    placeholder="Notas adicionales sobre el pago..."
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                />
            </div>

            {/* Botón submit */}
            <Button
                type="submit"
                className="w-full"
                disabled={loading || !monto || parseFloat(monto) <= 0}
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Registrar Pago de {monto ? formatCurrency(parseFloat(monto)) : '$0'}
                    </>
                )}
            </Button>
        </form>
    )
}
