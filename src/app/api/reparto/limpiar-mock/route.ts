/**
 * DELETE /api/reparto/limpiar-mock
 * 
 * Limpia todos los datos mock del sistema
 * 
 * IMPORTANTE: Esta función puede tardar más de 10 segundos.
 * En Vercel, requiere plan Pro o superior para maxDuration > 10s
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Vercel Free (Hobby) tiene límite de 10 segundos
export const maxDuration = 10

export async function DELETE() {
    try {
        const supabase = await createClient()

        // Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
        }

        const { data: usuario } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', user.id)
            .single()

        if (!usuario || usuario.rol !== 'admin') {
            return NextResponse.json({ success: false, error: 'Solo admins pueden limpiar mock' }, { status: 403 })
        }

        // Eliminar en orden por dependencias y contar eliminados
        const eliminados = {
            ubicaciones_repartidores: 0,
            detalles_ruta: 0,
            rutas_planificadas: 0,
            pedidos: 0,
            rutas_reparto: 0,
            clientes: 0,
            vehiculos: 0,
            usuarios: 0
        }

        // Contar y eliminar ubicaciones_repartidores
        const { count: countUbicaciones } = await supabase
            .from('ubicaciones_repartidores')
            .select('*', { count: 'exact', head: true })
            .ilike('id', '%')
        eliminados.ubicaciones_repartidores = countUbicaciones || 0
        await supabase.from('ubicaciones_repartidores').delete().ilike('id', '%')

        // Contar y eliminar detalles_ruta
        const { count: countDetalles } = await supabase
            .from('detalles_ruta')
            .select('*', { count: 'exact', head: true })
            .ilike('id', '%')
        eliminados.detalles_ruta = countDetalles || 0
        await supabase.from('detalles_ruta').delete().ilike('id', '%')

        // Contar y eliminar rutas_planificadas
        const { count: countPlanificadas } = await supabase
            .from('rutas_planificadas')
            .select('*', { count: 'exact', head: true })
            .ilike('id', '%')
        eliminados.rutas_planificadas = countPlanificadas || 0
        await supabase.from('rutas_planificadas').delete().ilike('id', '%')

        // Contar y eliminar pedidos mock
        const { count: countPedidos } = await supabase
            .from('pedidos')
            .select('*', { count: 'exact', head: true })
            .ilike('numero_pedido', '%MOCK%')
        eliminados.pedidos = countPedidos || 0
        await supabase.from('pedidos').delete().ilike('numero_pedido', '%MOCK%')

        // Contar y eliminar rutas_reparto mock
        const { count: countRutas } = await supabase
            .from('rutas_reparto')
            .select('*', { count: 'exact', head: true })
            .ilike('numero_ruta', '%MOCK%')
        eliminados.rutas_reparto = countRutas || 0
        await supabase.from('rutas_reparto').delete().ilike('numero_ruta', '%MOCK%')

        // Contar y eliminar clientes mock
        const { count: countClientes } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true })
            .ilike('nombre', '%Mock%')
        eliminados.clientes = countClientes || 0
        await supabase.from('clientes').delete().ilike('nombre', '%Mock%')

        // Contar y eliminar vehiculos mock
        const { count: countVehiculos } = await supabase
            .from('vehiculos')
            .select('*', { count: 'exact', head: true })
            .ilike('patente', 'MOCK%')
        eliminados.vehiculos = countVehiculos || 0
        await supabase.from('vehiculos').delete().ilike('patente', 'MOCK%')

        // Contar y eliminar usuarios mock
        const { count: countUsuarios } = await supabase
            .from('usuarios')
            .select('*', { count: 'exact', head: true })
            .ilike('email', '%mock%')
        eliminados.usuarios = countUsuarios || 0
        await supabase.from('usuarios').delete().ilike('email', '%mock%')

        const totalEliminados = Object.values(eliminados).reduce((a: number, b: number) => a + b, 0)

        return NextResponse.json({
            success: true,
            message: `Se eliminaron ${totalEliminados} registros mock`,
            data: eliminados
        })
    } catch (error: any) {
        console.error('Error limpiando mock:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
