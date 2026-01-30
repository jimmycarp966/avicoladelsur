import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, AlertTriangle, Building2, CheckCircle2 } from 'lucide-react'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

// Función para determinar el estado del stock
function getEstadoStock(cantidad: number, minimo?: number) {
  const umbral = minimo || 10 // Umbral por defecto si no hay stock mínimo definido

  if (cantidad <= 0) return { nivel: 'sin_stock', color: 'bg-gray-200', emoji: '⚫', texto: 'Sin stock' }
  if (cantidad < umbral) return { nivel: 'critico', color: 'bg-red-100 border-red-300', emoji: '🔴', texto: 'Crítico' }
  if (cantidad < umbral * 2) return { nivel: 'bajo', color: 'bg-yellow-100 border-yellow-300', emoji: '🟡', texto: 'Bajo' }
  return { nivel: 'ok', color: 'bg-green-100 border-green-300', emoji: '🟢', texto: 'OK' }
}

async function getInventarioSucursal(sidParam?: string) {
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
      stockBajo: 0,
      stockCritico: 0,
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener productos disponibles con stock mínimo
  const { data: productos, error: productosError } = await supabase
    .from('lotes')
    .select(`
      cantidad_disponible,
      productos (
        nombre,
        codigo,
        stock_minimo_sucursal
      )
    `)
    .eq('sucursal_id', sucursalId)
    .gt('cantidad_disponible', 0)
    .order('cantidad_disponible', { ascending: true })

  if (productosError) {
    throw new Error('Error al obtener inventario')
  }

  // Contar productos por estado
  let stockBajo = 0
  let stockCritico = 0

  productos?.forEach(item => {
    const producto = Array.isArray(item.productos) ? item.productos[0] : item.productos
    const minimo = producto?.stock_minimo_sucursal || 10
    const estado = getEstadoStock(item.cantidad_disponible, minimo)

    if (estado.nivel === 'critico') stockCritico++
    else if (estado.nivel === 'bajo') stockBajo++
  })

  return {
    productos: productos || [],
    totalProductos: productos?.length || 0,
    stockBajo,
    stockCritico,
    sinSucursal: false,
    esAdmin
  }
}

export default async function SucursalInventarioPage({ searchParams }: PageProps) {
  const params = await searchParams
  try {
    const data = await getInventarioSucursal(params.sid)

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
                  Como administrador, necesitas crear una sucursal antes de poder ver el inventario.
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

    // Determinar estado general
    const estadoGeneral = data.stockCritico > 0
      ? { texto: 'Atención Requerida', color: 'text-red-600', emoji: '🔴' }
      : data.stockBajo > 0
        ? { texto: 'Revisar Stock', color: 'text-yellow-600', emoji: '🟡' }
        : { texto: 'Normal', color: 'text-green-600', emoji: '🟢' }

    return (
      <div className="space-y-6">
        {/* Header simplificado */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Stock Disponible</h1>
            <p className="text-muted-foreground text-sm">Inventario de la sucursal</p>
          </div>
        </div>

        {/* Resumen con semáforo */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {/* Total */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{data.totalProductos}</p>
                <p className="text-xs text-muted-foreground">Productos</p>
              </div>
            </CardContent>
          </Card>

          {/* Estado General */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <p className="text-2xl">{estadoGeneral.emoji}</p>
                <p className={cn("text-xs font-medium", estadoGeneral.color)}>{estadoGeneral.texto}</p>
              </div>
            </CardContent>
          </Card>

          {/* Stock Bajo */}
          <Card className={data.stockBajo > 0 ? "border-yellow-300 bg-yellow-50" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <p className={cn("text-2xl font-bold", data.stockBajo > 0 ? "text-yellow-600" : "")}>
                  {data.stockBajo}
                </p>
                <p className="text-xs text-muted-foreground">🟡 Stock Bajo</p>
              </div>
            </CardContent>
          </Card>

          {/* Stock Crítico */}
          <Card className={data.stockCritico > 0 ? "border-red-300 bg-red-50" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <p className={cn("text-2xl font-bold", data.stockCritico > 0 ? "text-red-600" : "")}>
                  {data.stockCritico}
                </p>
                <p className="text-xs text-muted-foreground">🔴 Crítico</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Productos con semáforo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Productos en Stock</CardTitle>
          </CardHeader>
          <CardContent>
            {data.productos.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
                <p className="text-muted-foreground">
                  No se encontraron productos con stock disponible
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.productos.map((item, index) => {
                  const producto = Array.isArray(item.productos)
                    ? item.productos[0]
                    : (item.productos as { nombre?: string; codigo?: string; stock_minimo_sucursal?: number } | null)

                  const minimo = producto?.stock_minimo_sucursal || 10
                  const estado = getEstadoStock(item.cantidad_disponible, minimo)

                  // Calcular progreso visual (% del mínimo * 2)
                  const progreso = Math.min((item.cantidad_disponible / (minimo * 2)) * 100, 100)
                  const progresoColor = estado.nivel === 'ok' ? 'bg-green-500'
                    : estado.nivel === 'bajo' ? 'bg-yellow-500'
                      : 'bg-red-500'

                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-lg transition-colors",
                        estado.color
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Emoji semáforo */}
                        <span className="text-xl">{estado.emoji}</span>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">
                            {producto?.nombre || 'Producto desconocido'}
                          </h4>
                          {/* Barra de progreso */}
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className={cn("h-1.5 rounded-full transition-all", progresoColor)}
                              style={{ width: `${progreso}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <div className="text-lg font-bold">{item.cantidad_disponible}</div>
                        <div className="text-xs text-muted-foreground">
                          mín: {minimo}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
              <Package className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar inventario</h3>
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
