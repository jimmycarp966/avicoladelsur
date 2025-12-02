import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, AlertTriangle, Building2 } from 'lucide-react'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
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
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener productos disponibles
  const { data: productos, error: productosError } = await supabase
    .from('lotes')
    .select(`
      cantidad_disponible,
      productos (
        nombre,
        codigo
      )
    `)
    .eq('sucursal_id', sucursalId)
    .gt('cantidad_disponible', 0)

  if (productosError) {
    throw new Error('Error al obtener inventario')
  }

  return {
    productos: productos || [],
    totalProductos: productos?.length || 0,
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

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Package className="w-8 h-8" />
              Inventario de Sucursal
            </h1>
            <p className="text-muted-foreground">
              Control y seguimiento del stock disponible
            </p>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos Disponibles</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalProductos}</div>
              <p className="text-xs text-muted-foreground">
                Con stock disponible
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado General</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Normal</div>
              <p className="text-xs text-muted-foreground">
                Inventario actualizado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Productos */}
        <Card>
          <CardHeader>
            <CardTitle>Productos en Stock</CardTitle>
            <CardDescription>
              Lista completa del inventario disponible
            </CardDescription>
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
              <div className="space-y-4">
                {data.productos.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary" />
                      </div>

                      <div>
                        <h4 className="font-semibold">
                          {item.productos?.[0]?.nombre || 'Producto desconocido'}
                        </h4>
                        {item.productos?.[0]?.codigo && (
                          <Badge variant="outline" className="text-xs">
                            {item.productos[0].codigo}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold">{item.cantidad_disponible}</div>
                      <div className="text-sm text-muted-foreground">unidades</div>
                    </div>
                  </div>
                ))}
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
