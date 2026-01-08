import { createClient } from '@/lib/supabase/server'
import { ConciliacionDashboard } from './components/conciliacion-dashboard'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Conciliación Bancaria | Avícola del Sur',
    description: 'Sistema de conciliación bancaria inteligente',
}

export default async function ConciliacionPage() {
    const supabase = await createClient()

    // 1. Obtener movimientos pendientes
    const { data: movimientos } = await supabase
        .from('movimientos_bancarios')
        .select(`
      *,
      cuenta:cuentas_bancarias(nombre, banco)
    `)
        .eq('estado_conciliacion', 'pendiente')
        .order('fecha', { ascending: false })

    // 2. Obtener pagos esperados pendientes
    const { data: pagos } = await supabase
        .from('pagos_esperados')
        .select(`
      *,
      cliente:clientes(nombre, cuit),
      pedido:pedidos(numero_pedido, total)
    `)
        .eq('estado', 'pendiente')
        .order('fecha_esperada', { ascending: true })

    // 3. Obtener estadisticas básicas (hoy/mes)
    // Auto-conciliados
    const { count: autoConciliados } = await supabase
        .from('conciliaciones')
        .select('*', { count: 'exact', head: true })
        .eq('tipo_match', 'automatico')

    // Pendientes
    const pendientesCount = movimientos?.length || 0

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Conciliación Bancaria</h1>
            </div>

            <ConciliacionDashboard
                initialMovimientos={movimientos || []}
                initialPagos={pagos || []}
                stats={{
                    autoConciliados: autoConciliados || 0,
                    pendientes: pendientesCount
                }}
            />
        </div>
    )
}
