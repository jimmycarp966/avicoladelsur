'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, AlertTriangle, Package, Truck, Building2, ExternalLink, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'
import { DashboardRealtime } from './DashboardRealtime'

interface DashboardClientProps {
  sucursal: {
    id: string
    nombre: string
    direccion?: string | null
    telefono?: string | null
    active: boolean
  }
  ventasDiaInicial: any[]
  alertasInicial: any[]
  cajaInicial: any
  transferenciasInicial: any[]
  esAdmin: boolean
  todasLasSucursales: Array<{ id: string; nombre: string }>
  sinSucursal: boolean
}

export function DashboardClient({
  sucursal,
  ventasDiaInicial,
  alertasInicial,
  cajaInicial,
  transferenciasInicial,
  esAdmin,
  todasLasSucursales,
  sinSucursal,
}: DashboardClientProps) {
  const [ventasDia, setVentasDia] = useState(ventasDiaInicial)
  const [alertas, setAlertas] = useState(alertasInicial)
  const [caja, setCaja] = useState(cajaInicial)
  const [transferencias, setTransferencias] = useState(transferenciasInicial)

  const totalVentasDia = ventasDia.reduce((sum, venta) => sum + (venta.total || 0), 0)
  const transferenciasPendientes = transferencias.filter(t => t.estado === 'pendiente').length

  return (
    <>
      {/* Componente Realtime que actualiza el estado */}
      {sucursal.id && (
        <DashboardRealtime
          sucursalId={sucursal.id}
          onVentasUpdate={setVentasDia}
          onAlertasUpdate={setAlertas}
          onCajaUpdate={setCaja}
          onTransferenciasUpdate={setTransferencias}
        />
      )}

      <div className="space-y-6">
        {/* Banner de Identificación de Sucursal */}
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sucursal Actual</p>
                  <p className="text-xl font-bold">{sucursal.nombre}</p>
                </div>
              </div>
              {esAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/sucursales">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver Todas las Sucursales
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mensaje para admin sin sucursal asignada */}
        {sinSucursal && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-2">
                    No hay sucursales activas en el sistema
                  </h3>
                  <p className="text-amber-800 mb-4">
                    Como administrador, puedes crear nuevas sucursales desde la sección de gestión.
                  </p>
                  <Button asChild>
                    <Link href="/sucursales/nueva">
                      <Building2 className="w-4 h-4 mr-2" />
                      Crear Primera Sucursal
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Building2 className="w-8 h-8" />
                {sucursal.nombre}
              </h1>
              <Badge variant={sucursal.active ? "default" : "secondary"} className="text-sm">
                {sucursal.active ? 'Activa' : 'Inactiva'}
              </Badge>
              {esAdmin && (
                <Badge variant="outline" className="text-xs">
                  Vista Admin
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {sucursal.direccion && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{sucursal.direccion}</span>
                </div>
              )}
              {sucursal.telefono && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{sucursal.telefono}</span>
                </div>
              )}
            </div>
            {esAdmin && todasLasSucursales.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {todasLasSucursales.length > 1 ? 'Cambiar sucursal:' : 'Sucursales disponibles:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {todasLasSucursales.map((s) => (
                    <Button
                      key={s.id}
                      variant={s.id === sucursal.id ? "default" : "outline"}
                      size="sm"
                      asChild
                    >
                      <Link href={`/sucursal/dashboard?sid=${s.id}`}>
                        {s.nombre}
                      </Link>
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/sucursales">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Ver Todas
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {esAdmin && (
              <Button variant="outline" asChild>
                <Link href="/sucursales">
                  <Building2 className="w-4 h-4 mr-2" />
                  Gestión Sucursales
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/sucursal/alerts">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Ver Alertas ({alertas.length})
              </Link>
            </Button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Ventas del Día */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventas del Día</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalVentasDia.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {ventasDia.length} pedidos completados
              </p>
            </CardContent>
          </Card>

          {/* Alertas Activas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas de Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{alertas.length}</div>
              <p className="text-xs text-muted-foreground">
                Productos con stock bajo
              </p>
            </CardContent>
          </Card>

          {/* Estado de Caja */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo en Caja</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${caja?.saldo_actual?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Saldo actual
              </p>
            </CardContent>
          </Card>

          {/* Transferencias */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transferencias</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {transferencias.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {transferenciasPendientes} pendientes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Acciones Rápidas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Registrar Venta
              </CardTitle>
              <CardDescription>
                Registra una nueva venta en la sucursal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/sucursal/ventas">
                  Ir a Ventas
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Ver Inventario
              </CardTitle>
              <CardDescription>
                Consulta el stock disponible en la sucursal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild className="w-full">
                <Link href="/sucursal/inventario">
                  Ver Inventario
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Gestionar Transferencias
              </CardTitle>
              <CardDescription>
                Solicita o recibe transferencias de stock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild className="w-full">
                <Link href="/sucursal/transferencias">
                  Ver Transferencias
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Alertas Recientes */}
        {alertas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Alertas de Stock Activas
              </CardTitle>
              <CardDescription>
                Productos que requieren atención inmediata
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertas.slice(0, 3).map((alerta) => (
                  <div key={alerta.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <div>
                        <p className="font-medium">Producto #{alerta.producto_id}</p>
                        <p className="text-sm text-muted-foreground">
                          Stock: {alerta.cantidad_actual} | Umbral: {alerta.umbral}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive">Crítico</Badge>
                  </div>
                ))}
                {alertas.length > 3 && (
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/sucursal/alerts">
                      Ver todas las alertas ({alertas.length})
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

