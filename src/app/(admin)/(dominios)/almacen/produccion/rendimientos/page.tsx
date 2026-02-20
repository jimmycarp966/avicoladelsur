'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
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
    ArrowLeft,
    Plus,
    Trash2,
    Settings,
    AlertTriangle,
    Save,
    Loader2,
    Percent,
    Target
} from 'lucide-react'

import Link from 'next/link'
import { toast } from 'sonner'
import {
    obtenerRendimientosEsperadosAction,
    guardarRendimientoEsperadoAction,
    eliminarRendimientoEsperadoAction,
    obtenerProveedoresRendimientoAction,
    type RendimientoEsperado
} from '@/actions/rendimientos.actions'
import { obtenerDestinosProduccionListaAction } from '@/actions/destinos-produccion.actions'
import { obtenerProductosAction } from '@/actions/almacen.actions'
import type { DestinoProduccion, Producto } from '@/types/domain.types'

export const dynamic = 'force-dynamic'

export default function RendimientosPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [rendimientos, setRendimientos] = useState<RendimientoEsperado[]>([])
    const [destinos, setDestinos] = useState<DestinoProduccion[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [proveedores, setProveedores] = useState<string[]>([])

    // Filtros
    const [filtroDestino, setFiltroDestino] = useState<string>('')
    const [filtroProveedor, setFiltroProveedor] = useState<string>('')

    // Formulario nuevo rendimiento
    const [dialogOpen, setDialogOpen] = useState(false)
    const [nuevoDestino, setNuevoDestino] = useState('')
    const [nuevoProducto, setNuevoProducto] = useState('')
    const [nuevoProveedor, setNuevoProveedor] = useState('GENERICO')
    const [nuevoPorcentaje, setNuevoPorcentaje] = useState('')
    const [nuevaTolerancia, setNuevaTolerancia] = useState('5')

    // Cargar datos
    useEffect(() => {
        async function cargarDatos() {
            setLoading(true)
            try {
                const [rendRes, destRes, prodRes, provRes] = await Promise.all([
                    obtenerRendimientosEsperadosAction(),
                    obtenerDestinosProduccionListaAction(),
                    obtenerProductosAction(),
                    obtenerProveedoresRendimientoAction()
                ])

                if (rendRes.data) setRendimientos(rendRes.data)
                if (destRes.data) setDestinos(destRes.data)
                if (prodRes.data) setProductos(prodRes.data)
                if (provRes.data) setProveedores(provRes.data)
            } catch (error) {
                console.error('Error cargando datos:', error)
                toast.error('Error al cargar datos')
            } finally {
                setLoading(false)
            }
        }
        cargarDatos()
    }, [])

    // Filtrar rendimientos
    const rendimientosFiltrados = rendimientos.filter(r => {
        if (filtroDestino && filtroDestino !== 'todos' && r.destino_id !== filtroDestino) return false
        if (filtroProveedor && filtroProveedor !== 'todos' && r.proveedor !== filtroProveedor) return false
        return true
    })

    // Agrupar por destino para mejor visualización
    const rendimientosPorDestino = rendimientosFiltrados.reduce((acc, r) => {
        const key = r.destino?.nombre || 'Sin Destino'
        if (!acc[key]) acc[key] = []
        acc[key].push(r)
        return acc
    }, {} as Record<string, RendimientoEsperado[]>)

    // Guardar nuevo rendimiento
    const handleGuardar = async () => {
        if (!nuevoDestino || !nuevoProducto || !nuevoPorcentaje) {
            toast.error('Completa todos los campos obligatorios')
            return
        }

        setSaving(true)
        try {
            const result = await guardarRendimientoEsperadoAction(
                nuevoDestino,
                nuevoProducto,
                nuevoProveedor || 'GENERICO',
                parseFloat(nuevoPorcentaje),
                parseFloat(nuevaTolerancia) || 5.0
            )

            if (result.success) {
                toast.success('Rendimiento guardado correctamente')
                setDialogOpen(false)

                // Recargar lista
                const { data } = await obtenerRendimientosEsperadosAction()
                if (data) setRendimientos(data)

                // Limpiar formulario
                setNuevoDestino('')
                setNuevoProducto('')
                setNuevoProveedor('GENERICO')
                setNuevoPorcentaje('')
                setNuevaTolerancia('5')
            } else {
                toast.error(result.message || 'Error al guardar')
            }
        } catch (error) {
            toast.error('Error al guardar rendimiento')
        } finally {
            setSaving(false)
        }
    }

    // Eliminar rendimiento
    const handleEliminar = async (id: string) => {
        if (!confirm('¿Eliminar esta configuración de rendimiento?')) return

        try {
            const result = await eliminarRendimientoEsperadoAction(id)
            if (result.success) {
                toast.success('Rendimiento eliminado')
                setRendimientos(prev => prev.filter(r => r.id !== id))
            } else {
                toast.error(result.message || 'Error al eliminar')
            }
        } catch (error) {
            toast.error('Error al eliminar')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Settings className="h-7 w-7" />
                        Configuración de Rendimientos
                    </h1>
                    <p className="text-muted-foreground text-sm md:text-base">
                        Define los porcentajes esperados por producto, destino y proveedor (marca)
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/almacen/produccion">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Button>
                    </Link>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Nuevo Rendimiento
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Configurar Rendimiento Esperado</DialogTitle>
                                <DialogDescription>
                                    Define qué porcentaje del peso de entrada esperas obtener de cada producto.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>Destino de Producción *</Label>
                                    <Select value={nuevoDestino} onValueChange={setNuevoDestino}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar destino..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {destinos.map(d => (
                                                <SelectItem key={d.id} value={d.id}>
                                                    {d.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Producto Generado *</Label>
                                    <Select value={nuevoProducto} onValueChange={setNuevoProducto}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar producto..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {productos.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.codigo} - {p.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Proveedor / Marca</Label>
                                    <Input
                                        placeholder="GENERICO"
                                        value={nuevoProveedor}
                                        onChange={(e) => setNuevoProveedor(e.target.value.toUpperCase())}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Usa "GENERICO" si aplica a cualquier proveedor
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Porcentaje Esperado *</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                step="0.1"
                                                placeholder="42.5"
                                                value={nuevoPorcentaje}
                                                onChange={(e) => setNuevoPorcentaje(e.target.value)}
                                            />
                                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Tolerancia (+/-)</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                step="0.5"
                                                placeholder="5"
                                                value={nuevaTolerancia}
                                                onChange={(e) => setNuevaTolerancia(e.target.value)}
                                            />
                                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleGuardar} disabled={saving}>
                                    <Save className="mr-2 h-4 w-4" />
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Filtros</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <div className="w-48">
                            <Label className="text-xs">Destino</Label>
                            <Select value={filtroDestino} onValueChange={setFiltroDestino}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    {destinos.map(d => (
                                        <SelectItem key={d.id} value={d.id}>
                                            {d.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-48">
                            <Label className="text-xs">Proveedor</Label>
                            <Select value={filtroProveedor} onValueChange={setFiltroProveedor}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    {proveedores.map(p => (
                                        <SelectItem key={p} value={p}>
                                            {p}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla de rendimientos */}
            {loading ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Cargando...</p>
                    </CardContent>
                </Card>
            ) : rendimientosFiltrados.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No hay rendimientos configurados</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Configura los porcentajes esperados para cada producto
                        </p>
                        <Button onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Configurar Rendimiento
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                Object.entries(rendimientosPorDestino).map(([destinoNombre, items]) => (
                    <Card key={destinoNombre}>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-5 w-5 text-primary" />
                                {destinoNombre}
                            </CardTitle>
                            <CardDescription>
                                {items.length} producto(s) configurado(s)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead>Proveedor</TableHead>
                                        <TableHead className="text-center">% Esperado</TableHead>
                                        <TableHead className="text-center">Tolerancia</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell>
                                                <div>
                                                    <span className="font-medium">{r.producto?.nombre}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        ({r.producto?.codigo})
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={r.proveedor === 'GENERICO' ? 'secondary' : 'outline'}>
                                                    {r.proveedor}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-semibold">
                                                {r.porcentaje_esperado}%
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground">
                                                ±{r.tolerancia}%
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleEliminar(r.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                ))
            )}

            {/* Nota informativa */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="py-4">
                    <div className="flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-medium text-blue-800">¿Cómo funciona?</p>
                            <ul className="text-blue-700 mt-1 space-y-1">
                                <li>• Al crear una orden de producción, el sistema mostrará los pesos sugeridos basados en estos porcentajes.</li>
                                <li>• Si el peso real difiere más que la tolerancia, se mostrará una alerta (sin bloquear).</li>
                                <li>• Usa proveedores específicos para marcas con rendimientos diferentes (ej: "GRANJA_SAN_JOSE").</li>
                                <li>• El proveedor "GENERICO" aplica cuando no hay configuración específica.</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
