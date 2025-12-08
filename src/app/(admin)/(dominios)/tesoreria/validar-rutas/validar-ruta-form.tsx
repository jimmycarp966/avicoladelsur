'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { validarRutaAction } from '@/actions/tesoreria.actions'
import { Button } from '@/components/ui/button'
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
import { CheckCircle2, RefreshCw } from 'lucide-react'

interface ValidarRutaFormProps {
  ruta: any
  cajas: any[]
}

export function ValidarRutaForm({ ruta, cajas }: ValidarRutaFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [montoFisico, setMontoFisico] = useState('')
  const [cajaId, setCajaId] = useState(cajas[0]?.id || '')
  const [observaciones, setObservaciones] = useState('')

  const totalRegistrado = ruta.recaudacion_total_registrada || 0
  const diferencia = montoFisico ? Number(montoFisico) - totalRegistrado : 0

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!cajaId) {
      toast.error('Selecciona una caja')
      return
    }

    if (!montoFisico || Number(montoFisico) <= 0) {
      toast.error('Ingresa el monto físico recibido')
      return
    }

    setLoading(true)

    const formData = new FormData()
    formData.append('ruta_id', ruta.id)
    formData.append('monto_fisico_recibido', montoFisico)
    formData.append('caja_id', cajaId)
    if (observaciones) {
      formData.append('observaciones', observaciones)
    }

    const result = await validarRutaAction(formData)

    setLoading(false)

    if (result.success) {
      toast.success(result.message || 'Ruta validada exitosamente')
      router.refresh()
    } else {
      toast.error(result.error || 'Error al validar la ruta')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="caja_id">Caja para acreditar *</Label>
          <Select value={cajaId} onValueChange={setCajaId} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una caja" />
            </SelectTrigger>
            <SelectContent>
              {cajas.map((caja) => (
                <SelectItem key={caja.id} value={caja.id}>
                  {caja.nombre} - Saldo: ${Number(caja.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monto_fisico_recibido">
            Monto físico recibido *
          </Label>
          <Input
            id="monto_fisico_recibido"
            type="number"
            step="0.01"
            value={montoFisico}
            onChange={(e) => setMontoFisico(e.target.value)}
            placeholder={`${totalRegistrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
            required
          />
          {montoFisico && (
            <p className={`text-xs ${diferencia === 0 ? 'text-green-600' : diferencia > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {diferencia === 0
                ? '✓ Coincide con el monto registrado'
                : diferencia > 0
                ? `+$${diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })} de diferencia (sobrante)`
                : `-$${Math.abs(diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })} de diferencia (faltante)`}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea
          id="observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Notas sobre la validación, discrepancias, etc."
          rows={3}
        />
      </div>

      <div className="bg-muted/50 p-3 rounded-lg text-sm">
        <p className="font-medium mb-1">Resumen:</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>• Total registrado: ${totalRegistrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</li>
          <li>• Entregas con pago: {ruta.detalles_ruta?.filter((d: any) => d.pago_registrado && d.monto_cobrado_registrado > 0).length || 0}</li>
          <li>• Al validar se crearán movimientos de caja agrupados por método de pago (efectivo, transferencia, QR, tarjeta)</li>
          <li>• Los pagos en cuenta corriente se aplicarán a la cuenta del cliente (no afectan caja)</li>
          <li>• Los pedidos se marcarán como pagados</li>
        </ul>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Validando...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Validar Ruta y Acreditar en Caja
          </>
        )}
      </Button>
    </form>
  )
}

