// Script para comparar PDF con BD
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function compararPresupuesto(numeroPresupuesto, clientePDF, itemsPDF) {
  console.log(`\n=== COMPARANDO PRESUPUESTO #${numeroPresupuesto} ===`)
  console.log(`Cliente PDF: ${clientePDF}`)

  const { data: presupuesto } = await supabase
    .from('presupuestos')
    .select('id, cliente_id, total_estimado')
    .eq('numero_presupuesto', numeroPresupuesto)
    .single()

  if (!presupuesto) {
    console.log('❌ Presupuesto no encontrado')
    return
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('nombre')
    .eq('id', presupuesto.cliente_id)
    .single()

  console.log(`Cliente BD: ${cliente?.nombre}`)
  console.log(`Total BD: $${presupuesto.total_estimado?.toLocaleString('es-AR')}`)
  console.log(`Total PDF: $${itemsPDF.reduce((sum, i) => sum + i.precio * i.cantidad, 0).toLocaleString('es-AR')}`)

  const { data: items } = await supabase
    .from('presupuesto_items')
    .select('producto:productos(nombre), cantidad_solicitada, precio_unit_est')
    .eq('presupuesto_id', presupuesto.id)

  console.log(`\nItems BD (${items?.length}):`)
  for (const i of items || []) {
    console.log(`  - ${i.producto?.nombre} | ${i.cantidad_solicitada} | $${i.precio_unit_est}`)
  }

  console.log(`\nItems PDF (${itemsPDF.length}):`)
  for (const i of itemsPDF) {
    console.log(`  - ${i.producto} | ${i.cantidad} | $${i.precio}`)
  }
}

// Comparar algunos presupuestos
const itemsGABINA = [
  { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 80000, cantidad: 2 },
  { producto: "FILET MERLUZA X7KG", precio: 56000, cantidad: 1 },
  { producto: "SUPREMA", precio: 6500, cantidad: 10 },
  { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
  { producto: "PUCHERO KG.", precio: 1000, cantidad: 20 },
  { producto: "MENUDO KG.", precio: 1600, cantidad: 2 },
  { producto: "PECHUGA KG.", precio: 5500, cantidad: 20 },
  { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
  { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 6 },
  { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 2 },
  { producto: "MERLUZA REBOZADA EL SHADDAI X6KG", precio: 28200, cantidad: 1 },
  { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
  { producto: "CAJON FILET X20KG BLOQUE SOFIA", precio: 124000, cantidad: 1 },
  { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 48000, cantidad: 3 }
]

const itemsMIRTA = [
  { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
  { producto: "SUPREMA", precio: 6500, cantidad: 5 },
  { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
  { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
  { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
  { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
  { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
]

compararPresupuesto('PR-000000028', 'GABINA', itemsGABINA).then(() =>
  compararPresupuesto('PR-000000031', 'MIRTA', itemsMIRTA)
).then(() => process.exit(0))
