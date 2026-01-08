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
}

/**
 * Busca un cliente por DNI/CUIT normalizado.
 * Busca en campos: cuit, dni, documento de la tabla clientes.
 * 
 * @param dniCuit - DNI o CUIT a buscar (con o sin guiones)
 * @returns Cliente encontrado o null
 */
export async function buscarClientePorDNI(dniCuit: string): Promise<ClienteEncontrado | null> {
    if (!dniCuit) return null

    // Normalizar: quitar todo excepto números
    const dniNormalizado = dniCuit.replace(/\D/g, '')

    if (dniNormalizado.length < 7 || dniNormalizado.length > 11) {
        return null // DNI/CUIT inválido
    }

    const supabase = await createClient()

    // Buscar en la tabla clientes
    // Intentamos buscar por cuit exacto primero, luego por variantes
    const { data: cliente, error } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, cuit, telefono, email, direccion, sucursal_id')
        .or(`cuit.eq.${dniNormalizado},cuit.ilike.%${dniNormalizado}%`)
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('Error buscando cliente por DNI:', error)
        return null
    }

    if (!cliente) {
        // Intentar buscar con formato CUIT (XX-XXXXXXXX-X)
        if (dniNormalizado.length === 11) {
            const cuitFormateado = `${dniNormalizado.slice(0, 2)}-${dniNormalizado.slice(2, 10)}-${dniNormalizado.slice(10)}`

            const { data: clienteCuit } = await supabase
                .from('clientes')
                .select('id, nombre, apellido, cuit, telefono, email, direccion, sucursal_id')
                .eq('cuit', cuitFormateado)
                .limit(1)
                .maybeSingle()

            if (clienteCuit) {
                return {
                    id: clienteCuit.id,
                    nombre: `${clienteCuit.nombre || ''} ${clienteCuit.apellido || ''}`.trim(),
                    cuit: clienteCuit.cuit,
                    telefono: clienteCuit.telefono,
                    email: clienteCuit.email,
                    direccion: clienteCuit.direccion,
                    sucursal_id: clienteCuit.sucursal_id
                }
            }
        }
        return null
    }

    return {
        id: cliente.id,
        nombre: `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim(),
        cuit: cliente.cuit,
        telefono: cliente.telefono,
        email: cliente.email,
        direccion: cliente.direccion,
        sucursal_id: cliente.sucursal_id
    }
}

/**
 * Busca múltiples clientes por DNI/CUIT en batch.
 * Optimizado para evitar múltiples queries.
 * 
 * @param dnisCuits - Array de DNI/CUIT a buscar
 * @returns Mapa de DNI normalizado -> Cliente encontrado
 */
export async function buscarClientesPorDNIBatch(
    dnisCuits: string[]
): Promise<Map<string, ClienteEncontrado>> {
    const resultado = new Map<string, ClienteEncontrado>()

    // Normalizar y filtrar DNIs válidos
    const dnisUnicos = [...new Set(
        dnisCuits
            .map(d => d.replace(/\D/g, ''))
            .filter(d => d.length >= 7 && d.length <= 11)
    )]

    if (dnisUnicos.length === 0) return resultado

    const supabase = await createClient()

    // Buscar todos de una vez usando or
    const condiciones = dnisUnicos.map(dni => `cuit.ilike.%${dni}%`).join(',')

    const { data: clientes, error } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, cuit, telefono, email, direccion, sucursal_id')
        .or(condiciones)

    if (error) {
        console.error('Error buscando clientes en batch:', error)
        return resultado
    }

    // Mapear resultados
    for (const cliente of clientes || []) {
        const cuitNormalizado = cliente.cuit?.replace(/\D/g, '') || ''

        if (cuitNormalizado) {
            resultado.set(cuitNormalizado, {
                id: cliente.id,
                nombre: `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim(),
                cuit: cliente.cuit,
                telefono: cliente.telefono,
                email: cliente.email,
                direccion: cliente.direccion,
                sucursal_id: cliente.sucursal_id
            })
        }
    }

    return resultado
}
