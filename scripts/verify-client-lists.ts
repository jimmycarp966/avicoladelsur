
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const LISTA_MAYORISTA_ID = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

async function verifyMigration() {
    console.log('Verifying migration status...')

    // 1. Get total active clients
    const { count: totalClients, error: errTotal } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true)

    if (errTotal) {
        console.error('Error getting total clients:', errTotal)
        return
    }

    // 2. Get clients with Mayorista list assigned
    const { count: assignedClients, error: errAssigned } = await supabase
        .from('clientes_listas_precios')
        .select('*', { count: 'exact', head: true })
        .eq('lista_precio_id', LISTA_MAYORISTA_ID) // Fixed column name
        .eq('activa', true)

    if (errAssigned) {
        console.error('Error getting assigned clients:', errAssigned)
        return
    }

    console.log('Migration Status:')
    console.log(`Total Active Clients: ${totalClients}`)
    console.log(`Clients with Mayorista List: ${assignedClients}`)

    if (totalClients && assignedClients) {
        const remaining = totalClients - assignedClients
        console.log(`Remaining: ${remaining}`)

        if (remaining === 0) {
            console.log('✅ MIGRATION COMPLETE')
        } else {
            console.log('⏳ MIGRATION IN PROGRESS')
        }
    }
}

verifyMigration()
