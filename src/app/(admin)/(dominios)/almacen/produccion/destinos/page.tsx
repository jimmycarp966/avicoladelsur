'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Target,
    Plus,
    Trash2,
    Edit2,
    Package,
    ArrowLeft,
    Check
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
    obtenerDestinosProduccionAction,
    crearDestinoProduccionAction,
    actualizarDestinoProduccionAction,
    eliminarDestinoProduccionAction,
    asociarProductoDestinoAction,
    desasociarProductoDestinoAction
} from '@/actions/destinos-produccion.actions'
import { obtenerProductosAction } from '@/actions/almacen.actions'
import type { DestinoProduccion, Producto } from '@/types/domain.types'

export default function DestinosProduccionPage() {
    const [destinos, setDestinos] = useState<DestinoProduccion[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingDestino, setEditingDestino] = useState<DestinoProduccion | null>(null)

    // Campos del formulario
    const [nombre, setNombre] = useState('')
    const [descripcion, setDescripcion] = useState('')

    // Para asociar productos
    const [selectedDestino, setSelectedDestino] = useState<string | null>(null)
    const [productoAAsociar, setProductoAAsociar] = useState('')

    useEffect(() => {
        cargarDatos()
    }, [])

    async function cargarDatos() {
        setLoading(true)
        const [destinosRes, productosRes] = await Promise.all([
            obtenerDestinosProduccionAction(),
            obtenerProductosAction()
        ])

        if (destinosRes.success && destinosRes.data) {
            setDestinos(destinosRes.data)
        }
        if (productosRes.data) {
            setProductos(productosRes.data)
        }
        setLoading(false)
    }

    const handleGuardarDestino = async () => {
        if (!nombre.trim()) {
            toast.error('El nombre es obligatorio')
            return
        }

        setLoading(true)
        try {
            if (editingDestino) {
                const result = await actualizarDestinoProduccionAction(editingDestino.id, {
                    nombre,
                    descripcion
                })
                if (result.success) {
                    toast.success('Destino actualizado')
                } else {
                    toast.error(result.message || 'Error al actualizar')
                }
            } else {
                const result = await crearDestinoProduccionAction(nombre, descripcion)
                if (result.success) {
                    toast.success('Destino creado')
                } else {
                    toast.error(result.message || 'Error al crear')
                }
            }

            setDialogOpen(false)
            setEditingDestino(null)
            setNombre('')
            setDescripcion('')
            await cargarDatos()
        } catch (error) {
            toast.error('Error al guardar')
        } finally {
            setLoading(false)
        }
    }

    const handleEliminarDestino = async (destinoId: string) => {
        if (!confirm('¿Estás seguro de eliminar este destino?')) return

        setLoading(true)
        try {
            const result = await eliminarDestinoProduccionAction(destinoId)
            if (result.success) {
                toast.success('Destino eliminado')
                await cargarDatos()
            } else {
                toast.error(result.message || 'Error al eliminar')
            }
        } catch (error) {
            toast.error('Error al eliminar')
        } finally {
            setLoading(false)
        }
    }

    const handleAsociarProducto = async () => {
        if (!selectedDestino || !productoAAsociar) {
            toast.error('Selecciona un producto')
            return
        }

        setLoading(true)
        try {
            const result = await asociarProductoDestinoAction(selectedDestino, productoAAsociar)
            if (result.success) {
                toast.success('Producto asociado')
                setProductoAAsociar('')
                await cargarDatos()
            } else {
                toast.error(result.message || 'Error al asociar')
            }
        } catch (error) {
            toast.error('Error al asociar')
        } finally {
            setLoading(false)
        }
    }

    const handleDesasociarProducto = async (destinoId: string, productoId: string) => {
        setLoading(true)
        try {
            const result = await desasociarProductoDestinoAction(destinoId, productoId)
            if (result.success) {
                toast.success('Producto desasociado')
                await cargarDatos()
            } else {
                toast.error(result.message || 'Error al desasociar')
            }
        } catch (error) {
            toast.error('Error al desasociar')
        } finally {
            setLoading(false)
        }
    }

    const openEditDialog = (destino: DestinoProduccion) => {
        setEditingDestino(destino)
        setNombre(destino.nombre)
        setDescripcion(destino.descripcion || '')
        setDialogOpen(true)
    }

    const openNewDialog = () => {
        setEditingDestino(null)
        setNombre('')
        setDescripcion('')
        setDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Link href="/almacen/produccion">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                            Destinos de Producción
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-sm md:text-base ml-10">
                        Configura las categorías de productos resultantes (Filet, Pechuga, Pollo Trozado)
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNewDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Destino
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingDestino ? 'Editar Destino' : 'Nuevo Destino de Producción'}
                            </DialogTitle>
                            <DialogDescription>
                                Define una categoría para agrupar productos resultantes
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="nombre">Nombre *</Label>
                                <Input
                                    id="nombre"
                                    placeholder="Ej: Filet, Pechuga, Pollo Trozado"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="descripcion">Descripción</Label>
                                <Textarea
                                    id="descripcion"
                                    placeholder="Productos que genera: patamuslo, filet, puchero..."
                                    value={descripcion}
                                    onChange={(e) => setDescripcion(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleGuardarDestino} disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Lista de destinos */}
            {loading && destinos.length === 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
                    ))}
                </div>
            ) : destinos.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No hay destinos configurados</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Crea destinos como "Filet", "Pechuga" o "Pollo Trozado"
                        </p>
                        <Button onClick={openNewDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Crear Primer Destino
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {destinos.map((destino) => (
                        <Card key={destino.id} className="relative">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <Target className="h-5 w-5 text-primary" />
                                        <CardTitle>{destino.nombre}</CardTitle>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(destino)}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEliminarDestino(destino.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                                {destino.descripcion && (
                                    <CardDescription>{destino.descripcion}</CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Productos asociados */}
                                <div>
                                    <Label className="text-sm text-muted-foreground mb-2 block">
                                        Productos asociados:
                                    </Label>
                                    {destino.productos && destino.productos.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {destino.productos.map((dp: any) => (
                                                <Badge
                                                    key={dp.producto_id}
                                                    variant={dp.es_desperdicio ? 'destructive' : 'secondary'}
                                                    className="flex items-center gap-1"
                                                >
                                                    {dp.producto_nombre || dp.producto?.nombre}
                                                    <button
                                                        onClick={() => handleDesasociarProducto(destino.id, dp.producto_id)}
                                                        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">
                                            Sin productos asociados
                                        </p>
                                    )}
                                </div>

                                {/* Agregar producto */}
                                {selectedDestino === destino.id ? (
                                    <div className="flex gap-2">
                                        <Select
                                            value={productoAAsociar}
                                            onValueChange={setProductoAAsociar}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Seleccionar producto..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {productos.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.codigo} - {p.nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button size="icon" onClick={handleAsociarProducto}>
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedDestino(null)
                                                setProductoAAsociar('')
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => setSelectedDestino(destino.id)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Asociar Producto
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
