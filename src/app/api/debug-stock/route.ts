import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Obtener todas las sucursales
        const { data: sucursales, error: sucursalesError } = await supabase
            .from('sucursales')
            .select('id, nombre')
            .eq('active', true)

        if (sucursalesError) throw sucursalesError

        // Obtener lotes por sucursal
        const stockPorSucursal = []

        for (const sucursal of sucursales || []) {
            const { data: lotes, error: lotesError } = await supabase
                .from('lotes')
                .select(`
                    id,
                    cantidad_disponible,
                    estado,
                    producto:productos(id, nombre, codigo, unidad_medida)
                `)
                .eq('sucursal_id', sucursal.id)
                .eq('estado', 'disponible')
                .gt('cantidad_disponible', 0)

            stockPorSucursal.push({
                sucursal: sucursal.nombre,
                sucursal_id: sucursal.id,
                lotes: lotes || [],
                totalProductos: (lotes || []).length
            })
        }

        // Obtener productos sin sucursal asignada
        const { data: productosCentral, error: productosError } = await supabase
            .from('productos')
            .select('id, nombre, codigo, is_central_catalog')
            .eq('is_central_catalog', true)
            .limit(10)

        return NextResponse.json({
            success: true,
            data: {
                stockPorSucursal,
                productosCentral: productosCentral || [],
                resumen: {
                    totalSucursales: sucursales?.length || 0,
                    sucursalesConStock: stockPorSucursal.filter(s => s.totalProductos > 0).length,
                    sucursalesSinStock: stockPorSucursal.filter(s => s.totalProductos === 0).length
                }
            }
        })

    } catch (error: any) {
        console.error('Error en debug-stock:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
