'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, AlertTriangle, Package, Truck, Building2, ShoppingCart, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
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

        {/* ============================================ */}
        {/* BOTONES DE ACCIÓN GRANDES (ESTILO 3D/PREMIUM) */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* BOTÓN PRINCIPAL: VENDER */}
          <Button
            asChild
            className="md:col-span-2 h-24 text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all"
          >
            <Link href="/sucursal/ventas" className="flex items-center justify-center gap-4">
              <ShoppingCart className="w-10 h-10" />
              <span>NUEVA VENTA</span>
            </Link>
          </Button>

          <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
            {/* RECIBIR MERCADERÍA */}
            <Button
              asChild
              variant="outline"
              className="h-24 md:h-11 flex-1 text-base font-semibold border-2 border-orange-200 hover:bg-orange-50 hover:border-orange-300 relative"
            >
              <Link href="/sucursal/transferencias" className="flex flex-col md:flex-row items-center justify-center gap-2">
                <Truck className="w-5 h-5 text-orange-600" />
                <span>Recibir</span>
                {transferenciasPendientes > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 md:static md:ml-1 animate-pulse"
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
              className="h-24 md:h-11 flex-1 text-base font-semibold border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
            >
              <Link href="/sucursal/inventario" className="flex flex-col md:flex-row items-center justify-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span>Ver Stock</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* ============================================ */}
        {/* SEMÁFORO DE ESTADO (SEMÁFORO DE STOCK) */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Estado de Stock */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Estado del Inventario</span>
                <Badge variant={alertas.length > 0 ? "destructive" : "outline"} className={cn(alertas.length === 0 && "text-green-600 border-green-200 bg-green-50")}>
                  {alertas.length > 0 ? 'Faltantes detectados' : 'Stock saludable'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Disponibilidad General</span>
                    <span className="font-bold">{alertas.length > 0 ? 'Revisión Necesaria' : '100% OK'}</span>
                  </div>
                  <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${Math.max(5, 100 - (alertas.length * 10))}%` }}
                    />
                    {alertas.length > 0 && (
                      <div
                        className="h-full bg-red-500 animate-pulse"
                        style={{ width: `${Math.min(95, alertas.length * 10)}%` }}
                      />
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shadow-inner", alertas.length === 0 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400")}>
                    <Package className="w-6 h-6" />
                  </div>
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shadow-inner", alertas.length > 0 ? "bg-red-500 text-white animate-bounce" : "bg-gray-200 text-gray-400")}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen Caja Rápido */}
          <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Efectivo en Caja</p>
                  <h3 className="text-3xl font-bold mt-1">${caja?.saldo_actual?.toLocaleString() || '0'}</h3>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs">
                <span>Ventas de hoy</span>
                <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full">{ventasDia.length} tickets</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============================================ */}
        {/* RESUMEN DEL DÍA (Métricas Secundarias) */}
        {/* ============================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Ventas Totales */}
          <div className="p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Hoy se vendió</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">${totalVentasDia.toLocaleString()}</p>
          </div>

          {/* Transferencias */}
          <div className="p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ingresos Pend.</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{transferenciasPendientes}</p>
          </div>

          {/* Estado de alertas */}
          <Link
            href="/sucursal/alerts"
            className={cn(
              "p-4 border rounded-xl shadow-sm transition-all block",
              alertas.length > 0
                ? "bg-red-50 border-red-200 hover:bg-red-100"
                : "bg-white hover:border-green-200"
            )}
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Alertas Stock</p>
            <p className={cn("text-2xl font-bold mt-1", alertas.length > 0 ? "text-red-700" : "text-green-600")}>
              {alertas.length > 0 ? `${alertas.length} críticas` : 'Sin alertas'}
            </p>
          </Link>

          {/* Ticket promedio */}
          <div className="p-4 bg-white border rounded-xl shadow-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ticket Prom.</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              ${ventasDia.length > 0 ? (totalVentasDia / ventasDia.length).toFixed(0) : '0'}
            </p>
          </div>
        </div>

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
