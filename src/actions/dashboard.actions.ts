'use server'

import { createClient } from '@/lib/supabase/server'
import { getTodayArgentina } from '@/lib/utils'
import { devError, devWarn } from '@/lib/utils/logger'
import type { ApiResponse } from '@/types/api.types'

/**
 * Obtiene métricas del dashboard admin
 */
export async function obtenerMetricasDashboardAction(): Promise<ApiResponse<{
  totalProductos: number
  pedidosPendientes: number
  entregasHoy: { completadas: number; pendientes: number; total: number }
  clientesActivos: number
  crecimientoProductos: number
  crecimientoClientes: number
}>> {
  try {
    const supabase = await createClient()
    const hoy = getTodayArgentina()

    // Obtener total de productos activos
    const { count: totalProductos, error: productosError } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)

    if (productosError) throw productosError

    // Obtener productos del mes pasado para comparación
    const mesPasado = new Date()
    mesPasado.setMonth(mesPasado.getMonth() - 1)
    const { count: productosMesPasado } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)
      .lte('created_at', mesPasado.toISOString())

    const crecimientoProductos = productosMesPasado && productosMesPasado > 0
      ? (((totalProductos || 0) - productosMesPasado) / productosMesPasado) * 100
      : 0

    // Obtener pedidos pendientes (estados: pendiente, en_almacen, enviado)
    const { count: pedidosPendientes, error: pedidosError } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'en_almacen', 'enviado'])

    if (pedidosError) throw pedidosError

    // Obtener entregas de hoy
    const { data: entregasHoyData, error: entregasError } = await supabase
      .from('detalles_ruta')
      .select('estado_entrega, created_at')
      .gte('created_at', `${hoy}T00:00:00.000Z`)
      .lte('created_at', `${hoy}T23:59:59.999Z`)

    if (entregasError) throw entregasError

    const entregasCompletadas = entregasHoyData?.filter(e => e.estado_entrega === 'entregado').length || 0
    const entregasPendientes = entregasHoyData?.filter(e => e.estado_entrega === 'pendiente').length || 0
    const totalEntregas = entregasHoyData?.length || 0

    // Obtener clientes activos
    const { count: clientesActivos, error: clientesError } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)

    if (clientesError) throw clientesError

    // Obtener clientes del mes pasado para comparación
    const { count: clientesMesPasado } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)
      .lte('created_at', mesPasado.toISOString())

    const crecimientoClientes = clientesMesPasado && clientesMesPasado > 0
      ? (((clientesActivos || 0) - clientesMesPasado) / clientesMesPasado) * 100
      : 0

    return {
      success: true,
      data: {
        totalProductos: totalProductos || 0,
        pedidosPendientes: pedidosPendientes || 0,
        entregasHoy: {
          completadas: entregasCompletadas,
          pendientes: entregasPendientes,
          total: totalEntregas,
        },
        clientesActivos: clientesActivos || 0,
        crecimientoProductos: Number(crecimientoProductos.toFixed(1)),
        crecimientoClientes: Number(crecimientoClientes.toFixed(1)),
      },
    }
  } catch (error: any) {
    devError('Error al obtener métricas del dashboard:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener métricas del dashboard',
    }
  }
}

/**
 * Obtiene actividad reciente del sistema
 */
