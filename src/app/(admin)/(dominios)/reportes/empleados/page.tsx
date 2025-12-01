import { subDays, format } from 'date-fns'
import { getTodayArgentina } from '@/lib/utils'
import { obtenerKpisEmpleados, obtenerEficienciaRepartidores } from '@/actions/reportes-empleados.actions'
import { createClient } from '@/lib/supabase/server'
import { ReporteEmpleadosContent } from './reporte-empleados-content'

export const revalidate = 3600 // Revalida cada hora

export default async function ReporteEmpleadosPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Filtros por defecto (últimos 30 días)
  const fechaHasta = (searchParams.fechaHasta as string) || getTodayArgentina()
  const fechaDesde =
    (searchParams.fechaDesde as string) || format(subDays(new Date(fechaHasta), 29), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
    sector: (searchParams.sector as string) || null,
  }

  const supabase = await createClient()

  // Obtener datos de reportes
  const [kpisResult, eficienciaResult, mapaZonasResult] = await Promise.all([
    obtenerKpisEmpleados(filtros),
    obtenerEficienciaRepartidores(filtros),
    // Obtener datos para mapa (zonas atendidas por repartidores)
    supabase
      .from('rutas_reparto')
      .select(`
        zona_id,
        zonas!inner(nombre),
        repartidor_id,
        usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido)
      `)
      .gte('fecha_ruta', filtros.fechaDesde)
      .lte('fecha_ruta', filtros.fechaHasta)
      .eq('estado', 'completada')
      .limit(1000),
  ])

  // Procesar datos para mapa
  const mapaZonas: any[] = []
  const zonasMap = new Map<string, { nombre: string; repartidores: Set<string> }>()
  
  mapaZonasResult.data?.forEach((ruta: any) => {
    const zonaId = ruta.zona_id
    const zonaNombre = ruta.zonas?.nombre || 'Sin zona'
    
    if (!zonasMap.has(zonaId)) {
      zonasMap.set(zonaId, {
        nombre: zonaNombre,
        repartidores: new Set(),
      })
    }
    
    const zona = zonasMap.get(zonaId)!
    if (ruta.repartidor_id) {
      zona.repartidores.add(ruta.repartidor_id)
    }
  })
  
  const coords: Record<string, [number, number]> = {
    'Monteros': [-27.1667, -65.4833],
    'Famaillá': [-27.05, -65.4],
    'Tafi del valle': [-26.85, -65.7],
  }
  
  zonasMap.forEach((zona) => {
    const [lat, lng] = coords[zona.nombre] || [-26.8083, -65.2176]
    mapaZonas.push({
      zona: zona.nombre,
      lat,
      lng,
      valor: zona.repartidores.size,
      label: `${zona.repartidores.size} repartidores`,
    })
  })

  return (
    <ReporteEmpleadosContent
      kpis={kpisResult.data}
      eficiencia={eficienciaResult.data || []}
      mapaZonas={mapaZonas}
      filtrosIniciales={filtros}
    />
  )
}

