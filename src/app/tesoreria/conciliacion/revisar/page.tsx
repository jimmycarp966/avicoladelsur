import { createClient } from '@/lib/supabase/server'
import { RevisarView } from '../components/revisar-view'
import { encontrarMejorMatch } from '@/lib/conciliacion/motor-conciliacion'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Revisión Masiva | Conciliación',
}

export default async function RevisarPage() {
    const supabase = await createClient()

    // 1. Movimientos pendientes
    const { data: movimientos } = await supabase
        .from('movimientos_bancarios')
        .select('*')
        .eq('estado_conciliacion', 'pendiente')
        .order('fecha', { ascending: false })
        .limit(100) // Limitar para performance

    // 2. Pagos pendientes (Candidatos)
    const { data: pagos } = await supabase
        .from('pagos_esperados')
        .select(`
      *,
      cliente:clientes(nombre, cuit)
    `)
        .eq('estado', 'pendiente')

    // 3. Generar sugerencias en servidor
    const movimientosConSugerencias = movimientos?.map(mov => {
        const match = encontrarMejorMatch(mov as any, pagos as any || [])
        return {
            movimiento: mov,
            match: match ? {
                ...match,
                pago: pagos?.find(p => p.id === match.pagoId)
            } : null
        }
    }) || []

    return (
        <div className="container mx-auto p-6">
            <RevisarView movimientos={movimientosConSugerencias} />
        </div>
    )
}
