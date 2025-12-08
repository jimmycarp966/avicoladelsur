import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingCart, AlertTriangle } from 'lucide-react'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import { SucursalVentasContent } from '@/components/sucursales/SucursalVentasContent'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

interface ProductoDisponible {
  id: string
  nombre: string
  codigo: string
  precioVenta: number
  unidadMedida: string
  stockDisponible: number
}

interface Cliente {
  id: string
  nombre: string
  apellido: string
  codigo: string
}

interface Caja {
  id: string
  nombre: string
  saldo_actual: number
}

async function getVentasData(sidParam?: string) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario con soporte para admin
  const { sucursalId, esAdmin } = await getSucursalUsuarioConAdmin(supabase, user.id, user.email || '', sidParam)

  // Si es admin y no tiene sucursal asignada, obtener la primera sucursal activa
  let sucursalIdFinal = sucursalId
  if (!sucursalIdFinal && esAdmin) {
    const { data: sucursalesActivas } = await supabase
      .from('sucursales')
      .select('id')
      .eq('active', true)
      .order('nombre')
      .limit(1)
    
    if (sucursalesActivas && sucursalesActivas.length > 0) {
      sucursalIdFinal = sucursalesActivas[0].id
    }
  }

  if (!sucursalIdFinal && !esAdmin) {
    throw new Error('Usuario no tiene sucursal asignada')
  }

  if (!sucursalIdFinal) {
    // Admin sin sucursales activas - retornar datos vacíos
    return {
      ventasDia: [],
      productosDisponibles: [],
      clientes: [],
      cajas: [],
      listasPrecios: [],
      estadisticas: {
        ventasDia: 0,
        totalVentasDia: 0,
        productosDisponibles: 0,
        clientesDisponibles: 0
      },
      sucursalId: '',
      esAdmin: true,
      sinSucursal: true
    }
  }

  // Obtener ventas del día actual
  const hoy = new Date().toISOString().split('T')[0]
  const { data: ventasDia, error: ventasError } = await supabase
    .from('pedidos')
    .select(`
      id,
      total,
      estado,
      metodo_pago,
      created_at,
      clientes (
        nombre,
        apellido
      )
    `)
    .eq('sucursal_id', sucursalIdFinal)
    .eq('estado', 'completado')
    .gte('created_at', `${hoy}T00:00:00.000Z`)
    .lte('created_at', `${hoy}T23:59:59.999Z`)
    .order('created_at', { ascending: false })

  // Obtener productos disponibles para venta
  const { data: productosDisponibles, error: productosError } = await supabase
    .from('lotes')
    .select(`
      producto_id,
      cantidad_disponible,
      productos (
        nombre,
        codigo,
        precio_venta,
        unidad_medida
      )
    `)
    .eq('sucursal_id', sucursalIdFinal)
    .gt('cantidad_disponible', 0)

  // Obtener clientes disponibles
  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('id, nombre, apellido, codigo')
    .eq('activo', true)
    .order('nombre')

  // Obtener cajas disponibles
  const { data: cajas, error: cajasError } = await supabase
    .from('tesoreria_cajas')
    .select('id, nombre, saldo_actual')
    .eq('sucursal_id', sucursalIdFinal)
    .eq('active', true)

  // Obtener listas de precios activas
  const { data: listasPrecios, error: listasError } = await supabase
    .from('listas_precios')
    .select('id, codigo, nombre, tipo, margen_ganancia, vigencia_activa, fecha_vigencia_desde, fecha_vigencia_hasta')
    .eq('activa', true)
    .order('tipo')

  // Mejorar manejo de errores con mensajes específicos
  if (ventasError) {
    console.error('Error al obtener ventas:', ventasError)
    throw new Error(`Error al obtener ventas: ${ventasError.message}`)
  }
  if (productosError) {
    console.error('Error al obtener productos:', productosError)
    throw new Error(`Error al obtener productos: ${productosError.message}`)
  }
  if (clientesError) {
    console.error('Error al obtener clientes:', clientesError)
    throw new Error(`Error al obtener clientes: ${clientesError.message}`)
  }
  if (cajasError) {
    console.error('Error al obtener cajas:', cajasError)
    throw new Error(`Error al obtener cajas: ${cajasError.message}`)
  }
  if (listasError) {
    console.error('Error al obtener listas de precios:', listasError)
    // No es crítico, continuar sin listas
  }

  // Agrupar productos por ID único
  const productosAgrupados = (productosDisponibles || []).reduce((acc: any, lote: any) => {
    const productoId = lote.producto_id
    const producto = lote.productos

    if (!acc[productoId]) {
      acc[productoId] = {
        id: productoId,
        nombre: producto?.nombre || 'Producto desconocido',
        codigo: producto?.codigo || '',
        precioVenta: producto?.precio_venta || 0,
        unidadMedida: producto?.unidad_medida || 'unidades',
        stockDisponible: 0
      }
    }

    acc[productoId].stockDisponible += Number(lote.cantidad_disponible)
    return acc
  }, {})

  // Estadísticas
  const estadisticas = {
    ventasDia: ventasDia?.length || 0,
    totalVentasDia: (ventasDia || []).reduce((sum, venta) => sum + (venta.total || 0), 0),
    productosDisponibles: Object.keys(productosAgrupados).length,
    clientesDisponibles: clientes?.length || 0
  }

  return {
    ventasDia: (ventasDia || []).map(venta => {
      // Manejar caso donde clientes puede ser un array o un objeto
      let clienteData = null
      if (venta.clientes) {
        if (Array.isArray(venta.clientes)) {
          clienteData = venta.clientes[0] || null
        } else {
          clienteData = venta.clientes
        }
      }
      return {
        ...venta,
        clientes: clienteData
      }
    }),
    productosDisponibles: Object.values(productosAgrupados) as ProductoDisponible[],
    clientes: clientes || [] as Cliente[],
    cajas: cajas || [] as Caja[],
    listasPrecios: (listasPrecios || []).filter(lista => {
      // Filtrar por vigencia si está activada
      if (lista.vigencia_activa) {
        const desdeValida = !lista.fecha_vigencia_desde || lista.fecha_vigencia_desde <= hoy
        const hastaValida = !lista.fecha_vigencia_hasta || lista.fecha_vigencia_hasta >= hoy
        return desdeValida && hastaValida
      }
      return true
    }),
    estadisticas,
    sucursalId: sucursalIdFinal,
    esAdmin,
    sinSucursal: false
  }
}

export default async function SucursalVentasPage({ searchParams }: PageProps) {
  const params = await searchParams
  try {
    const data = await getVentasData(params.sid)
    
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
                  Como administrador, necesitas crear una sucursal antes de poder realizar ventas.
                </p>
                <Button asChild>
                  <Link href="/sucursales/nueva">
                    Crear Primera Sucursal
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }
    
    return <SucursalVentasContent data={data} />
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <ShoppingCart className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar ventas</h3>
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
