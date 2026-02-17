'use client'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface MovimientoProveedor {
  id: string
  created_at: string
  tipo: 'ingreso' | 'egreso'
  cantidad: number
  unidad_medida: string
  motivo: string
  numero_comprobante_ref?: string | null
  tipo_comprobante_ref?: string | null
  fecha_comprobante?: string | null
  monto_compra?: number | null
  producto?: {
    id: string
    codigo: string
    nombre: string
  } | null
  factura?: {
    id: string
    numero_factura: string
    estado: string
    monto_total: number
    monto_pagado: number
  } | null
}

interface MovimientosTableProps {
  movimientos: MovimientoProveedor[]
}

export function MovimientosTable({ movimientos }: MovimientosTableProps) {
  if (movimientos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay movimientos de almacén vinculados para este proveedor
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Estado Factura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movimientos.map((mov) => (
            <TableRow key={mov.id}>
              <TableCell>
                {format(new Date(mov.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
              </TableCell>
              <TableCell>
                <Badge variant={mov.tipo === 'ingreso' ? 'default' : 'secondary'}>
                  {mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="font-medium">{mov.producto?.nombre || 'Sin producto'}</div>
                <div className="text-xs text-muted-foreground">{mov.producto?.codigo || '-'}</div>
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  {mov.factura?.numero_factura || mov.numero_comprobante_ref || '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {mov.tipo_comprobante_ref || 'comprobante'}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {mov.cantidad} {mov.unidad_medida}
              </TableCell>
              <TableCell className="text-right">
                {mov.monto_compra ? formatCurrency(Number(mov.monto_compra)) : '-'}
              </TableCell>
              <TableCell>
                {mov.factura?.estado ? (
                  <Badge variant="outline">{mov.factura.estado}</Badge>
                ) : (
                  <span className="text-muted-foreground">Sin factura</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

