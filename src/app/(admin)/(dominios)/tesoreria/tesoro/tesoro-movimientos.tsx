'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, Filter, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
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

interface TesoroMovimientosProps {
  movimientos: any[]
  tipo?: string
  fechaDesde?: string
  fechaHasta?: string
}

export function TesoroMovimientos({
  movimientos,
  tipo,
  fechaDesde,
  fechaHasta,
}: TesoroMovimientosProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
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
              <Calendar className="h-5 w-5" />
              Movimientos de Tesoro
            </CardTitle>
            <CardDescription>
              Historial de retiros y depósitos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="filtro-tipo">Tipo</Label>
            <Select value={tipo || 'all'} onValueChange={(value) => handleFilterChange('tipo', value)}>
              <SelectTrigger id="filtro-tipo">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="qr">QR</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
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
              onClick={() => router.push('/tesoreria/tesoro')}
            >
              Limpiar
            </Button>
          </div>
        </div>

        {/* Tabla */}
        {movimientos.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay movimientos registrados</h3>
            <p className="text-muted-foreground">
              Los movimientos aparecerán aquí una vez que se registren
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Origen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map((mov: any) => (
                  <TableRow key={mov.id}>
                    <TableCell>
                      {new Date(mov.created_at).toLocaleString('es-AR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {mov.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={mov.monto >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {mov.monto >= 0 ? '+' : ''}${Math.abs(mov.monto).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {mov.descripcion || '-'}
                    </TableCell>
                    <TableCell>
                      {mov.origen_tipo ? (
                        <span className="text-sm text-muted-foreground capitalize">
                          {mov.origen_tipo}
                        </span>
                      ) : (
                        '-'
                      )}
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

