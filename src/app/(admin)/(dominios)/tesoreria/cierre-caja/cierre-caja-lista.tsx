'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, Wallet, Filter, CheckCircle2, Clock } from 'lucide-react'
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
import Link from 'next/link'

interface CierreCajaListaProps {
  cierres: any[]
  cajas: Array<{ id: string; nombre: string }>
  cajaId?: string
  fecha?: string
  estado?: string
}

export function CierreCajaLista({
  cierres,
  cajas,
  cajaId,
  fecha,
  estado,
}: CierreCajaListaProps) {
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
              Historial de Cierres
            </CardTitle>
            <CardDescription>
              Lista de cierres de caja registrados
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="filtro-caja">Caja</Label>
            <Select value={cajaId || 'all'} onValueChange={(value) => handleFilterChange('caja_id', value)}>
              <SelectTrigger id="filtro-caja">
                <SelectValue placeholder="Todas las cajas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cajas</SelectItem>
                {cajas.map(caja => (
                  <SelectItem key={caja.id} value={caja.id}>
                    {caja.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-fecha">Fecha</Label>
            <Input
              id="filtro-fecha"
              type="date"
              value={fecha || ''}
              onChange={(e) => handleFilterChange('fecha', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-estado">Estado</Label>
            <Select value={estado || 'all'} onValueChange={(value) => handleFilterChange('estado', value)}>
              <SelectTrigger id="filtro-estado">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="abierto">Abierto</SelectItem>
                <SelectItem value="cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/tesoreria/cierre-caja')}
            >
              Limpiar
            </Button>
          </div>
        </div>

        {/* Tabla */}
        {cierres.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay cierres registrados</h3>
            <p className="text-muted-foreground">
              Los cierres aparecerán aquí una vez que se creen
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead>Saldo Inicial</TableHead>
                  <TableHead>Saldo Final</TableHead>
                  <TableHead>Ingresos</TableHead>
                  <TableHead>Egresos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cierres.map((cierre: any) => (
                  <TableRow key={cierre.id}>
                    <TableCell>
                      {new Date(cierre.fecha).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell>
                      {cierre.caja?.nombre || 'N/A'}
                    </TableCell>
                    <TableCell>
                      ${cierre.saldo_inicial.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {cierre.saldo_final ? `$${cierre.saldo_final.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      ${cierre.total_ingresos.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      ${cierre.total_egresos.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cierre.estado === 'cerrado' ? 'default' : 'secondary'}
                        className="flex items-center gap-1 w-fit"
                      >
                        {cierre.estado === 'cerrado' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {cierre.estado === 'cerrado' ? 'Cerrado' : 'Abierto'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cierre.estado === 'abierto' && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/tesoreria/cierre-caja/${cierre.id}/cerrar`}>
                            Cerrar
                          </Link>
                        </Button>
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

