import { createClient } from '@/lib/supabase/server'

/**
 * Representa un cliente encontrado por DNI/CUIT
 */
export interface ClienteEncontrado {
    id: string
    nombre: string
    cuit?: string
    telefono?: string
    email?: string
    direccion?: string
    sucursal_id?: string
    nombre_match_adicional?: string // Nombre del tercero/alias para matching
}

// ... (omitiendo buscarClientePorDNI para brevedad, no lo tocamos aquí o asumimos que solo importa el batch) ...

export async function buscarClientesPorDNIBatch(
    dnisCuits: string[]
): Promise<Map<string, ClienteEncontrado>> {
    console.log('[ClienteLookup] ========== buscarClientesPorDNIBatch ==========');
    console.log(`[ClienteLookup] Recibidos ${dnisCuits.length} DNI/CUITs para búsqueda en batch.`);
    const resultado = new Map<string, ClienteEncontrado>()

    // Normalizar y filtrar DNIs válidos
    const dnisUnicos = [...new Set(
        dnisCuits
            .map(d => d.replace(/\D/g, ''))
            .filter(d => d.length >= 7 && d.length <= 11)
    )]
    console.log(`[ClienteLookup] DNIs/CUITs únicos y normalizados a buscar (${dnisUnicos.length}):`, dnisUnicos);

    if (dnisUnicos.length === 0) {
        console.warn('[ClienteLookup] No hay DNIs/CUITs válidos para buscar en batch. Retornando mapa vacío.');
        return resultado
    }

    const supabase = await createClient()
    console.log('[ClienteLookup] Cliente Supabase creado para batch.');

    // 1. Buscar en tabla PRINCIPAL (clientes)
    // Generar variantes con y sin guiones para mejorar el match
    const terminosBusqueda = new Set<string>()
    dnisUnicos.forEach(dni => {
        terminosBusqueda.add(dni) // Plano
        if (dni.length === 11) {
            // Formato XX-XXXXXXXX-X
            terminosBusqueda.add(`${dni.slice(0, 2)}-${dni.slice(2, 10)}-${dni.slice(10, 11)}`)
        }
    })

    // Convertir a array para generar query
    const terminosArray = Array.from(terminosBusqueda)
    console.log(`[ClienteLookup] Términos de búsqueda generados (variantes):`, terminosArray);

    const condiciones = terminosArray.map(t => `cuit.ilike.%${t}%`).join(',')
    console.log(`[ClienteLookup] Condición 'or' generada para clientes (longitud query aprox): ${condiciones.length}`);

    const { data: clientes, error } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, cuit, telefono, email, direccion, sucursal_id')
        .or(condiciones)

    if (error) {
        console.error('[ClienteLookup] Error buscando clientes en batch:', error)
    } else {
        console.log(`[ClienteLookup] Clientes encontrados en BD principal: ${clientes?.length || 0}`);
        for (const cliente of clientes || []) {
            const cuitNormalizado = cliente.cuit?.replace(/\D/g, '') || ''
            if (cuitNormalizado && dnisUnicos.includes(cuitNormalizado)) {
                resultado.set(cuitNormalizado, {
                    id: cliente.id,
                    nombre: `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim(),
                    cuit: cliente.cuit,
                    telefono: cliente.telefono,
                    email: cliente.email,
                    direccion: cliente.direccion,
                    sucursal_id: cliente.sucursal_id
                })
                console.log(`[ClienteLookup] Cliente ${cliente.id} mapeado directo por DNI: ${cuitNormalizado}`);
            }
        }
    }

    // 2. Buscar en tabla ALIAS / ADICIONALES
    // Solo buscamos los que NO hayamos encontrado ya, o buscamos todos para enriquecer?
    // Mejor buscamos todos los dnisUnicos por si alguno es un alias.
    // Prioridad: Si ya encontramos un cliente directo por ese DNI, ¿vale la pena buscar alias?
    // Puede que DNI X sea cliente directo Y ADEMÁS sea alias de otro.
    // Asumiremos prioridad: Cliente Directo > Alias. Si ya está en mapa, no lo sobreescribimos.

    // Filtrar DNIs que faltan encontrar
    // const dnisFaltantes = dnisUnicos.filter(d => !resultado.has(d)) 
    // Por ahora buscamos TODOS los alias, por si acaso.

    try {
        // Usar los mismos términos (variantes) para buscar en alias
        const condicionesAlias = terminosArray.map(t => `dni_cuit.ilike.%${t}%`).join(',')
        console.log(`[ClienteLookup] Buscando en identificadores adicionales...`)

        const { data: aliasList, error: aliasError } = await supabase
            .from('clientes_identificadores_adicionales')
            .select(`
                dni_cuit,
                nombre_titular,
                cliente:clientes!inner (
                    id, nombre, apellido, cuit, telefono, email, direccion, sucursal_id
                )
            `)
            .or(condicionesAlias)

        if (aliasError) {
            console.error('[ClienteLookup] Error buscando alias:', aliasError)
        } else {
            console.log(`[ClienteLookup] Alias encontrados: ${aliasList?.length || 0}`)
            for (const alias of aliasList || []) {
                const dniAlias = alias.dni_cuit?.replace(/\D/g, '') || ''
                // Si este DNI estaba en nuestra lista de búsqueda Y no tenemos match principal aún
                if (dnisUnicos.includes(dniAlias) && !resultado.has(dniAlias) && alias.cliente) {
                    const c = alias.cliente as any // Casting simple
                    resultado.set(dniAlias, {
                        id: c.id,
                        nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim(),
                        cuit: c.cuit, // CUIT del cliente principal
                        telefono: c.telefono,
                        email: c.email,
                        direccion: c.direccion,
                        sucursal_id: c.sucursal_id,
                        nombre_match_adicional: alias.nombre_titular // Guardamos el nombre del ALIAS para el matching
                    })
                    console.log(`[ClienteLookup] DNI ${dniAlias} (Alias: ${alias.nombre_titular}) => Cliente Principal: ${c.nombre}`);
                }
            }
        }

    } catch (e) {
        console.error('[ClienteLookup] Excepción buscando alias:', e)
    }

    console.log(`[ClienteLookup] Total clientes mapeados FINAL: ${resultado.size}`);
    console.log('[ClienteLookup] ========== Fin buscarClientesPorDNIBatch ==========');
    return resultado
}