export async function obtenerActividadRecienteAction(): Promise<ApiResponse<Array<{
  id: string
  type: 'pedido' | 'entrega' | 'stock' | 'cliente'
  message: string
  time: string
  timestamp: Date
}>>> {
  try {
    const supabase = await createClient()
    const actividades: Array<{
      id: string
      type: 'pedido' | 'entrega' | 'stock' | 'cliente'
      message: string
      time: string
      timestamp: Date
    }> = []

    // Obtener últimos pedidos creados (últimas 2 horas)
    const dosHorasAtras = new Date()
    dosHorasAtras.setHours(dosHorasAtras.getHours() - 2)

    const { data: pedidosRecientes } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, created_at')
      .gte('created_at', dosHorasAtras.toISOString())
      .order('created_at', { ascending: false })
      .limit(3)

    pedidosRecientes?.forEach((pedido) => {
      const minutosAtras = Math.floor((new Date().getTime() - new Date(pedido.created_at).getTime()) / 60000)
      actividades.push({
        id: pedido.id,
        type: 'pedido',
        message: `Nuevo pedido #${pedido.numero_pedido}`,
        time: minutosAtras < 60 ? `${minutosAtras} min ago` : `${Math.floor(minutosAtras / 60)} hour${Math.floor(minutosAtras / 60) > 1 ? 's' : ''} ago`,
        timestamp: new Date(pedido.created_at),
      })
    })

    // Obtener entregas completadas recientes
    const { data: entregasRecientes } = await supabase
      .from('detalles_ruta')
      .select('id, estado_entrega, updated_at, pedido:pedidos(numero_pedido)')
      .eq('estado_entrega', 'entregado')
      .gte('updated_at', dosHorasAtras.toISOString())
      .order('updated_at', { ascending: false })
      .limit(2)

    entregasRecientes?.forEach((entrega) => {
      const pedido = Array.isArray(entrega.pedido) ? entrega.pedido[0] : entrega.pedido
      const minutosAtras = Math.floor((new Date().getTime() - new Date(entrega.updated_at).getTime()) / 60000)
      actividades.push({
        id: entrega.id,
        type: 'entrega',
        message: `Entrega completada #${pedido?.numero_pedido || 'N/A'}`,
        time: minutosAtras < 60 ? `${minutosAtras} min ago` : `${Math.floor(minutosAtras / 60)} hour${Math.floor(minutosAtras / 60) > 1 ? 's' : ''} ago`,
        timestamp: new Date(entrega.updated_at),
      })
    })

    // Obtener alertas de stock recientes
    const { data: alertasRecientes } = await supabase
      .from('alertas_stock')
      .select('id, created_at, producto:productos(nombre)')
      .eq('estado', 'pendiente')
      .gte('created_at', dosHorasAtras.toISOString())
      .order('created_at', { ascending: false })
      .limit(2)

    alertasRecientes?.forEach((alerta) => {
      const producto = Array.isArray(alerta.producto) ? alerta.producto[0] : alerta.producto
      const minutosAtras = Math.floor((new Date().getTime() - new Date(alerta.created_at).getTime()) / 60000)
      actividades.push({
        id: alerta.id,
        type: 'stock',
        message: `Producto "${producto?.nombre || 'Desconocido'}" bajo en stock`,
        time: minutosAtras < 60 ? `${minutosAtras} min ago` : `${Math.floor(minutosAtras / 60)} hour${Math.floor(minutosAtras / 60) > 1 ? 's' : ''} ago`,
        timestamp: new Date(alerta.created_at),
      })
    })

    // Obtener clientes nuevos recientes
    const { data: clientesRecientes } = await supabase
      .from('clientes')
      .select('id, nombre, created_at')
      .gte('created_at', dosHorasAtras.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    clientesRecientes?.forEach((cliente) => {
      const minutosAtras = Math.floor((new Date().getTime() - new Date(cliente.created_at).getTime()) / 60000)
      actividades.push({
        id: cliente.id,
        type: 'cliente',
        message: 'Nuevo cliente registrado',
        time: minutosAtras < 60 ? `${minutosAtras} min ago` : `${Math.floor(minutosAtras / 60)} hour${Math.floor(minutosAtras / 60) > 1 ? 's' : ''} ago`,
        timestamp: new Date(cliente.created_at),
      })
    })

    // Ordenar por timestamp descendente y limitar a 4
    actividades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return {
      success: true,
      data: actividades.slice(0, 4),
    }
  } catch (error: any) {
    devError('Error al obtener actividad reciente:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener actividad reciente',
      data: [],
    }
  }
}

/**
 * Obtiene métricas de rendimiento del mes actual
 */
export async function obtenerMetricasRendimientoAction(): Promise<ApiResponse<{
  crecimientoVentas: number
  tiempoPromedioEntrega: number
  tasaSatisfaccion: number
  productosStockBajo: number
}>> {
  try {
    const supabase = await createClient()
    const hoy = new Date()
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0)

    // Calcular crecimiento de ventas
    const { data: ventasMesActual } = await supabase
      .from('pedidos')
      .select('total')
      .eq('estado', 'completado')
      .gte('created_at', inicioMes.toISOString())

    const { data: ventasMesAnterior } = await supabase
      .from('pedidos')
      .select('total')
      .eq('estado', 'completado')
      .gte('created_at', inicioMesAnterior.toISOString())
      .lte('created_at', finMesAnterior.toISOString())

    const totalVentasActual = ventasMesActual?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0
    const totalVentasAnterior = ventasMesAnterior?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0
    const crecimientoVentas = totalVentasAnterior > 0
      ? ((totalVentasActual - totalVentasAnterior) / totalVentasAnterior) * 100
      : 0

    // Calcular tiempo promedio de entrega (en horas)
    const { data: entregasCompletadas } = await supabase
      .from('detalles_ruta')
      .select('created_at, updated_at, estado_entrega')
      .eq('estado_entrega', 'entregado')
      .gte('created_at', inicioMes.toISOString())
      .not('created_at', 'is', null)
      .not('updated_at', 'is', null)

    let tiempoPromedioEntrega = 0
    if (entregasCompletadas && entregasCompletadas.length > 0) {
      const tiemposEntrega = entregasCompletadas
        .map(e => {
          const inicio = new Date(e.created_at).getTime()
          const fin = new Date(e.updated_at).getTime()
          return (fin - inicio) / (1000 * 60 * 60) // Convertir a horas
        })
        .filter(t => t > 0 && t < 24) // Filtrar valores anómalos

      tiempoPromedioEntrega = tiemposEntrega.length > 0
        ? tiemposEntrega.reduce((sum, t) => sum + t, 0) / tiemposEntrega.length
        : 0
    }

    // Tasa de satisfacción (basada en entregas exitosas vs rechazadas)
    const { count: entregasExitosas } = await supabase
      .from('detalles_ruta')
      .select('*', { count: 'exact', head: true })
      .eq('estado_entrega', 'entregado')
      .gte('created_at', inicioMes.toISOString())

    const { count: entregasRechazadas } = await supabase
      .from('detalles_ruta')
      .select('*', { count: 'exact', head: true })
      .eq('estado_entrega', 'rechazado')
      .gte('created_at', inicioMes.toISOString())

    const totalEntregas = (entregasExitosas || 0) + (entregasRechazadas || 0)
    const tasaSatisfaccion = totalEntregas > 0
      ? ((entregasExitosas || 0) / totalEntregas) * 100
      : 100

    // Productos con stock bajo
    const { count: productosStockBajo } = await supabase
      .from('alertas_stock')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente')

    return {
      success: true,
      data: {
        crecimientoVentas: Number(crecimientoVentas.toFixed(1)),
        tiempoPromedioEntrega: Number(tiempoPromedioEntrega.toFixed(1)),
        tasaSatisfaccion: Number(tasaSatisfaccion.toFixed(1)),
        productosStockBajo: productosStockBajo || 0,
      },
    }
  } catch (error: any) {
    devError('Error al obtener métricas de rendimiento:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener métricas de rendimiento',
    }
  }
}

