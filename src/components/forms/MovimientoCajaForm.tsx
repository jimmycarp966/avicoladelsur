'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { movimientoCajaSchema, type MovimientoCajaFormData } from '@/lib/schemas/tesoreria.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useNotificationStore } from '@/store/notificationStore'
import { Loader2, Save } from 'lucide-react'

interface MovimientoCajaFormProps {
  cajas: Array<{ id: string; nombre: string }>
}

export function MovimientoCajaForm({ cajas }: MovimientoCajaFormProps) {
  const { showToast } = useNotificationStore()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<MovimientoCajaFormData>({
    resolver: zodResolver(movimientoCajaSchema),
    defaultValues: {
      tipo: 'ingreso',
      metodo_pago: 'efectivo',
    },
  })

  const onSubmit = (values: MovimientoCajaFormData) => {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/tesoreria/movimientos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Error al registrar movimiento')
        }
        showToast('success', 'Movimiento registrado')
        form.reset({ tipo: 'ingreso', metodo_pago: 'efectivo' })
      } catch (err: any) {
        const message = err.message || 'No se pudo registrar el movimiento'
        setError(message)
        showToast('error', message)
      }
    })
  }

  return (
    <Card className="border-l-[3px] border-l-success">
      <CardHeader>
        <CardTitle className="text-success">Registrar movimiento</CardTitle>
        <CardDescription>Ingresa ingresos o egresos manuales</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Caja</label>
            <Select onValueChange={(value) => form.setValue('caja_id', value)} value={form.watch('caja_id')}>
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
              <p className="text-sm text-destructive">{form.formState.errors.caja_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select onValueChange={(value) => form.setValue('tipo', value as 'ingreso' | 'egreso')} value={form.watch('tipo')}>
                <SelectTrigger disabled={isPending}>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.tipo && (
                <p className="text-sm text-destructive">{form.formState.errors.tipo.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Método de pago</label>
              <Select
                onValueChange={(value) => form.setValue('metodo_pago', value as 'efectivo' | 'transferencia' | 'tarjeta')}
                value={form.watch('metodo_pago')}
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
              {form.formState.errors.metodo_pago && (
                <p className="text-sm text-destructive">{form.formState.errors.metodo_pago.message}</p>
              )}
            </div>
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
              <p className="text-sm text-destructive">{form.formState.errors.monto.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción</label>
            <Input placeholder="Detalle del movimiento" {...form.register('descripcion')} disabled={isPending} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isPending} className="w-full bg-success hover:bg-success/90">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Registrar movimiento
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

