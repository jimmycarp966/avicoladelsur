import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()

        console.log('🔄 Asignando 1000 unidades a TODOS los productos existentes...')

        // Obtener TODOS los productos existentes
        const { data: productos, error: productosError } = await supabase
            .from('productos')
            .select('id, nombre, codigo')

        if (productosError) {
            return NextResponse.json({
                success: false,
                error: 'Error obteniendo productos: ' + productosError.message
            }, { status: 500 })
        }

        if (!productos || productos.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No hay productos en el sistema'
            }, { status: 400 })
        }

        console.log(`📦 Procesando ${productos.length} productos...`)

        // Método directo: usar SQL para crear stock masivamente
        console.log('🔧 Usando SQL directo para crear stock...')

        try {
            // Crear sucursal temporal usando SQL directo
            const { error: sqlSucursalError } = await supabase.rpc('exec_sql', {
                sql: `
                    INSERT INTO sucursales (id, nombre, direccion, telefono, active)
                    VALUES ('dev-sucursal-temp', 'Sucursal Desarrollo Temporal', 'Temporal', '000-000-000', true)
                    ON CONFLICT (id) DO NOTHING;
                `
            })

            if (sqlSucursalError) {
                console.log('⚠️ Error creando sucursal:', sqlSucursalError.message)
            }

            // Crear stock usando SQL directo para todos los productos
            const valoresLotes = productos.map(producto =>
                `('${producto.id}', 'dev-sucursal-temp', 1000, 1000, 1.0, 1.0, 'disponible', '${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}', 'DEV-${Date.now()}-${producto.id.substring(0, 4)}', 'Stock desarrollo 1000 unidades')`
            ).join(',\n')

            const sqlLotes = `
                INSERT INTO lotes (
                    producto_id, sucursal_id, cantidad_ingresada, cantidad_disponible,
                    precio_costo_unitario, precio_venta_sugerido, estado,
                    fecha_vencimiento, numero_lote, observaciones
                ) VALUES ${valoresLotes}
                ON CONFLICT (numero_lote) DO NOTHING;
            `

            const { error: sqlLotesError } = await supabase.rpc('exec_sql', {
                sql: sqlLotes
            })

            if (sqlLotesError) {
                console.log('⚠️ Error con SQL masivo:', sqlLotesError.message)

                // Método alternativo: procesar uno por uno
                console.log('🔄 Procesando uno por uno...')
                let procesados = 0
                for (const producto of productos.slice(0, 50)) { // Máximo 50 para evitar timeouts
                    try {
                        const sqlIndividual = `
                            INSERT INTO lotes (
                                producto_id, sucursal_id, cantidad_ingresada, cantidad_disponible,
                                precio_costo_unitario, precio_venta_sugerido, estado,
                                fecha_vencimiento, numero_lote, observaciones
                            ) VALUES (
                                '${producto.id}', 'dev-sucursal-temp', 1000, 1000, 1.0, 1.0, 'disponible',
                                '${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}',
                                'DEV-${Date.now()}-${producto.id.substring(0, 4)}',
                                'Stock desarrollo 1000 unidades'
                            )
                            ON CONFLICT (numero_lote) DO NOTHING;
                        `

                        const { error: individualError } = await supabase.rpc('exec_sql', {
                            sql: sqlIndividual
                        })

                        if (!individualError) {
                            procesados++
                        }
                    } catch (error) {
                        // Ignorar errores individuales
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: `¡Parcialmente completado! ${procesados} productos tienen 1000 unidades`,
                    data: {
                        productos_total: productos.length,
                        productos_procesados: procesados,
                        unidades_totales: procesados * 1000,
                        metodo: 'sql_individual'
                    }
                })

            } else {
                return NextResponse.json({
                    success: true,
                    message: `¡ÉXITO TOTAL! Todos los ${productos.length} productos tienen 1000 unidades`,
                    data: {
                        productos_total: productos.length,
                        productos_procesados: productos.length,
                        unidades_totales: productos.length * 1000,
                        metodo: 'sql_masivo'
                    }
                })
            }

        } catch (sqlError) {
            console.log('❌ Error con SQL:', sqlError)

            // Último recurso: simular stock (no real)
            return NextResponse.json({
                success: false,
                message: 'No se pudo crear stock real. Usa datos de prueba.',
                data: {
                    productos_total: productos.length,
                    productos_procesados: 0,
                    unidades_totales: 0,
                    sugerencia: 'Ejecuta /diagnostico-stock y usa "Crear Datos de Prueba"'
                }
            })
        }

    } catch (error: any) {
        console.error('❌ Error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
