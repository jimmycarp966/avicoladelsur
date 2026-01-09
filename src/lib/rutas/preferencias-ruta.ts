/**
 * Preferencias de Ruta del Repartidor
 * 
 * Sistema que aprende y guarda las preferencias de rutas del repartidor
 * (más corta vs más rápida vs sin autopista)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RutaAlternativa } from './google-directions'

export type TipoPreferencia = 'mas_corta' | 'mas_rapida' | 'sin_autopista' | 'ninguna'

export interface PreferenciaRuta {
    id: string
    repartidorId: string
    preferencia: TipoPreferencia
    conteo: number
    updatedAt: string
}

/**
 * Determina el tipo de preferencia basado en la ruta seleccionada
 */
export function determinarTipoPreferencia(
    rutaSeleccionada: RutaAlternativa,
    todasLasRutas: RutaAlternativa[]
): TipoPreferencia {
    if (todasLasRutas.length <= 1) {
        return 'ninguna'
    }

    // Encontrar la ruta más corta y la más rápida
    const masCortaDistancia = Math.min(...todasLasRutas.map(r => r.distancia))
    const masRapidaDuracion = Math.min(...todasLasRutas.map(r => r.duracion))

    const esMasCorta = rutaSeleccionada.distancia === masCortaDistancia
    const esMasRapida = rutaSeleccionada.duracion === masRapidaDuracion

    // Si la ruta seleccionada es más corta pero NO más rápida → prefiere distancia
    if (esMasCorta && !esMasRapida) {
        return 'mas_corta'
    }

    // Si la ruta seleccionada es más rápida pero NO más corta → prefiere tiempo
    if (esMasRapida && !esMasCorta) {
        return 'mas_rapida'
    }

    // Si evita autopista (la ruta más larga en km pero similar en tiempo)
    const rutasMasLargas = todasLasRutas.filter(r => r.distancia > masCortaDistancia)
    if (rutasMasLargas.some(r => r.polyline === rutaSeleccionada.polyline)) {
        // Verificar si el resumen sugiere evitar autopista
        const resumenLower = rutaSeleccionada.resumen.toLowerCase()
        if (!resumenLower.includes('autopista') && !resumenLower.includes('ruta')) {
            return 'sin_autopista'
        }
    }

    return 'ninguna'
}

/**
 * Registra la preferencia del repartidor
 */
export async function registrarPreferencia(
    supabase: SupabaseClient,
    repartidorId: string,
    rutaSeleccionada: RutaAlternativa,
    todasLasRutas: RutaAlternativa[]
): Promise<void> {
    const tipoPreferencia = determinarTipoPreferencia(rutaSeleccionada, todasLasRutas)

    if (tipoPreferencia === 'ninguna') {
        return // No registrar si no hay preferencia clara
    }

    console.log(`[PreferenciasRuta] Repartidor ${repartidorId} prefiere: ${tipoPreferencia}`)

    // Upsert: incrementar conteo si existe, crear si no
    const { error } = await supabase
        .rpc('fn_registrar_preferencia_ruta', {
            p_repartidor_id: repartidorId,
            p_preferencia: tipoPreferencia
        })

    if (error) {
        console.error('[PreferenciasRuta] Error al registrar:', error)
    }
}

/**
 * Obtiene la preferencia dominante del repartidor
 */
export async function obtenerPreferenciaDominante(
    supabase: SupabaseClient,
    repartidorId: string
): Promise<TipoPreferencia> {
    const { data, error } = await supabase
        .from('preferencias_rutas_repartidor')
        .select('preferencia, conteo')
        .eq('repartidor_id', repartidorId)
        .order('conteo', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error || !data) {
        return 'mas_rapida' // Default: más rápida (lo que sugiere Google)
    }

    // Solo considerar como preferencia dominante si tiene al menos 3 registros
    if (data.conteo >= 3) {
        return data.preferencia as TipoPreferencia
    }

    return 'mas_rapida'
}

/**
 * Marca la ruta preferida según las preferencias del repartidor
 */
export function marcarRutaPreferida(
    rutas: RutaAlternativa[],
    preferencia: TipoPreferencia
): RutaAlternativa[] {
    if (rutas.length === 0) return rutas

    // Reset todas las preferencias
    const rutasConPreferencia = rutas.map(r => ({ ...r, esPreferida: false }))

    let indexPreferida = 0

    switch (preferencia) {
        case 'mas_corta':
            // Encontrar la de menor distancia
            indexPreferida = rutasConPreferencia.reduce((minIdx, r, idx, arr) =>
                r.distancia < arr[minIdx].distancia ? idx : minIdx, 0)
            break

        case 'mas_rapida':
            // Encontrar la de menor duración
            indexPreferida = rutasConPreferencia.reduce((minIdx, r, idx, arr) =>
                r.duracion < arr[minIdx].duracion ? idx : minIdx, 0)
            break

        case 'sin_autopista':
            // Encontrar la que NO tiene "autopista" o "ruta" en el resumen
            const sinAutopista = rutasConPreferencia.findIndex(r => {
                const resumen = r.resumen.toLowerCase()
                return !resumen.includes('autopista') && !resumen.includes('ruta')
            })
            if (sinAutopista >= 0) {
                indexPreferida = sinAutopista
            }
            break

        default:
            // Usar la primera (default de Google)
            indexPreferida = 0
    }

    rutasConPreferencia[indexPreferida].esPreferida = true

    console.log(`[PreferenciasRuta] Preferencia "${preferencia}" → Ruta ${indexPreferida + 1}: ${rutasConPreferencia[indexPreferida].resumen}`)

    return rutasConPreferencia
}
