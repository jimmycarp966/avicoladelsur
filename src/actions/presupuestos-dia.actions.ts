import { createClient } from '@/lib/supabase/server'
import { getTodayArgentina, esVentaMayorista } from '@/lib/utils'

// Re-exportar para mantener compatibilidad
export { esVentaMayorista }

// Helper para determinar si un item es pesable
export function esItemPesable(item: any, esVentaMayorista: boolean = false): boolean {
  // Si es venta mayorista, NO es pesable (productos vienen en caja cerrada)
  if (esVentaMayorista) {
    return false
  }

  // Primero verificar el campo pesable del item
  if (item.pesable === true) {
    return true
  }

  // Si no está marcado como pesable, verificar la categoría del producto
  const categoria = item.producto?.categoria
  if (categoria) {
    const categoriaUpper = categoria.toUpperCase().trim()
    return categoriaUpper === 'BALANZA'
  }

  return false
}

export function calcularKgItem(presupuesto: any, item: any): number {
  if (!item) return 0
  const esMayorista = esVentaMayorista(presupuesto, item)
  const kgPorUnidadMayor = item.producto?.kg_por_unidad_mayor

  if (esMayorista && kgPorUnidadMayor) {
    const cant = item.cantidad_solicitada || 0
    const calculado = (item.peso_final ?? cant * kgPorUnidadMayor)
    return calculado
  }
  
  // Si es mayorista pero no tiene kg_por_unidad_mayor configurado, retornar cantidad solicitada
  if (esMayorista && !kgPorUnidadMayor) {
    return item.cantidad_solicitada || 0
  }

  if (item.pesable && item.peso_final) {
    return item.peso_final
  }
  return item.cantidad_solicitada || 0
}

