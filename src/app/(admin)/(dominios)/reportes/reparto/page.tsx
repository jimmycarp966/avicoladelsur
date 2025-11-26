import { subDays, format } from 'date-fns'
import { getTodayArgentina } from '@/lib/utils'
import { obtenerKpisReparto, obtenerRankingRepartidores } from '@/actions/reportes-reparto.actions'
import { createClient } from '@/lib/supabase/server'
import { ReporteRepartoContent } from './reporte-reparto-content'

export const dynamic = 'force-dynamic'

export default async function ReporteRepartoPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = await createClient()

  // Obtener datos para filtros
  const [zonasResult, vehiculosResult] = await Promise.all([
    supabase.from('zonas').select('id, nombre').order('nombre'),
    supabase.from('vehiculos').select('id, patente, modelo').eq('activo', true).order('patente'),
  ])

  const zonas = zonasResult.data || []
  const vehiculos = vehiculosResult.data || []

  // Filtros por defecto (últimos 30 días)
  const fechaHasta = (searchParams.fechaHasta as string) || getTodayArgentina()
  const fechaDesde =
    (searchParams.fechaDesde as string) || format(subDays(new Date(fechaHasta), 29), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
    zonaId: (searchParams.zonaId as string) || null,
    vehiculoId: (searchParams.vehiculoId as string) || null,
  }

  // Obtener datos de reportes
  const [kpisResult, rankingResult, mapaZonasResult] = await Promise.all([
    obtenerKpisReparto(filtros),
    obtenerRankingRepartidores(filtros),
    // Obtener datos para mapa (entregas por zona con coordenadas aproximadas)
    supabase
      .from('rutas_reparto')
      .select(`
        zona_id,
        zonas!inner(nombre),
        detalles_ruta!inner(
          pedido:pedidos!inner(
            cliente:clientes!inner(coordenadas)
          )
        )
      `)
      .gte('fecha_ruta', fechaDesde)
      .lte('fecha_ruta', fechaHasta)
      .eq('estado', 'completada')
      .limit(1000),
  ])

  // Procesar datos para mapa
  const mapaZonas: any[] = []
  const zonasMap = new Map<string, { nombre: string; entregas: number; lat: number; lng: number }>()
  
  mapaZonasResult.data?.forEach((ruta: any) => {
    const zonaId = ruta.zona_id
    const zonaNombre = ruta.zonas?.nombre || 'Sin zona'
    
    if (!zonasMap.has(zonaId)) {
      // Coordenadas aproximadas por zona (centro de Tucumán por defecto)
      const coords: Record<string, [number, number]> = {
        'Monteros': [-27.1667, -65.4833],
        'Famaillá': [-27.05, -65.4],
        'Tafi del valle': [-26.85, -65.7],
      }
      const [lat, lng] = coords[zonaNombre] || [-26.8083, -65.2176]
      
      zonasMap.set(zonaId, {
        nombre: zonaNombre,
        entregas: 0,
        lat,
        lng,
      })
    }
    
    const zona = zonasMap.get(zonaId)!
    zona.entregas += ruta.detalles_ruta?.length || 0
  })
  
  zonasMap.forEach((zona) => {
    mapaZonas.push({
      zona: zona.nombre,
      lat: zona.lat,
      lng: zona.lng,
      valor: zona.entregas,
      label: `${zona.entregas} entregas`,
    })
  })

  return (
    <ReporteRepartoContent
      kpis={kpisResult.data}
      ranking={rankingResult.data || []}
      mapaZonas={mapaZonas}
      zonas={zonas}
      vehiculos={vehiculos}
      filtrosIniciales={filtros}
    />
  )
}

