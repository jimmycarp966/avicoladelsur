import { createClient } from '@/lib/supabase/server'
import { ImportarView } from '../components/importar-view'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Importar Movimientos | Conciliación',
}

export default async function ImportarPage() {
    const supabase = await createClient()

    const { data: cuentas } = await supabase
        .from('cuentas_bancarias')
        .select('id, banco, moneda')
        .eq('activo', true)

    return (
        <div className="container mx-auto p-6">
            <ImportarView cuentas={cuentas || []} />
        </div>
    )
}
