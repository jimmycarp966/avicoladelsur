'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownCircle, ArrowUpCircle, Calendar, Filter, Package } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface RecepcionAlmacenListaProps {
  recepciones: any[]
  tipo?: string
  fechaDesde?: string
  fechaHasta?: string
}

export function RecepcionAlmacenLista({
  recepciones,
  tipo,
  fechaDesde,
  fechaHasta,
}: RecepcionAlmacenListaProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Historial de Recepciones
            </CardTitle>
            <CardDescription>
              Registro de ingresos y egresos de almacén
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="filtro-tipo">Tipo</Label>
            <Select value={tipo || ''} onValueChange={(value) => handleFilterChange('tipo', value)}>
              <SelectTrigger id="filtro-tipo">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="ingreso">Ingreso</SelectItem>
                <SelectItem value="egreso">Egreso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha-desde">Fecha Desde</Label>
            <Input
              id="fecha-desde"
              type="date"
              value={fechaDesde || ''}
              onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha-hasta">Fecha Hasta</Label>
            <Input
              id="fecha-hasta"
              type="date"
              value={fechaHasta || ''}
              onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/almacen/recepcion')}
            >
              Limpiar
            </Button>
          </div>
        </div>

        {/* Tabla */}
        {recepciones.length === 0 ? (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay recepciones registradas</h3>
            <p className="text-muted-foreground">
              Las recepciones aparecerán aquí una vez que se registren
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recepciones.map((recepcion: any) => (
                  <TableRow key={recepcion.id}>
                    <TableCell>
                      {new Date(recepcion.created_at).toLocaleString('es-AR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={recepcion.tipo === 'ingreso' ? 'default' : 'destructive'}
                        className="flex items-center gap-1 w-fit"
                      >
                        {recepcion.tipo === 'ingreso' ? (
                          <ArrowDownCircle className="h-3 w-3" />
                        ) : (
                          <ArrowUpCircle className="h-3 w-3" />
                        )}
                        {recepcion.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {recepcion.producto?.nombre || 'N/A'}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {recepcion.producto?.codigo || ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      {recepcion.lote?.numero_lote || '-'}
                    </TableCell>
                    <TableCell>
                      {recepcion.cantidad} {recepcion.unidad_medida}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{recepcion.motivo}</span>
                      {recepcion.destino_produccion && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Producción
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {recepcion.usuario?.nombre || 'N/A'} {recepcion.usuario?.apellido || ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