export async function obtenerPresupuestosDiaAction(fecha: string, zonaId?: string, turno?: string) {
  const supabase = await createClient()
  const presupuestoSelect = `
    *,
    cliente:clientes(nombre, telefono),
    zona:zonas(nombre),
    lista_precio:listas_precios(tipo),
    items:presupuesto_items(
      id,
      cantidad_solicitada,
      cantidad_reservada,
      pesable,
      peso_final,
      producto:productos(nombre, codigo, categoria, venta_mayor_habilitada, unidad_medida, kg_por_unidad_mayor, unidad_mayor_nombre),
      lista_precio:listas_precios(tipo)
    )
  `

  // Obtener zonas para el filtro
  const { data: zonas } = await supabase
    .from('zonas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // Construir query con filtros
  let query = supabase
    .from('presupuestos')
    .select(presupuestoSelect)
    .eq('estado', 'en_almacen')
    .eq('fecha_entrega_estimada', fecha)

  if (zonaId) {
    query = query.eq('zona_id', zonaId)
  }

  if (turno) {
    query = query.eq('turno', turno)
  }

  const { data: presupuestos, error } = await query.order('fecha_entrega_estimada', { ascending: true })

  // #region agent log
  // Log para verificar datos obtenidos de la BD
  if (presupuestos && presupuestos.length > 0) {
    const primerPresupuesto = presupuestos[0]
    const primerItem = primerPresupuesto?.items?.[0]
    fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'presupuestos-dia.actions.ts:94',
        message: 'Datos obtenidos de BD después de query',
        data: {
          totalPresupuestos: presupuestos.length,
          primerPresupuestoId: primerPresupuesto?.id,
          primerItemId: primerItem?.id,
          primerItemTieneProducto: !!primerItem?.producto,
          primerItemProductoNombre: primerItem?.producto?.nombre,
          primerItemProductoCodigo: primerItem?.producto?.codigo,
          primerItemProductoEstructura: primerItem?.producto ? Object.keys(primerItem.producto) : null,
          primerItemEstructura: primerItem ? Object.keys(primerItem) : null,
          querySelect: presupuestoSelect,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'D',
      }),
    }).catch(() => {})
  }
  // #endregion

  if (error) {
    console.error('Error obteniendo presupuestos:', error)
    throw error
  }

  // Obtener resumen del día completo (sin filtros)
  const { data: presupuestosDiaData, error: presupuestosDiaError } = await supabase
    .from('presupuestos')
    .select(presupuestoSelect)
    .eq('estado', 'en_almacen')
    .eq('fecha_entrega_estimada', fecha)
    .order('fecha_entrega_estimada', { ascending: true })

  if (presupuestosDiaError) {
    console.error('Error obteniendo resumen del día:', presupuestosDiaError)
  }

  // Calcular estadísticas del día
  const presupuestosDelDia = presupuestosDiaData || []

  const totalPresupuestosDia = presupuestosDelDia.length
  const totalKgDia = presupuestosDelDia.reduce(
    (acc, presupuesto) =>
      acc + (presupuesto.items?.reduce((sum: number, item: any) => sum + calcularKgItem(presupuesto, item), 0) || 0),
    0,
  ) || 0

  const totalItemsPesablesPendientesDia =
    presupuestosDelDia.reduce(
      (acc, presupuesto) =>
        acc + (presupuesto.items?.filter((item: any) => esItemPesable(item, esVentaMayorista(presupuesto, item)) && !item.peso_final).length || 0),
      0,
    ) || 0

  const resumenPorZona = Object.values(
    (presupuestosDelDia || []).reduce(
      (acc: Record<string, { nombre: string; totalKg: number; totalPresupuestos: number }>, presupuesto: any) => {
        const key = presupuesto.zona_id || 'sin-zona'
        if (!acc[key]) {
          acc[key] = {
            nombre: presupuesto.zona?.nombre || 'Sin zona',
            totalKg: 0,
            totalPresupuestos: 0,
          }
        }
        acc[key].totalPresupuestos += 1
        acc[key].totalKg += presupuesto.items?.reduce((sum: number, item: any) => sum + calcularKgItem(presupuesto, item), 0) || 0
        return acc
      },
      {},
    ),
  ).sort((a, b) => b.totalKg - a.totalKg)

  const resumenPorTurno = Object.values(
    (presupuestosDelDia || []).reduce(
      (acc: Record<string, { nombre: string; totalKg: number; totalPresupuestos: number }>, presupuesto: any) => {
        const key = presupuesto.turno || 'sin-turno'
        if (!acc[key]) {
          acc[key] = {
            nombre: presupuesto.turno ? presupuesto.turno : 'Sin turno',
            totalKg: 0,
            totalPresupuestos: 0,
          }
        }
        acc[key].totalPresupuestos += 1
        acc[key].totalKg += presupuesto.items?.reduce((sum: number, item: any) => sum + calcularKgItem(presupuesto, item), 0) || 0
        return acc
      },
      {},
    ),
  ).sort((a, b) => b.totalKg - a.totalKg)

  // Lista de preparación
  const listaPreparacion = Object.entries(
    (presupuestosDelDia || []).reduce(
      (
        acc: Record<
          string,
          {
            zona: string
            turno: string
            productos: Record<
              string,
              {
                nombre: string
                pesable: boolean
                totalCantidad: number
                presupuestosIds: Set<string>
              }
            >
            totalKgPesables: number
          }
        >,
        presupuesto: any,
      ) => {
        const coincideZona = !zonaId || presupuesto.zona_id === zonaId
        const coincideTurno = !turno || presupuesto.turno === turno

        if (!coincideZona || !coincideTurno) {
          return acc
        }

        const key = `${presupuesto.zona_id || 'sin-zona'}-${presupuesto.turno || 'sin-turno'}`
        if (!acc[key]) {
          acc[key] = {
            zona: presupuesto.zona?.nombre || 'Sin zona',
            turno: presupuesto.turno || 'Sin turno',
            productos: {},
            totalKgPesables: 0,
          }
        }

        ; (presupuesto.items || []).forEach((item: any) => {
          const productoKey = item.producto?.codigo || `${item.producto?.nombre || 'producto'}-${item.id}`
          const cantidad = calcularKgItem(presupuesto, item)

          const esMayorista = esVentaMayorista(presupuesto, item)
          if (esItemPesable(item, esMayorista)) {
            acc[key].totalKgPesables += cantidad
          }

          if (!acc[key].productos[productoKey]) {
            acc[key].productos[productoKey] = {
              nombre: item.producto?.nombre || 'Producto sin nombre',
              pesable: esItemPesable(item, esMayorista),
              totalCantidad: 0,
              presupuestosIds: new Set<string>(),
            }
          }

          acc[key].productos[productoKey].totalCantidad += cantidad
          acc[key].productos[productoKey].presupuestosIds.add(presupuesto.id)
        })

        return acc
      },
      {},
    ),
  ).map(([key, grupo]) => ({
    key,
    zona: grupo.zona,
    turno: grupo.turno,
    totalKgPesables: grupo.totalKgPesables,
    productos: Object.values(grupo.productos)
      .map((producto) => ({
        nombre: producto.nombre,
        pesable: producto.pesable,
        totalCantidad: producto.totalCantidad,
        presupuestos: producto.presupuestosIds.size,
      }))
      .sort((a, b) => b.totalCantidad - a.totalCantidad),
  }))

  // Obtener sugerencias de vehículos
  const { data: sugerenciasVehiculos } = await supabase.rpc('fn_asignar_vehiculos_por_peso', {
    p_fecha: fecha,
    p_zona_id: zonaId || null,
    p_turno: turno || null
  })

  const vehiculoIds = sugerenciasVehiculos?.map((s: any) => s.vehiculo_id).filter(Boolean) ?? []
  let vehiculosAsignados: Record<string, any> = {}

  if (vehiculoIds.length > 0) {
    const { data: vehiculosData } = await supabase
      .from('vehiculos')
      .select('id, patente, marca, modelo, capacidad_kg')
      .in('id', vehiculoIds)

    vehiculosAsignados = Object.fromEntries((vehiculosData || []).map((v: any) => [v.id, v]))
  }

  // Procesar asignaciones de vehículos
  const asignacionesVehiculoMap: Record<string, {
    vehiculo: any | null
    peso_total: number
    capacidad_restante: number
    presupuestos: Array<{ id: string; numero: string; peso_estimado: number }>
  }> = {}

  const asignacionPorPresupuesto = new Map<string, {
    vehiculo: any | null
    peso_estimado: number
    capacidad_restante: number
  }>()

  ; (sugerenciasVehiculos || []).forEach((sugerencia: any) => {
    if (!sugerencia?.vehiculo_id || !sugerencia?.presupuesto_id) {
      return
    }

    const vehiculo = vehiculosAsignados[sugerencia.vehiculo_id] || null
    const pesoEstimado = Number(sugerencia.peso_estimado) || 0
    const capacidadRestante = Number(sugerencia.capacidad_restante ?? (vehiculo?.capacidad_kg || 0))
    const vehiculoKey = sugerencia.vehiculo_id

    if (!asignacionesVehiculoMap[vehiculoKey]) {
      asignacionesVehiculoMap[vehiculoKey] = {
        vehiculo,
        peso_total: 0,
        capacidad_restante: capacidadRestante,
        presupuestos: [],
      }
    }

    asignacionesVehiculoMap[vehiculoKey].peso_total += pesoEstimado
    asignacionesVehiculoMap[vehiculoKey].capacidad_restante = capacidadRestante

    const presupuestoInfo = presupuestos?.find(p => p.id === sugerencia.presupuesto_id)
    if (presupuestoInfo) {
      asignacionesVehiculoMap[vehiculoKey].presupuestos.push({
        id: sugerencia.presupuesto_id,
        numero: presupuestoInfo.numero_presupuesto,
        peso_estimado: pesoEstimado,
      })
    }

    asignacionPorPresupuesto.set(sugerencia.presupuesto_id, {
      vehiculo,
      peso_estimado: pesoEstimado,
      capacidad_restante: capacidadRestante,
    })
  })

  const asignacionesResumen = Object.values(asignacionesVehiculoMap)

  // Agrupar por zona y turno
  const presupuestosPorZonaTurno = presupuestos?.reduce((acc: any, p: any) => {
    const key = `${p.zona_id || 'sin-zona'}-${p.turno || 'sin-turno'}`
    if (!acc[key]) {
      acc[key] = {
        zona: p.zona,
        turno: p.turno,
        presupuestos: [],
        totalKg: 0,
      }
    }
    acc[key].presupuestos.push(p)
    acc[key].totalKg += p.items?.reduce((sum: number, item: any) =>
      sum + calcularKgItem(p, item), 0) || 0
    return acc
  }, {}) || {}

  // Calcular estadísticas
  const totalPresupuestos = presupuestos?.length || 0
  const totalItemsPesables = presupuestos?.reduce((acc, p) =>
    acc + (p.items?.filter((item: any) => item.pesable && !item.peso_final).length || 0), 0
  ) || 0
  const totalKgEstimados = presupuestos?.reduce((acc, p) =>
    acc + (p.items?.reduce((sum: number, item: any) =>
      sum + calcularKgItem(p, item), 0) || 0), 0
  ) || 0

  return {
    zonas: zonas || [],
    presupuestos: presupuestos || [],
    resumenDia: {
      totalPresupuestosDia,
      totalKgDia,
      totalItemsPesablesPendientesDia,
      resumenPorZona,
      resumenPorTurno,
    },
    listaPreparacion,
    asignacionesResumen,
    asignacionPorPresupuesto,
    presupuestosPorZonaTurno,
    estadisticas: {
      totalPresupuestos,
      totalItemsPesables,
      totalKgEstimados,
    },
  }
}