/**
 * Obtiene datos de ventas mensuales para el gráfico
 */
export async function obtenerVentasMensualesAction(): Promise<ApiResponse<Array<{
  mes: string
  ventas: number
  pedidos: number
}>>> {
  try {
    const supabase = await createClient()
    const hoy = new Date()
    const meses: Array<{ mes: string; ventas: number; pedidos: number }> = []

    // Obtener datos de los últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0)

      const mesNombre = fechaInicio.toLocaleDateString('es-AR', { month: 'short' })
      const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)

      const { data: pedidosMes } = await supabase
        .from('pedidos')
        .select('total, estado')
        .eq('estado', 'completado')
        .gte('created_at', fechaInicio.toISOString())
        .lte('created_at', fechaFin.toISOString())

      const ventasMes = pedidosMes?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0
      const cantidadPedidos = pedidosMes?.length || 0

      meses.push({
        mes: mesCapitalizado,
        ventas: ventasMes,
        pedidos: cantidadPedidos,
      })
    }

    return {
      success: true,
      data: meses,
    }
  } catch (error: any) {
    devError('Error al obtener ventas mensuales:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener ventas mensuales',
      data: [],
    }
  }
}

/**
 * Obtiene distribución de productos por categoría
 */
export async function obtenerProductosPorCategoriaAction(): Promise<ApiResponse<Array<{
  name: string
  value: number
  color: string
}>>> {
  try {
    const supabase = await createClient()

    // Obtener productos con sus categorías
    const { data: productos } = await supabase
      .from('productos')
      .select('categoria, activo')
      .eq('activo', true)

    if (!productos) {
      return {
        success: true,
        data: [],
      }
    }

    // Agrupar por categoría
    const categoriasMap = new Map<string, number>()
    productos.forEach((p) => {
      const categoria = p.categoria || 'Otros'
      categoriasMap.set(categoria, (categoriasMap.get(categoria) || 0) + 1)
    })

    // Calcular porcentajes
    const total = productos.length
    const colores = ['#2F7058', '#FCDE8D', '#D9EBC6', '#CB3433', '#8B7355', '#A8D5BA']
    let colorIndex = 0

    const categorias = Array.from(categoriasMap.entries())
      .map(([name, count]) => {
        const porcentaje = total > 0 ? Math.round((count / total) * 100) : 0
        const color = colores[colorIndex % colores.length]
        colorIndex++
        return {
          name,
          value: porcentaje,
          color,
        }
      })
      .sort((a, b) => b.value - a.value) // Ordenar por porcentaje descendente

    return {
      success: true,
      data: categorias,
    }
  } catch (error: any) {
    devError('Error al obtener productos por categoría:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener productos por categoría',
      data: [],
    }
  }
}

