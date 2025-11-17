'use client'

import { useTransition, useState } from 'react'
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  registrarPagoPedidoSchema,
  type RegistrarPagoPedidoFormData,
} from '@/lib/schemas/tesoreria.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'

interface RegistrarPagoPedidoFormProps {
  pedidoId: string
  cajas: Array<{ id: string; nombre: string }>
  saldoPendiente: number
}

export function RegistrarPagoPedidoForm({ pedidoId, cajas, saldoPendiente }: RegistrarPagoPedidoFormProps) {
  const [isPending, startTransition] = useTransition()
  const { showToast } = useNotificationStore()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<RegistrarPagoPedidoFormData>({
    resolver: zodResolver(registrarPagoPedidoSchema) as Resolver<RegistrarPagoPedidoFormData>,
    defaultValues: {
      pedido_id: pedidoId,
      tipo_pago: 'efectivo',
      monto: Number(saldoPendiente) > 0 ? Number(saldoPendiente) : undefined,
    },
  })

  const onSubmit: SubmitHandler<RegistrarPagoPedidoFormData> = (values) => {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/cuentas_corrientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'registrarPago', ...values }),
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'No se pudo registrar el pago')
        }
        showToast('success', 'Pago registrado')
        form.reset({
          pedido_id: pedidoId,
          tipo_pago: 'efectivo',
          monto: undefined,
          caja_id: undefined,
        })
      } catch (err: any) {
        const message = err.message || 'No se pudo registrar el pago'
        setError(message)
        showToast('error', message)
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium">Caja</label>
        <Select value={form.watch('caja_id')} onValueChange={(value) => form.setValue('caja_id', value)}>
          <SelectTrigger disabled={isPending}>
            <SelectValue placeholder="Selecciona una caja" />
          </SelectTrigger>
          <SelectContent>
            {cajas.map((caja) => (
              <SelectItem key={caja.id} value={caja.id}>
                {caja.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.caja_id && (
          <p className="text-xs text-destructive">{form.formState.errors.caja_id.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Monto</label>
        <Input
          type="number"
          step="0.01"
          {...form.register('monto', { valueAsNumber: true })}
          disabled={isPending}
        />
        {form.formState.errors.monto && (
          <p className="text-xs text-destructive">{form.formState.errors.monto.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Método de pago</label>
        <Select
          value={form.watch('tipo_pago')}
          onValueChange={(value) => form.setValue('tipo_pago', value as 'efectivo' | 'transferencia' | 'tarjeta')}
        >
          <SelectTrigger disabled={isPending}>
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="transferencia">Transferencia</SelectItem>
            <SelectItem value="tarjeta">Tarjeta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Registrar pago
          </>
        )}
      </Button>
    </form>
  )
}

