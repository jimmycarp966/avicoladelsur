// Script para buscar PAN RALLADO
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function buscarPanRallado() {
  console.log('=== BUSCANDO PAN RALLADO ===\n')

  // Buscar que contenga PAN y RALLADO
  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, codigo')
    .ilike('nombre', '%PAN%RALLADO%')

  if (productos && productos.length > 0) {
    console.log(`Encontrados ${productos.length} productos:`)
    for (const p of productos) {
      console.log(`  - ${p.nombre} (ID: ${p.id})`)
    }
  } else {
    console.log('❌ No encontrado')
  }

  // Buscar solo RALLADO
  const { data: productos2 } = await supabase
    .from('productos')
    .select('id, nombre, codigo')
    .ilike('nombre', '%RALLADO%')

  console.log(`\nTodos con RALLADO (${productos2?.length}):`)
  for (const p of productos2 || []) {
    console.log(`  - ${p.nombre} (ID: ${p.id})`)
  }
}

buscarPanRallado().then(() => process.exit(0))
