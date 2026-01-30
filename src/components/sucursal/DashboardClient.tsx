'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, AlertTriangle, Package, Truck, Building2, ShoppingCart } from 'lucide-react'
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
  const transferenciasPendientes = transferencias.filter(
    t => ['pendiente', 'en_transito', 'en_ruta', 'entregado'].includes(t.estado)
  ).length

  return (
    <>
      {/* Componente Realtime */}
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
        {/* Banner de Sucursal (compacto) */}
        <div className="flex items-center justify-between bg-primary/5 rounded-lg p-4 border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg">{sucursal.nombre}</p>
              <p className="text-sm text-muted-foreground">Panel de sucursal</p>
            </div>
          </div>
          {esAdmin && (
            <Badge variant="outline">Admin</Badge>
          )}
        </div>

        {/* Sin sucursal */}
        {sinSucursal && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h3 className="font-semibold text-amber-900 mb-2">No hay sucursales activas</h3>
              <p className="text-amber-800 mb-4">Crear una sucursal para comenzar.</p>
              <Button asChild>
                <Link href="/sucursales/nueva">
                  <Building2 className="w-4 h-4 mr-2" />
                  Crear Sucursal
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* BOTONES DE ACCIÓN GRANDES */}
        {/* ============================================ */}

        {/* BOTÓN PRINCIPAL: VENDER */}
        <Button
          asChild
          className="w-full h-20 text-xl font-bold bg-green-600 hover:bg-green-700 shadow-lg"
        >
          <Link href="/sucursal/ventas" className="flex items-center justify-center gap-3">
            <ShoppingCart className="w-8 h-8" />
            VENDER
          </Link>
        </Button>

        {/* BOTONES SECUNDARIOS */}
        <div className="grid grid-cols-2 gap-4">
          {/* RECIBIR MERCADERÍA */}
          <Button
            asChild
            variant="outline"
            className="h-16 text-base font-medium relative"
          >
            <Link href="/sucursal/transferencias" className="flex flex-col items-center justify-center gap-1">
              <Truck className="w-6 h-6" />
              <span>Recibir Mercadería</span>
              {transferenciasPendientes > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center animate-pulse"
                >
                  {transferenciasPendientes}
                </Badge>
              )}
            </Link>
          </Button>

          {/* VER STOCK */}
          <Button
            asChild
            variant="outline"
            className="h-16 text-base font-medium"
          >
            <Link href="/sucursal/inventario" className="flex flex-col items-center justify-center gap-1">
              <Package className="w-6 h-6" />
              <span>Ver Stock</span>
            </Link>
          </Button>
        </div>

        {/* ============================================ */}
        {/* RESUMEN DEL DÍA (compacto) */}
        {/* ============================================ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumen del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Ventas */}
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <DollarSign className="w-5 h-5 mx-auto text-green-600 mb-1" />
                <p className="text-xl font-bold text-green-700">${totalVentasDia.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{ventasDia.length} ventas</p>
              </div>

              {/* Caja */}
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <DollarSign className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                <p className="text-xl font-bold text-blue-700">${caja?.saldo_actual?.toFixed(0) || '0'}</p>
                <p className="text-xs text-muted-foreground">En caja</p>
              </div>

              {/* Transferencias */}
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <Truck className="w-5 h-5 mx-auto text-orange-600 mb-1" />
                <p className="text-xl font-bold text-orange-700">{transferenciasPendientes}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>

              {/* Alertas */}
              <div className={`text-center p-3 rounded-lg ${alertas.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${alertas.length > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                <p className={`text-xl font-bold ${alertas.length > 0 ? 'text-red-700' : 'text-gray-500'}`}>{alertas.length}</p>
                <p className="text-xs text-muted-foreground">Alertas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alertas activas (si hay) */}
        {alertas.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" />
                Stock Bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-600 mb-3">
                Hay {alertas.length} producto(s) con stock bajo.
              </p>
              <Button variant="outline" size="sm" asChild className="border-red-300 text-red-700 hover:bg-red-100">
                <Link href="/sucursal/alerts">
                  Ver Alertas
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Selector de sucursal para admin */}
        {esAdmin && todasLasSucursales.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Cambiar Sucursal</CardTitle>
            </CardHeader>
            <CardContent>
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
