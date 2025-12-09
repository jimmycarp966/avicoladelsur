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

  // Verificar que el usuario tiene sesión válida
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  // Log detallado para debugging
  console.log('🔍 Debug getVentasData:')
  console.log('  - User ID:', user.id)
  console.log('  - User Email:', user.email)
  console.log('  - Session existe:', !!session)
  console.log('  - Session error:', sessionError ? JSON.stringify(sessionError, null, 2) : 'Ninguno')
  console.log('  - Access token:', session?.access_token ? `${session.access_token.substring(0, 20)}...` : 'ausente')
  console.log('  - Expires at:', session?.expires_at)
  console.log('  - Token type:', session?.token_type)
  
  if (!session) {
    console.error('❌ No hay sesión válida:', {
      sessionError,
      userExists: !!user
    })
    throw new Error('Sesión no válida')
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
  
  // Primero probar una consulta simple para verificar que RLS funciona
  const { data: testPedidos, error: testError } = await supabase
    .from('pedidos')
    .select('id')
    .limit(1)
  
  console.log('🔍 Test inicial de acceso a pedidos:')
  console.log('  - Tiene datos:', !!testPedidos, 'Cantidad:', testPedidos?.length || 0)
  console.log('  - Error:', testError ? JSON.stringify(testError, null, 2) : 'Ninguno')
  console.log('  - Puede acceder:', !testError)
  if (testError) {
    console.log('  - Código error:', testError.code)
    console.log('  - Mensaje error:', testError.message)
    console.log('  - Detalles error:', testError.details)
    console.log('  - Hint error:', testError.hint)
  }
  
  // Ahora obtener pedidos con filtros
  const { data: pedidosData, error: pedidosError } = await supabase
    .from('pedidos')
    .select('id, total, estado, metodos_pago, created_at, cliente_id, sucursal_id')
    .eq('sucursal_id', sucursalIdFinal)
    .in('estado', ['completado', 'entregado', 'facturado'])
    .gte('created_at', `${hoy}T00:00:00.000Z`)
    .lte('created_at', `${hoy}T23:59:59.999Z`)
    .order('created_at', { ascending: false })
  
  if (pedidosError) {
    console.error('❌ Error al obtener pedidos con filtros:', {
      error: pedidosError,
      code: pedidosError.code,
      message: pedidosError.message,
      details: pedidosError.details,
      hint: pedidosError.hint,
      sucursalId: sucursalIdFinal,
      userId: user.id,
      userEmail: user.email
    })
  } else {
    console.log('✅ Pedidos obtenidos correctamente:', {
      cantidad: pedidosData?.length || 0
    })
  }
  
  // Obtener datos de clientes por separado si hay pedidos
  let ventasDia: Array<{
    id: string
    total: number
    estado: string
    metodos_pago: any
    created_at: string
    clientes: { nombre: string } | null
  }> = []
  if (pedidosData && pedidosData.length > 0) {
    const clienteIds = [...new Set(pedidosData.map(p => p.cliente_id).filter(Boolean))]
    
    if (clienteIds.length > 0) {
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nombre')
        .in('id', clienteIds)
      
      // Crear mapa de clientes
      const clientesMap = new Map(
        (clientesData || []).map(c => [c.id, { nombre: c.nombre }])
      )
      
      // Combinar pedidos con datos de clientes
      ventasDia = pedidosData.map(pedido => ({
        id: pedido.id,
        total: pedido.total,
        estado: pedido.estado,
        metodos_pago: pedido.metodos_pago,
        created_at: pedido.created_at,
        clientes: pedido.cliente_id ? clientesMap.get(pedido.cliente_id) || null : null
      }))
    } else {
      // Si no hay cliente_id, usar estructura sin cliente
      ventasDia = pedidosData.map(pedido => ({
        id: pedido.id,
        total: pedido.total,
        estado: pedido.estado,
        metodos_pago: pedido.metodos_pago,
        created_at: pedido.created_at,
        clientes: null
      }))
    }
  }
  
  // Mantener compatibilidad con código existente
  const ventasError = pedidosError

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

  // Probar acceso a clientes primero
  const { data: testClientes, error: testClientesError } = await supabase
    .from('clientes')
    .select('id')
    .limit(1)
  
  console.log('🔍 Test inicial de acceso a clientes:')
  console.log('  - Tiene datos:', !!testClientes, 'Cantidad:', testClientes?.length || 0)
  console.log('  - Error:', testClientesError ? JSON.stringify(testClientesError, null, 2) : 'Ninguno')
  console.log('  - Puede acceder:', !testClientesError)
  if (testClientesError) {
    console.log('  - Código error:', testClientesError.code)
    console.log('  - Mensaje error:', testClientesError.message)
    console.log('  - Detalles error:', testClientesError.details)
    console.log('  - Hint error:', testClientesError.hint)
  }
  
  // Obtener clientes disponibles
  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('id, nombre, codigo')
    .eq('activo', true)
    .order('nombre')
  
  if (clientesError) {
    console.error('❌ Error al obtener clientes con filtros:', {
      error: clientesError,
      code: clientesError.code,
      message: clientesError.message,
      details: clientesError.details,
      hint: clientesError.hint,
      userId: user.id,
      userEmail: user.email
    })
  } else {
    console.log('✅ Clientes obtenidos correctamente:', {
      cantidad: clientes?.length || 0
    })
  }

  // Obtener cajas disponibles
  const { data: cajas, error: cajasError } = await supabase
    .from('tesoreria_cajas')
    .select('id, nombre, saldo_actual')
    .eq('sucursal_id', sucursalIdFinal)

  // Obtener listas de precios activas
  const { data: listasPrecios, error: listasError } = await supabase
    .from('listas_precios')
    .select('id, codigo, nombre, tipo, margen_ganancia, vigencia_activa, fecha_vigencia_desde, fecha_vigencia_hasta')
    .eq('activa', true)
    .order('tipo')

  // Si hay error crítico en pedidos, solo loguear pero continuar (ya manejado arriba)
  // No lanzar error para permitir que la página se cargue con datos parciales
  if (productosError) {
    // Verificar si el error es realmente un objeto con propiedades o está vacío
    const hasErrorInfo = productosError && (
      productosError.code || 
      productosError.message || 
      productosError.details || 
      productosError.hint ||
      Object.keys(productosError).length > 0
    )
    
    if (hasErrorInfo) {
      const errorMessage = productosError.message || productosError.details || productosError.hint || JSON.stringify(productosError)
      console.error('Error al obtener productos:', {
        error: productosError,
        code: productosError.code,
        message: productosError.message,
        sucursalId: sucursalIdFinal
      })
      // No lanzar error, continuar con array vacío
    } else {
      // Error vacío - probablemente RLS bloqueando silenciosamente
      console.warn('Error vacío al obtener productos - posible problema de RLS:', {
        sucursalId: sucursalIdFinal,
        hint: 'Verifica que las políticas RLS de lotes permiten acceso a vendedores'
      })
      // Continuar sin lanzar error
    }
  }
  if (clientesError) {
    console.error('Error al obtener clientes:', {
      error: clientesError,
      code: clientesError.code,
      message: clientesError.message,
      details: clientesError.details,
      hint: clientesError.hint,
      userId: user.id,
      userEmail: user.email,
      errorString: JSON.stringify(clientesError),
      errorKeys: Object.keys(clientesError || {})
    })
    // Continuar con array vacío en lugar de lanzar error
  }
  if (cajasError) {
    console.error('Error al obtener cajas:', {
      error: cajasError,
      code: cajasError.code,
      message: cajasError.message,
      details: cajasError.details,
      hint: cajasError.hint,
      sucursalId: sucursalIdFinal,
      userId: user.id,
      userEmail: user.email,
      errorString: JSON.stringify(cajasError),
      errorKeys: Object.keys(cajasError || {})
    })
    // Continuar con array vacío en lugar de lanzar error
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
    clientes: (clientes || []).map(c => ({
      id: c.id,
      nombre: c.nombre,
      codigo: c.codigo || ''
    })),
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
