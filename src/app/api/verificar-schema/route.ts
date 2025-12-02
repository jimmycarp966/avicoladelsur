import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Verificar si hay lotes existentes para ver las columnas
        const { data: lotes, error } = await supabase
            .from('lotes')
            .select('*')
            .limit(1)

        let columnasDisponibles: string[] = []
        if (lotes && lotes.length > 0) {
            columnasDisponibles = Object.keys(lotes[0])
        } else {
            // Si no hay lotes, intentar inferir de un error de inserción
            const { error: testError } = await supabase
                .from('lotes')
                .insert({
                    producto_id: '00000000-0000-0000-0000-000000000000',
                    sucursal_id: '00000000-0000-0000-0000-000000000000',
                    cantidad_ingresada: 1,
                    cantidad_disponible: 1,
                    estado: 'disponible',
                    precio_costo_unitario: 1.0,
                    precio_venta_sugerido: 1.0,
                    fecha_vencimiento: new Date().toISOString(),
                    numero_lote: 'TEST-123'
                })

            if (testError) {
                console.log('Error de prueba:', testError.message)
            }
        }

        // Probar inserción con diferentes columnas para ver cuáles existen
        const pruebasColumnas = [
            'observaciones',
            'precio_costo_unitario',
            'precio_venta_sugerido',
            'fecha_vencimiento',
            'numero_lote'
        ]

        const resultadosPruebas: Record<string, string> = {}
        for (const columna of pruebasColumnas) {
            try {
                const testData: any = {
                    producto_id: '00000000-0000-0000-0000-000000000000',
                    sucursal_id: '00000000-0000-0000-0000-000000000000',
                    cantidad_ingresada: 1,
                    cantidad_disponible: 1,
                    estado: 'disponible'
                }
                testData[columna] = columna === 'fecha_vencimiento' ? new Date().toISOString() : 'test'

                const { error: testError } = await supabase
                    .from('lotes')
                    .insert(testData)

                resultadosPruebas[columna] = testError ? testError.message : 'EXISTS'
            } catch (e) {
                resultadosPruebas[columna] = 'ERROR'
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                columnas_disponibles: columnasDisponibles,
                ejemplo_lote: lotes?.[0] || null,
                insert_error: error?.message || null,
                columnas_probadas: [
                    'producto_id',
                    'sucursal_id',
                    'cantidad_ingresada',
                    'cantidad_disponible',
                    'estado'
                ]
            }
        })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