/**
 * Obtiene entregas por día de la semana (última semana)
 */
export async function obtenerEntregasPorDiaAction(): Promise<ApiResponse<Array<{
  dia: string
  entregas: number
  km: number
}>>> {
  try {
    const supabase = await createClient()
    const hoy = new Date()
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const entregasPorDia: Array<{ dia: string; entregas: number; km: number }> = []

    // Obtener datos de los últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(hoy)
      fecha.setDate(fecha.getDate() - i)
      const fechaInicio = new Date(fecha.setHours(0, 0, 0, 0))
      const fechaFin = new Date(fecha.setHours(23, 59, 59, 999))

      const diaNombre = diasSemana[fecha.getDay()]

      // Obtener entregas del día
      const { data: entregasDia } = await supabase
        .from('detalles_ruta')
        .select('id, estado_entrega, ruta_id, rutas_reparto(distancia_estimada_km)')
        .gte('created_at', fechaInicio.toISOString())
        .lte('created_at', fechaFin.toISOString())

      const entregas = entregasDia?.length || 0

      // Calcular km totales (distribuir distancia de ruta entre entregas)
      let km = 0
      if (entregasDia && entregasDia.length > 0) {
        const rutasUnicas = new Set(entregasDia.map(e => e.ruta_id))
        rutasUnicas.forEach((rutaId) => {
          const ruta = entregasDia.find(e => e.ruta_id === rutaId)
          const rutaData = Array.isArray(ruta?.rutas_reparto) ? ruta.rutas_reparto[0] : ruta?.rutas_reparto
          const distanciaRuta = rutaData?.distancia_estimada_km || 0
          const entregasRuta = entregasDia.filter(e => e.ruta_id === rutaId).length
          // Distribuir distancia proporcionalmente
          km += distanciaRuta / Math.max(entregasRuta, 1)
        })
      }

      entregasPorDia.push({
        dia: diaNombre,
        entregas,
        km: Math.round(km),
      })
    }

    return {
      success: true,
      data: entregasPorDia,
    }
  } catch (error: any) {
    devError('Error al obtener entregas por día:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener entregas por día',
      data: [],
    }
  }
}

/**
 * Obtiene métricas de eficiencia de rutas (semana actual)
 */
export async function obtenerMetricasEficienciaRutasAction(): Promise<ApiResponse<{
  distanciaAhorradaKm: number
  tiempoAhorradoMin: number
  combustibleAhorrado: number
  totalRutas: number
}>> {
  try {
    const supabase = await createClient()

    // Obtener métricas de la semana actual usando la función RPC
    const { data, error } = await supabase.rpc('fn_obtener_metricas_rutas_semana', {
      p_fecha: getTodayArgentina()
    })

    if (error) {
      // Si la función no existe o hay error, retornar valores por defecto sin fallar
      devWarn('Error al obtener métricas de rutas (puede ser que la función no exista aún):', error.message)
      return {
        success: true,
        data: {
          distanciaAhorradaKm: 0,
          tiempoAhorradoMin: 0,
          combustibleAhorrado: 0,
          totalRutas: 0,
        },
      }
    }

    // Asegurar que data sea un objeto válido
    if (!data || typeof data !== 'object') {
      return {
        success: true,
        data: {
          distanciaAhorradaKm: 0,
          tiempoAhorradoMin: 0,
          combustibleAhorrado: 0,
          totalRutas: 0,
        },
      }
    }

    return {
      success: true,
      data: {
        distanciaAhorradaKm: Number(data.distancia_ahorrada_km) || 0,
        tiempoAhorradoMin: Number(data.tiempo_ahorrado_min) || 0,
        combustibleAhorrado: Number(data.combustible_ahorrado) || 0,
        totalRutas: Number(data.total_rutas) || 0,
      },
    }
  } catch (error: any) {
    // Capturar cualquier error y retornar valores por defecto
    devWarn('Error al obtener métricas de eficiencia de rutas:', error?.message || error)
    return {
      success: true, // Retornar success: true para no romper el dashboard
      data: {
        distanciaAhorradaKm: 0,
        tiempoAhorradoMin: 0,
        combustibleAhorrado: 0,
        totalRutas: 0,
      },
    }
  }
}

