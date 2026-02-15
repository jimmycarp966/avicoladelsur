// Script para buscar clientes similares
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function buscarClientes() {
  const buscados = ['NATALIA', 'LOURDES', 'MABEL', 'ANDREA']

  console.log('=== BUSCANDO CLIENTES ===\n')

  for (const nombre of buscados) {
    console.log(`\n🔍 Buscando: ${nombre}`)

    // Buscar que contenga el nombre
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, razon_social')
      .ilike('nombre', `%${nombre}%`)
      .limit(10)

    if (clientes && clientes.length > 0) {
      console.log(`   Encontrados (${clientes.length}):`)
      for (const c of clientes) {
        console.log(`   - ${c.nombre} ${c.apellido || ''} ${c.razon_social || ''} (ID: ${c.id})`)
      }
    } else {
      console.log(`   ❌ No encontrado`)
    }
  }
}

buscarClientes().then(() => process.exit(0))
