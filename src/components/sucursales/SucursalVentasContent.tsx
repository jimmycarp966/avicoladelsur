'use client'

import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Plus, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { NuevaVentaForm } from '@/components/sucursales/NuevaVentaForm'
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
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-8 h-8" />
            Ventas de Sucursal
          </h1>
          <p className="text-muted-foreground">
            Registra ventas locales y controla el flujo de caja
          </p>
        </div>

        <Button asChild>
          <Link href="#nueva-venta">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Venta
          </Link>
        </Button>
      </div>

      {/* Estadísticas del Día */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Día</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.estadisticas.ventasDia}</div>
            <p className="text-xs text-muted-foreground">
              Pedidos completados hoy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total del Día</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${data.estadisticas.totalVentasDia.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos generados hoy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Disponibles</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.estadisticas.productosDisponibles}</div>
            <p className="text-xs text-muted-foreground">
              Productos en stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.estadisticas.clientesDisponibles}</div>
            <p className="text-xs text-muted-foreground">
              Clientes registrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Formulario Nueva Venta */}
      <Card id="nueva-venta">
        <CardHeader>
          <CardTitle>Nueva Venta</CardTitle>
          <CardDescription>
            Registra una nueva venta en la sucursal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NuevaVentaForm
            productos={data.productosDisponibles}
            clientes={data.clientes}
            cajas={data.cajas}
            listasPrecios={data.listasPrecios || []}
            sucursalId={data.sucursalId}
          />
        </CardContent>
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
