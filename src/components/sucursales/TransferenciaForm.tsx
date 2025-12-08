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
import { crearTransferenciaAction, listarSucursalesAction, obtenerAlmacenCentralAction, obtenerStockPorSucursalAction, obtenerProductosAlmacenCentralAction } from '@/actions/sucursales-transferencias.actions'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Search } from 'lucide-react'

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
    const [almacenCentral, setAlmacenCentral] = useState<any>(null)
    const [stockOrigen, setStockOrigen] = useState<any[]>([])
    const [stockOrigenFiltrado, setStockOrigenFiltrado] = useState<any[]>([])
    const [loadingStock, setLoadingStock] = useState(false)
    const [busquedaProducto, setBusquedaProducto] = useState('')

    // ID fijo del almacén central
    const ALMACEN_CENTRAL_ID = '00000000-0000-0000-0000-000000000001'

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            sucursal_origen_id: ALMACEN_CENTRAL_ID, // Siempre desde almacén central
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
        loadAlmacenCentral()
        loadSucursales()
    }, [])

    useEffect(() => {
        if (sucursalOrigenId && sucursalOrigenId === '00000000-0000-0000-0000-000000000001') {
            loadStock(sucursalOrigenId)
        } else if (sucursalOrigenId) {
            loadStock(sucursalOrigenId)
        } else {
            setStockOrigen([])
            setStockOrigenFiltrado([])
        }
    }, [sucursalOrigenId])

    // Filtrar productos cuando cambie la búsqueda
    useEffect(() => {
        if (busquedaProducto.trim() === '') {
            setStockOrigenFiltrado(stockOrigen)
        } else {
            const filtrados = stockOrigen.filter(item =>
                item.producto.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
                item.producto.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
            )
            setStockOrigenFiltrado(filtrados)
        }
    }, [stockOrigen, busquedaProducto])

    // Forzar re-render cuando almacenCentral se carga
    useEffect(() => {
        // Asegurar que siempre tenga el ID del almacén central
        if (!sucursalOrigenId || sucursalOrigenId !== ALMACEN_CENTRAL_ID) {
            form.setValue('sucursal_origen_id', ALMACEN_CENTRAL_ID)
        }
    }, [sucursalOrigenId, form])

    async function loadAlmacenCentral() {
        console.log('Cargando almacén central...')
        try {
            const data = await obtenerAlmacenCentralAction()
            console.log('Almacén central obtenido:', data)
            if (data) {
                setAlmacenCentral(data)
                // El ID ya está seteado en defaultValues, solo actualizar si es necesario
                console.log('Almacén central cargado:', data.id)
            } else {
                // Si no existe, crear objeto con ID conocido para mostrar en UI
                setAlmacenCentral({ id: ALMACEN_CENTRAL_ID, nombre: 'Casa Central' })
                console.log('Usando ID por defecto del almacén central')
            }
        } catch (error) {
            console.error('Error cargando almacén central:', error)
            // Fallback: usar ID conocido
            setAlmacenCentral({ id: ALMACEN_CENTRAL_ID, nombre: 'Casa Central' })
        }
    }

    async function loadSucursales() {
        const data = await listarSucursalesAction()
        setSucursales(data)
    }

    async function loadStock(sucursalId: string) {
        setLoadingStock(true)
        try {
            console.log('Cargando stock para sucursal:', sucursalId)

            let data
            // Si es el almacén central, mostrar TODOS los productos disponibles
            if (sucursalId === '00000000-0000-0000-0000-000000000001') {
                console.log('Cargando productos del almacén central')
                data = await obtenerProductosAlmacenCentralAction()
            } else {
                console.log('Cargando stock de sucursal regular')
                data = await obtenerStockPorSucursalAction(sucursalId)
            }

            console.log('Productos/stock obtenido:', data)
            setStockOrigen(data)
            setStockOrigenFiltrado(data) // Inicialmente mostrar todos
            if (data.length === 0) {
                console.warn('No se encontraron productos disponibles en la sucursal seleccionada')
            }
        } catch (error) {
            console.error('Error cargando stock:', error)
            toast.error('Error al cargar productos disponibles')
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
                                    <FormLabel>Almacén Origen</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={almacenCentral ? "Seleccionar almacén" : "Cargando almacén central..."} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {almacenCentral ? (
                                                <SelectItem value={almacenCentral.id}>
                                                    {almacenCentral.nombre} (Almacén Central)
                                                </SelectItem>
                                            ) : (
                                                <SelectItem value="loading" disabled>
                                                    Cargando almacén central...
                                                </SelectItem>
                                            )}
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

                {/* Campo de búsqueda de productos */}
                {sucursalOrigenId && stockOrigen.length > 5 && (
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={`Buscar productos (${stockOrigenFiltrado.length} de ${stockOrigen.length})...`}
                            value={busquedaProducto}
                            onChange={(e) => setBusquedaProducto(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                )}

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-medium">Items a Transferir</h3>
                                {sucursalOrigenId && stockOrigen.length > 0 && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {busquedaProducto
                                            ? `${stockOrigenFiltrado.length} productos encontrados`
                                            : `${stockOrigen.length} productos disponibles`
                                        }
                                        {sucursalOrigenId === '00000000-0000-0000-0000-000000000001' && ' en almacén central'}
                                    </p>
                                )}
                                {!almacenCentral && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        🔄 Cargando almacén central...
                                    </p>
                                )}
                                {almacenCentral && !sucursalOrigenId && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        📦 Configurando almacén central como origen...
                                    </p>
                                )}
                                {sucursalOrigenId && stockOrigen.length === 0 && !loadingStock && (
                                    <p className="text-sm text-orange-600 mt-1">
                                        ⚠️ {sucursalOrigenId === '00000000-0000-0000-0000-000000000001'
                                            ? 'No hay productos disponibles en el almacén central'
                                            : 'No hay productos disponibles en la sucursal seleccionada'
                                        }
                                        <br />
                                        <span className="text-xs">
                                            {sucursalOrigenId === '00000000-0000-0000-0000-000000000001'
                                                ? 'Los productos deben estar en el catálogo central con lotes en almacén'
                                                : 'Los productos deben tener lotes con stock disponible'
                                            }
                                        </span>
                                    </p>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => append({ producto_id: '', cantidad: 0 })}
                                disabled={!sucursalOrigenId || stockOrigenFiltrado.length === 0}
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
                                                    {loadingStock ? (
                                                        <SelectItem value="loading" disabled>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                                Cargando productos...
                                                            </div>
                                                        </SelectItem>
                                                    ) : stockOrigen.length === 0 ? (
                                                        <SelectItem value="empty" disabled>
                                                            {sucursalOrigenId === '00000000-0000-0000-0000-000000000001'
                                                                ? 'No hay productos disponibles en el almacén central'
                                                                : 'No hay productos disponibles en esta sucursal'
                                                            }
                                                        </SelectItem>
                                                    ) : (
                                                        stockOrigenFiltrado
                                                            .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre))
                                                            .map((item) => (
                                                                <SelectItem key={item.producto.id} value={item.producto.id}>
                                                                    <div className="flex items-center justify-between w-full">
                                                                        <span className="font-medium">{item.producto.nombre}</span>
                                                                        <span className="text-xs text-muted-foreground ml-2">
                                                                            {item.cantidad_total} {item.producto.unidad_medida}
                                                                        </span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))
                                                    )}
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
