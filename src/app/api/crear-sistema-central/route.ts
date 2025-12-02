import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()

        console.log('🔧 Creando Sistema Central (Almacén Central)...')

        // Usar RPC para crear el sistema central (esto debería funcionar mejor con RLS)
        const { data: result, error } = await supabase.rpc('fn_crear_sistema_central_setup')

        if (error) {
            console.error('Error en RPC:', error)

            // Fallback: intentar crear directamente
            console.log('Intentando creación directa...')

            const { data: sucursal, error: directError } = await supabase
                .from('sucursales')
                .insert({
                    id: '00000000-0000-0000-0000-000000000001',
                    nombre: 'Sistema Central',
                    direccion: 'Av. Mate de Luna 1234, San Miguel de Tucumán',
                    telefono: '381-555-0000',
                    active: true
                })
                .select()
                .single()

            if (directError) {
                console.error('Error en creación directa:', directError)
                throw directError
            }

            return NextResponse.json({
                success: true,
                message: 'Sistema Central creado (método directo)',
                data: sucursal
            })
        }

        console.log('✅ Sistema Central creado via RPC:', result)

        return NextResponse.json({
            success: true,
            message: 'Sistema Central creado exitosamente',
            data: result
        })

    } catch (error: any) {
        console.error('❌ Error creando Sistema Central:', error)

        // Último intento: crear desde SQL migration
        try {
            const supabase = await createClient()
            const { error: sqlError } = await supabase.rpc('exec_sql', {
                sql: `
                    INSERT INTO sucursales (id, nombre, direccion, telefono, active)
                    VALUES ('00000000-0000-0000-0000-000000000001', 'Sistema Central', 'Av. Mate de Luna 1234, San Miguel de Tucumán', '381-555-0000', true)
                    ON CONFLICT (id) DO NOTHING;
                `
            })

            if (!sqlError) {
                return NextResponse.json({
                    success: true,
                    message: 'Sistema Central creado via SQL',
                    data: { id: '00000000-0000-0000-0000-000000000001', nombre: 'Sistema Central' }
                })
            }
        } catch (sqlError) {
            console.error('Error en SQL fallback:', sqlError)
        }

        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
