import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, AlertTriangle, Settings, Building2 } from 'lucide-react'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import Link from 'next/link'
import { StockMinimoTable } from '@/components/sucursales/StockMinimoTable'

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

async function getStockMinimoSucursal(sidParam?: string) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario con soporte para admin
  const { sucursalId, esAdmin } = await getSucursalUsuarioConAdmin(supabase, user.id, user.email || '', sidParam)

  if (!sucursalId && !esAdmin) {
    throw new Error('Usuario no tiene sucursal asignada')
  }

  if (!sucursalId) {
    // Admin sin sucursales activas
    return {
      productos: [],
      totalProductos: 0,
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener productos con stock en la sucursal, junto con sus mínimas globales y específicos
  const { data: lotes, error: lotesError } = await supabase
    .from('lotes')
    .select(`
      cantidad_disponible,
      productos!inner (
        id,
        nombre,
        codigo,
        stock_minimo,
        activo
      )
    `)
    .eq('sucursal_id', sucursalId)
    .eq('estado', 'disponible')
    .gt('cantidad_disponible', 0)

  if (lotesError) {
    throw new Error('Error al obtener productos')
  }

  // Obtener configuraciones específicas por sucursal
  const { data: minimosSucursal, error: minimosError } = await supabase
    .from('producto_sucursal_minimos')
    .select('producto_id, stock_minimo')
    .eq('sucursal_id', sucursalId)

  if (minimosError) {
    throw new Error('Error al obtener configuraciones de stock mínimo')
  }

  // Crear mapa de mínimos por sucursal
  const minimosMap = new Map(
    (minimosSucursal || []).map(item => [item.producto_id, item.stock_minimo])
  )

  // Agrupar por producto y calcular stock total
  const productosMap = new Map<string, any>()

  for (const lote of lotes || []) {
    const productos = Array.isArray(lote.productos) ? lote.productos : [lote.productos]
    if (productos.length === 0) continue
    
    const producto = productos[0] as { id: string; nombre: string; codigo: string; stock_minimo: number; activo: boolean }
    if (!producto.activo) continue

    const productoId = producto.id

    if (!productosMap.has(productoId)) {
      productosMap.set(productoId, {
        productoId,
        productoNombre: producto.nombre,
        productoCodigo: producto.codigo,
        stockMinimoGlobal: producto.stock_minimo,
        stockMinimoSucursal: minimosMap.get(productoId) || null,
        stockActual: 0
      })
    }

    // Sumar stock actual
    productosMap.get(productoId)!.stockActual += lote.cantidad_disponible
  }

  const productos = Array.from(productosMap.values())

  return {
    productos,
    totalProductos: productos.length,
    sinSucursal: false,
    esAdmin,
    sucursalId
  }
}

export default async function StockMinimoSucursalPage({ searchParams }: PageProps) {
  const params = await searchParams
  try {
    const data = await getStockMinimoSucursal(params.sid)

    // Si es admin sin sucursal, mostrar mensaje informativo
    if (data.sinSucursal && data.esAdmin) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-amber-900">
                  No hay sucursales activas
                </h3>
                <p className="text-amber-800 mb-4">
                  Como administrador, necesitas crear una sucursal antes de poder configurar stock mínimo.
                </p>
                <Button asChild>
                  <Link href="/sucursales/nueva">
                    <Building2 className="w-4 h-4 mr-2" />
                    Crear Primera Sucursal
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Settings className="w-8 h-8" />
              Configuración de Stock Mínimo
            </h1>
            <p className="text-muted-foreground">
              Configura umbrales personalizados de stock mínimo para tu sucursal
            </p>
          </div>
        </div>

        {/* Información */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-blue-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              ¿Cómo funciona?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-blue-800">
              <p>• <strong>Stock Mínimo Global:</strong> Configurado en cada producto, aplica a todas las sucursales por defecto.</p>
              <p>• <strong>Stock Mínimo Sucursal:</strong> Configuración específica para tu sucursal. Si configuras uno, este prevalece sobre el global.</p>
              <p>• <strong>Transferencias Automáticas:</strong> Se generan automáticamente cuando el stock actual cae por debajo del umbral configurado.</p>
              <p>• <strong>Sin Configuración:</strong> Si no configuras un mínimo específico, se usa el global del producto.</p>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos Configurados</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.productos.filter(p => p.stockMinimoSucursal !== null).length}</div>
              <p className="text-xs text-muted-foreground">
                Con mínimo personalizado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usando Global</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.productos.filter(p => p.stockMinimoSucursal === null && p.stockMinimoGlobal !== null).length}</div>
              <p className="text-xs text-muted-foreground">
                Sin configuración específica
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sin Configuración</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.productos.filter(p => p.stockMinimoSucursal === null && p.stockMinimoGlobal === null).length}</div>
              <p className="text-xs text-muted-foreground">
                No se generarán transferencias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de configuración */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración por Producto</CardTitle>
            <CardDescription>
              Productos con stock disponible en tu sucursal. Solo se muestran productos activos con inventario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
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
              <StockMinimoTable productos={data.productos} sucursalId={data.sucursalId!} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Settings className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar configuración</h3>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
