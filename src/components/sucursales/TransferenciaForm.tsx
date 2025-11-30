'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { crearTransferenciaAction, listarSucursales, obtenerStockPorSucursal } from '@/actions/sucursales-transferencias.actions'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const formSchema = z.object({
    sucursal_origen_id: z.string().min(1, 'Seleccione origen'),
    sucursal_destino_id: z.string().min(1, 'Seleccione destino'),
    motivo: z.string().optional(),
    observaciones: z.string().optional(),
    items: z.array(z.object({
        producto_id: z.string().min(1, 'Seleccione producto'),
        cantidad: z.coerce.number().min(0.001, 'Cantidad requerida'),
    })).min(1, 'Agregue al menos un item'),
})

type FormValues = z.infer<typeof formSchema>

export function TransferenciaForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [sucursales, setSucursales] = useState<any[]>([])
    const [stockOrigen, setStockOrigen] = useState<any[]>([])
    const [loadingStock, setLoadingStock] = useState(false)

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            sucursal_origen_id: searchParams.get('origen') || '',
            sucursal_destino_id: '',
            motivo: '',
            observaciones: '',
            items: [{ producto_id: searchParams.get('producto') || '', cantidad: 0 }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'items',
    })

    const sucursalOrigenId = form.watch('sucursal_origen_id')

    useEffect(() => {
        loadSucursales()
    }, [])

    useEffect(() => {
        if (sucursalOrigenId) {
            loadStock(sucursalOrigenId)
        } else {
            setStockOrigen([])
        }
    }, [sucursalOrigenId])

    async function loadSucursales() {
        const data = await listarSucursales()
        setSucursales(data)
    }

    async function loadStock(sucursalId: string) {
        setLoadingStock(true)
        try {
            const data = await obtenerStockPorSucursal(sucursalId)
            setStockOrigen(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingStock(false)
        }
    }

    async function onSubmit(values: FormValues) {
        if (values.sucursal_origen_id === values.sucursal_destino_id) {
            toast.error('La sucursal de destino debe ser diferente a la de origen')
            return
        }

        setIsSubmitting(true)
        try {
            // Preparar FormData
            const formData = new FormData()
            formData.append('sucursal_origen_id', values.sucursal_origen_id)
            formData.append('sucursal_destino_id', values.sucursal_destino_id)
            if (values.motivo) formData.append('motivo', values.motivo)
            if (values.observaciones) formData.append('observaciones', values.observaciones)
            formData.append('items', JSON.stringify(values.items))

            const result = await crearTransferenciaAction(formData)

            if (result.success) {
                toast.success('Transferencia creada exitosamente')
                router.push('/sucursales/transferencias')
                router.refresh()
            } else {
                toast.error(result.message || 'Error al crear transferencia')
            }
        } catch (error) {
            toast.error('Ocurrió un error inesperado')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardContent className="pt-6 grid gap-6 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="sucursal_origen_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sucursal Origen</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar origen" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {sucursales.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="sucursal_destino_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sucursal Destino</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar destino" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {sucursales
                                                .filter(s => s.id !== sucursalOrigenId)
                                                .map((s) => (
                                                    <SelectItem key={s.id} value={s.id}>
                                                        {s.nombre}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="motivo"
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Motivo (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Reabastecimiento semanal" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">Items a Transferir</h3>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => append({ producto_id: '', cantidad: 0 })}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Agregar Item
                            </Button>
                        </div>

                        {fields.map((field, index) => (
                            <div key={field.id} className="grid gap-4 md:grid-cols-3 items-end border p-4 rounded-md">
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.producto_id`}
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Producto</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!sucursalOrigenId}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={loadingStock ? "Cargando..." : "Seleccionar producto"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {stockOrigen.map((item) => (
                                                        <SelectItem key={item.producto.id} value={item.producto.id}>
                                                            {item.producto.nombre} (Disp: {item.cantidad_total})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex gap-2">
                                    <FormField
                                        control={form.control}
                                        name={`items.${index}.cantidad`}
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormLabel>Cantidad</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.001" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="mb-2"
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Crear Transferencia
                    </Button>
                </div>
            </form>
        </Form>
    )
}
