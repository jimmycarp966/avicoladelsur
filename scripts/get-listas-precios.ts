
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function getMayoristaId() {
    const { data, error } = await supabase
        .from('listas_precios')
        .select('id, nombre, tipo')
        .or('nombre.ilike.%Mayorista%,tipo.eq.mayorista') // Filter directly

    if (error) {
        console.error('ERROR:', JSON.stringify(error))
        return
    }

    if (!data || data.length === 0) {
        console.log('NO MAYORISTA FOUND')
        return
    }

    // Print only the ID to avoid noise
    console.log('MAYORISTA_ID:', data[0].id)
    console.log('DETAILS:', JSON.stringify(data[0]))
}

getMayoristaId()
