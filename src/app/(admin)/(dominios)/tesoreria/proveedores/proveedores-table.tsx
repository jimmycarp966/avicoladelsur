'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Phone, Mail, Search, Building2, CheckCircle, XCircle } from 'lucide-react'
import { desactivarProveedorAction, reactivarProveedorAction } from '@/actions/proveedores.actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Proveedor {
    id: string
    nombre: string
    cuit: string | null
    telefono: string | null
    email: string | null
    direccion: string | null
    categoria: string | null
    activo: boolean
    created_at: string
}

interface ProveedoresTableProps {
    proveedores: Proveedor[]
}

export function ProveedoresTable({ proveedores }: ProveedoresTableProps) {
    const [filtro, setFiltro] = useState('')
    const [isLoading, setIsLoading] = useState<string | null>(null)
    const router = useRouter()

    const proveedoresFiltrados = proveedores.filter((p) =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        p.cuit?.toLowerCase().includes(filtro.toLowerCase()) ||
        p.categoria?.toLowerCase().includes(filtro.toLowerCase())
    )

    const handleToggleActivo = async (id: string, activo: boolean) => {
        setIsLoading(id)
        try {
            const result = activo
                ? await desactivarProveedorAction(id)
                : await reactivarProveedorAction(id)

            if (result.success) {
                toast.success(result.message)
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error('Error al actualizar proveedor')
        } finally {
            setIsLoading(null)
        }
    }

    return (
        <div className="space-y-4">
            {/* Filtro */}
            <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nombre, CUIT o categoría..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            {/* Tabla */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>CUIT</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {proveedoresFiltrados.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    No se encontraron proveedores
                                </TableCell>
                            </TableRow>
                        ) : (
                            proveedoresFiltrados.map((proveedor) => (
                                <TableRow key={proveedor.id} className={!proveedor.activo ? 'opacity-60' : ''}>
                                    <TableCell>
                                        <div>
                                            <div className="font-medium">{proveedor.nombre}</div>
                                            {proveedor.direccion && (
                                                <div className="text-sm text-muted-foreground">{proveedor.direccion}</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {proveedor.cuit || <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {proveedor.telefono && (
                                                <a
                                                    href={`tel:${proveedor.telefono}`}
                                                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                                >
                                                    <Phone className="h-3 w-3" />
                                                    {proveedor.telefono}
                                                </a>
                                            )}
                                            {proveedor.email && (
                                                <a
                                                    href={`mailto:${proveedor.email}`}
                                                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                                >
                                                    <Mail className="h-3 w-3" />
                                                    {proveedor.email}
                                                </a>
                                            )}
                                            {!proveedor.telefono && !proveedor.email && (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {proveedor.categoria ? (
                                            <Badge variant="outline">{proveedor.categoria}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={proveedor.activo ? 'default' : 'secondary'}>
                                            {proveedor.activo ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={isLoading === proveedor.id}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => handleToggleActivo(proveedor.id, proveedor.activo)}
                                                >
                                                    {proveedor.activo ? (
                                                        <>
                                                            <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                                            Desactivar
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                                            Reactivar
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Contador */}
            <div className="text-sm text-muted-foreground">
                Mostrando {proveedoresFiltrados.length} de {proveedores.length} proveedores
            </div>
        </div>
    )
}
