
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const LISTA_MAYORISTA_ID = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

async function migrateClientesToMayorista() {
    console.log('Starting migration: Assigning Lista Mayorista to all clients...')

    // 1. Get all clients
    const { data: clientes, error: errClientes } = await supabase
        .from('clientes')
        .select('id, nombre')
        .eq('activo', true)

    if (errClientes) {
        console.error('Error fetching clients:', JSON.stringify(errClientes))
        return
    }

    console.log(`Found ${clientes.length} active clients.`)

    let processed = 0
    let skipped = 0
    let errors = 0

    for (const client of clientes) {
        // 2. Check if client already has this list assigned
        const { data: existing, error: errExist } = await supabase
            .from('clientes_listas_precios')
            .select('id')
            .eq('cliente_id', client.id)
            .eq('lista_precio_id', LISTA_MAYORISTA_ID) // Fixed column name
            .single()

        if (errExist && errExist.code !== 'PGRST116') {
            console.error(`Error checking client ${client.nombre}:`, JSON.stringify(errExist))
            errors++
            continue
        }

        if (existing) {
            skipped++
            continue
        }

        // 3. Assign list
        const { error: errInsert } = await supabase
            .from('clientes_listas_precios')
            .insert({
                cliente_id: client.id,
                lista_precio_id: LISTA_MAYORISTA_ID, // Fixed column name
                prioridad: 1 // Default priority
            })

        if (errInsert) {
            console.error(`Error assigning to ${client.nombre}:`, JSON.stringify(errInsert))
            errors++
        } else {
            processed++
        }

        if ((processed + skipped) % 50 === 0) {
            console.log(`Progress: ${processed + skipped}/${clientes.length}...`)
        }
    }

    console.log('Migration finished.')
    console.log(`Assigned: ${processed}`)
    console.log(`Skipped: ${skipped}`)
    console.log(`Errors: ${errors}`)
}

migrateClientesToMayorista()
