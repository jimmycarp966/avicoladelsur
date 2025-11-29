/**
 * DELETE /api/reparto/limpiar-mock
 * 
 * Limpia todos los datos mock del sistema
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

        // Eliminar en orden por dependencias
        await supabase.from('ubicaciones_repartidores').delete().ilike('id', '%')
        await supabase.from('detalles_ruta').delete().ilike('id', '%')
        await supabase.from('rutas_planificadas').delete().ilike('id', '%')
        await supabase.from('pedidos').delete().ilike('numero_pedido', '%MOCK%')
        await supabase.from('rutas_reparto').delete().ilike('numero_ruta', '%MOCK%')
        await supabase.from('clientes').delete().ilike('nombre', '%Mock%')
        await supabase.from('vehiculos').delete().ilike('patente', 'MOCK%')
        await supabase.from('usuarios').delete().ilike('email', '%mock%')

        return NextResponse.json({
            success: true,
            message: 'Datos mock eliminados exitosamente'
        })
    } catch (error: any) {
        console.error('Error limpiando mock:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