/**
 * Obtiene métricas de rendimiento del repartidor
 */
/**
 * Obtiene métricas de rendimiento del repartidor
 */
export async function obtenerMetricasRepartidorAction(repartidorId: string): Promise<ApiResponse<{
  eficiencia: number
  puntuacionGeneral: number
  tiempoPromedioEntrega: number
  combustibleAhorrado: number
}>> {
  try {
    const supabase = await createClient()
    const hoy = new Date()
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

    // Obtener rutas del repartidor del mes actual
    const { data: rutasMes, error: rutasError } = await supabase
      .from('rutas_reparto')
      .select(`
        id,
        estado,
        tiempo_estimado_min,
        tiempo_real_min,
        distancia_estimada_km,
        distancia_real_km,
        detalles_ruta(id, estado_entrega, created_at, updated_at)
      `)
      .eq('repartidor_id', repartidorId)
      .gte('fecha_ruta', inicioMes.toISOString())

    if (rutasError) throw rutasError

    if (!rutasMes || rutasMes.length === 0) {
      return {
        success: true,
        data: {
          eficiencia: 0,
          puntuacionGeneral: 0,
          tiempoPromedioEntrega: 0,
          combustibleAhorrado: 0,
        },
      }
    }

    // Calcular eficiencia (entregas completadas / total entregas)
    let totalEntregas = 0
    let entregasCompletadas = 0
    let tiempoTotalEntrega = 0
    let entregasConTiempo = 0
    let distanciaEstimadaTotal = 0
    let distanciaRealTotal = 0

    rutasMes.forEach((ruta) => {
      const detallesRaw = (ruta as any).detalles_ruta
      const detalles = Array.isArray(detallesRaw) ? detallesRaw : (detallesRaw ? [detallesRaw] : [])

      totalEntregas += detalles.length
      entregasCompletadas += detalles.filter((d: any) => d.estado_entrega === 'entregado').length

      detalles.forEach((detalle: any) => {
        if (detalle.estado_entrega === 'entregado' && detalle.created_at && detalle.updated_at) {
          try {
            const start = new Date(detalle.created_at).getTime()
            const end = new Date(detalle.updated_at).getTime()
            const tiempoEntrega = (end - start) / (1000 * 60) // minutos

            if (tiempoEntrega > 0 && tiempoEntrega < 480) { // Filtrar valores anómalos (menos de 8 horas)
              tiempoTotalEntrega += tiempoEntrega
              entregasConTiempo++
            }
          } catch {
            // Ignorar errores en parsing de fechas
          }
        }
      })

      distanciaEstimadaTotal += Number(ruta.distancia_estimada_km || 0)
      distanciaRealTotal += Number(ruta.distancia_real_km || 0)
    })

    const eficiencia = totalEntregas > 0 ? Math.round((entregasCompletadas / totalEntregas) * 100) : 0
    const tiempoPromedioEntrega = entregasConTiempo > 0 ? Math.round(tiempoTotalEntrega / entregasConTiempo) : 0

    // Calcular puntuación general (basada en eficiencia y tiempo promedio)
    // Puntuación máxima: 10, basada en eficiencia (70%) y tiempo promedio (30%)
    const eficienciaScore = (eficiencia / 100) * 7 // Máximo 7 puntos
    const tiempoScore = tiempoPromedioEntrega > 0 && tiempoPromedioEntrega < 60
      ? ((60 - tiempoPromedioEntrega) / 60) * 3 // Máximo 3 puntos, mejor tiempo = más puntos
      : (tiempoPromedioEntrega >= 60 ? 0.5 : 0) // Mínimo consuelo si entregó algo

    let puntuacionGeneral = Number((eficienciaScore + tiempoScore).toFixed(1))
    if (isNaN(puntuacionGeneral)) puntuacionGeneral = 0

    // Calcular ahorro de combustible (comparar distancia real vs estimada)
    const combustibleAhorrado = distanciaEstimadaTotal > 0 && distanciaRealTotal > 0
      ? Math.round(((distanciaEstimadaTotal - distanciaRealTotal) / distanciaEstimadaTotal) * 100)
      : 0

    return {
      success: true,
      data: {
        eficiencia,
        puntuacionGeneral,
        tiempoPromedioEntrega,
        combustibleAhorrado: Math.max(0, combustibleAhorrado), // No permitir valores negativos
      },
    }
  } catch (error: any) {
    console.error('❌ [ACTION ERROR] obtenerMetricasRepartidorAction:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener métricas del repartidor',
    }
  }
}


