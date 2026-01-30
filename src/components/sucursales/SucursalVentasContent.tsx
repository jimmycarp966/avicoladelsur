'use client'

import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Plus, ShoppingCart, DollarSign, LayoutDashboard, Sparkles, Zap, Package, Users } from 'lucide-react'
import Link from 'next/link'
import { POSPremium } from '@/components/sucursales/POSPremium'
import { VentasTable } from '@/components/sucursales/VentasTable'

interface ProductoDisponible {
  id: string
  nombre: string
  codigo: string
  precioVenta: number
  unidadMedida: string
  stockDisponible: number
  // Campos de venta por mayor
  ventaMayorHabilitada?: boolean
  unidadMayorNombre?: string
  kgPorUnidadMayor?: number
}

interface Cliente {
  id: string
  nombre: string
  codigo: string
}

interface Caja {
  id: string
  nombre: string
  saldo_actual: number
}

interface VentaDia {
  id: string
  numero_pedido?: string
  total: number
  estado: string
  metodos_pago: any // JSONB con métodos de pago
  created_at: string
  clientes: {
    nombre: string
  } | null
}

interface Estadisticas {
  ventasDia: number
  totalVentasDia: number
  productosDisponibles: number
  clientesDisponibles: number
}

interface ListaPrecio {
  id: string
  codigo: string
  nombre: string
  tipo: string
  margen_ganancia: number | null
}

interface VentasData {
  ventasDia: VentaDia[]
  productosDisponibles: ProductoDisponible[]
  clientes: Cliente[]
  cajas: Caja[]
  listasPrecios?: ListaPrecio[]
  estadisticas: Estadisticas
  sucursalId: string
}

export function SucursalVentasContent({ data }: { data: VentasData }) {
  return (
    <div className="space-y-6">
      {/* Header Premium */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3 group-hover:rotate-0 transition-transform">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Ventas de Sucursal
            </h1>
            <p className="text-slate-400 font-medium text-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Punto de venta inteligente y rápido
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 px-3 py-1 font-bold">
            ESTADO: ONLINE
          </Badge>
          <Button asChild className="rounded-2xl shadow-lg shadow-primary/20 font-bold px-6">
            <Link href="#nueva-venta">
              <Zap className="w-4 h-4 mr-2" />
              ACCESO RÁPIDO
            </Link>
          </Button>
        </div>
      </div>

      {/* Estadísticas del Día Premium */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ventas del Día", val: data.estadisticas.ventasDia, sub: "Pedidos hoy", icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Total del Día", val: `$${data.estadisticas.totalVentasDia.toFixed(0)}`, sub: "Ingresos netos", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
          { label: "Stock Disponible", val: data.estadisticas.productosDisponibles, sub: "Items en local", icon: Package, color: "text-amber-500", bg: "bg-amber-50" },
          { label: "Clientes Activos", val: data.estadisticas.clientesDisponibles, sub: "Base de datos", icon: Users, color: "text-purple-500", bg: "bg-purple-50" },
        ].map((item, idx) => (
          <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-all group rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">{item.label}</span>
                <div className={cn("p-2 rounded-xl transition-transform group-hover:scale-110", item.bg)}>
                  <item.icon className={cn("h-4 w-4", item.color)} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 tracking-tighter">{item.val}</div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                  {item.sub}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* POS Premium (Punto de Venta) */}
      <Card id="nueva-venta" className="border-none shadow-xl bg-gradient-to-br from-white to-slate-50/50 rounded-3xl overflow-hidden">
        <POSPremium
          productos={data.productosDisponibles}
          clientes={data.clientes}
          sucursalId={data.sucursalId}
        />
      </Card>

      {/* Ventas del Día */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas del Día</CardTitle>
          <CardDescription>
            Lista de ventas completadas hoy en tu sucursal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                  </div>
                  <div className="w-20 h-8 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          }>
            <VentasTable ventas={data.ventasDia} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
