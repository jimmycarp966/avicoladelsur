import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Obtener todos los productos
        const { data: productos, error } = await supabase
            .from('productos')
            .select('id, nombre, codigo, precio_venta, activo, is_central_catalog')
            .order('nombre')

        if (error) {
            return NextResponse.json({
                success: false,
                error: 'Error obteniendo productos: ' + error.message
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            data: {
                total: productos?.length || 0,
                productos: productos || []
            }
        })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
