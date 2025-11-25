'use client'

import { useState, useTransition } from 'react'
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registrarGastoSchema, type RegistrarGastoFormData } from '@/lib/schemas/tesoreria.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useNotificationStore } from '@/store/notificationStore'
import { Loader2, Save, Upload, X } from 'lucide-react'
import { uploadFileToStorage } from '@/lib/supabase/storage'

interface GastoFormProps {
  categorias: Array<{ id: string; nombre: string }>
  cajas: Array<{ id: string; nombre: string }>
}

export function GastoForm({ categorias, cajas }: GastoFormProps) {
  const { showToast } = useNotificationStore()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  const form = useForm<RegistrarGastoFormData>({
    resolver: zodResolver(registrarGastoSchema) as Resolver<RegistrarGastoFormData>,
    defaultValues: {
      afecta_caja: false,
      metodo_pago: 'efectivo',
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tamaño (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast('error', 'El archivo no puede ser mayor a 10MB')
        return
      }
      // Validar tipo (solo imágenes y PDFs)
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      if (!validTypes.includes(file.type)) {
        showToast('error', 'Solo se permiten imágenes (JPG, PNG) o PDFs')
        return
      }
      setSelectedFile(file)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    form.setValue('comprobante_url', undefined)
  }

  const onSubmit: SubmitHandler<RegistrarGastoFormData> = (values) => {
    setError(null)
    startTransition(async () => {
      try {
        let comprobanteUrl = values.comprobante_url

        // Subir archivo si existe
        if (selectedFile) {
          setUploadingFile(true)
          try {
            const { url } = await uploadFileToStorage('gastos', selectedFile)
            comprobanteUrl = url
          } catch (uploadError: any) {
            throw new Error(`Error al subir comprobante: ${uploadError.message}`)
          } finally {
            setUploadingFile(false)
          }
        }

        const response = await fetch('/api/gastos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, comprobante_url: comprobanteUrl }),
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Error al registrar gasto')
        }

        showToast('success', 'Gasto registrado correctamente')
        form.reset({ afecta_caja: false })
        setSelectedFile(null)
      } catch (err: any) {
        const message = err.message || 'No se pudo registrar el gasto'
        setError(message)
        showToast('error', message)
      }
    })
  }

  return (
    <Card className="border-l-[3px] border-l-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Registrar gasto</CardTitle>
        <CardDescription>Controla los egresos vinculados a tus operaciones</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría</label>
              <Select
                onValueChange={(value) => form.setValue('categoria_id', value)}
                value={form.watch('categoria_id')}
              >
                <SelectTrigger disabled={isPending}>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoria_id && (
                <p className="text-sm text-destructive">{form.formState.errors.categoria_id.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha</label>
              <Input type="date" {...form.register('fecha')} disabled={isPending} />
              {form.formState.errors.fecha && (
                <p className="text-sm text-destructive">{form.formState.errors.fecha.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="text-sm font-medium">Método de pago</label>
              <Select
                value={form.watch('metodo_pago') || 'efectivo'}
                onValueChange={(value) => form.setValue('metodo_pago', value as 'efectivo' | 'transferencia' | 'qr' | 'tarjeta')}
              >
                <SelectTrigger disabled={isPending}>
                  <SelectValue placeholder="Selecciona método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="qr">QR</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.metodo_pago && (
                <p className="text-sm text-destructive">{form.formState.errors.metodo_pago.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">¿Afecta caja?</label>
              <Select
                value={form.watch('afecta_caja') ? 'true' : 'false'}
                onValueChange={(value) => form.setValue('afecta_caja', value === 'true')}
              >
                <SelectTrigger disabled={isPending}>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.watch('afecta_caja') && (
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
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción</label>
            <Textarea rows={3} placeholder="Detalle del gasto" {...form.register('descripcion')} disabled={isPending} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Comprobante</label>
            {!selectedFile ? (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileChange}
                  disabled={isPending || uploadingFile}
                  className="cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">O ingresa URL manual:</span>
                <Input
                  type="url"
                  placeholder="https://..."
                  {...form.register('comprobante_url')}
                  disabled={isPending || uploadingFile}
                  className="flex-1"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  disabled={isPending || uploadingFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {uploadingFile && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Subiendo archivo...
              </p>
            )}
            {form.formState.errors.comprobante_url && (
              <p className="text-sm text-destructive">{form.formState.errors.comprobante_url.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isPending || uploadingFile} className="w-full bg-destructive hover:bg-destructive/90">
            {isPending || uploadingFile ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadingFile ? 'Subiendo archivo...' : 'Guardando...'}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Registrar gasto
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

