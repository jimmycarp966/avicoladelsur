'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Edit, Eye, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerListasPreciosAction } from '@/actions/listas-precios.actions'

interface ListaPrecio {
  id: string
  codigo: string
  nombre: string
  tipo: 'minorista' | 'mayorista' | 'distribuidor' | 'personalizada'
  activa: boolean
  margen_ganancia?: number
  vigencia_activa?: boolean
  fecha_vigencia_desde?: string
  fecha_vigencia_hasta?: string
}

interface ListasPreciosTableProps {
  listas: ListaPrecio[]
}

export function ListasPreciosTable({ listas }: ListasPreciosTableProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const getTipoBadge = (tipo: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      minorista: 'default',
      mayorista: 'secondary',
      distribuidor: 'outline',
      personalizada: 'default',
    }
    return variants[tipo] || 'default'
  }

  if (listas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay listas de precios creadas
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Margen</TableHead>
            <TableHead>Vigencia</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listas.map((lista) => (
            <TableRow key={lista.id}>
              <TableCell className="font-medium">{lista.codigo}</TableCell>
              <TableCell>{lista.nombre}</TableCell>
              <TableCell>
                <Badge variant={getTipoBadge(lista.tipo)}>
                  {lista.tipo}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={lista.activa ? 'default' : 'secondary'}>
                  {lista.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </TableCell>
              <TableCell>
                {lista.margen_ganancia !== null && lista.margen_ganancia !== undefined ? (
                  <span className="text-sm font-medium">
                    {lista.margen_ganancia.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {lista.vigencia_activa ? (
                  lista.fecha_vigencia_desde || lista.fecha_vigencia_hasta ? (
                    <span className="text-sm">
                      {lista.fecha_vigencia_desde && new Date(lista.fecha_vigencia_desde).toLocaleDateString()}
                      {lista.fecha_vigencia_desde && lista.fecha_vigencia_hasta && ' - '}
                      {lista.fecha_vigencia_hasta && new Date(lista.fecha_vigencia_hasta).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Vigencia activada sin fechas</span>
                  )
                ) : (
                  <span className="text-sm text-muted-foreground">Siempre vigente</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/ventas/listas-precios/${lista.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/ventas/listas-precios/${lista.id}/editar`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

