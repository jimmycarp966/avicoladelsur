'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { crearCajaSchema, type CrearCajaFormData } from '@/lib/schemas/tesoreria.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'

export function CajaForm() {
  const [isSubmitting, startTransition] = useTransition()
  const { showToast } = useNotificationStore()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<CrearCajaFormData>({
    resolver: zodResolver(crearCajaSchema),
    defaultValues: {
      nombre: '',
      saldo_inicial: 0,
      moneda: 'ARS',
      sucursal_id: undefined,
    },
  })

  const onSubmit = (values: CrearCajaFormData) => {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/tesoreria/cajas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Error al crear caja')
        }

        showToast('success', 'Caja creada correctamente')
        form.reset()
      } catch (err: any) {
        const message = err.message || 'No se pudo crear la caja'
        setError(message)
        showToast('error', message)
      }
    })
  }

  return (
    <Card className="border-l-[3px] border-l-primary">
      <CardHeader>
        <CardTitle className="text-primary">Nueva caja</CardTitle>
        <CardDescription>Registra una caja física o virtual para tus operaciones diarias</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <Input placeholder="Caja Principal" {...form.register('nombre')} disabled={isSubmitting} />
            {form.formState.errors.nombre && (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Saldo inicial</label>
              <Input
                type="number"
                step="0.01"
                {...form.register('saldo_inicial', { valueAsNumber: true })}
                disabled={isSubmitting}
              />
              {form.formState.errors.saldo_inicial && (
                <p className="text-sm text-destructive">{form.formState.errors.saldo_inicial.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Moneda</label>
              <Input placeholder="ARS" {...form.register('moneda')} disabled={isSubmitting} />
              {form.formState.errors.moneda && (
                <p className="text-sm text-destructive">{form.formState.errors.moneda.message}</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar caja
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

