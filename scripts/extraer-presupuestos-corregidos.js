// Script corregido para procesar presupuestos desde PDFs
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// DATOS CORREGIDOS DESDE LOS PDFs - LEÍDO EN DETALLE
const presupuestosPDF = [
  // PDF 1 - GABINA
  {
    cliente: "GABINA",
    items: [
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
    ],
    total: 1029500
  },
  // PDF 2 - NATALIA
  {
    cliente: "NATALIA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 2 },
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
      { producto: "CAJON FILET X20KG BLOQUE SOFIA", precio: 124000, cantidad: 1 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 48000, cantidad: 3 }
    ],
    total: 901500
  },
  // PDF 3 - LOURDES
  {
    cliente: "LOURDES",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 10 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PUCHERO KG.", precio: 1000, cantidad: 20 },
      { producto: "MENUDO KG.", precio: 1600, cantidad: 2 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 20 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 6 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 2 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 48000, cantidad: 3 }
    ],
    total: 542350
  },
  // PDF 4 - MARIA LAURA
  {
    cliente: "MARIA LAURA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 2 },
      { producto: "SUPREMA", precio: 6500, cantidad: 10 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PUCHERO KG.", precio: 1000, cantidad: 20 },
      { producto: "MENUDO KG.", precio: 1600, cantidad: 2 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 20 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 6 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 2 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 48000, cantidad: 3 }
    ],
    total: 610350
  },
  // PDF 5 - SANDRA
  {
    cliente: "SANDRA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 10 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PUCHERO KG.", precio: 1000, cantidad: 20 },
      { producto: "MENUDO KG.", precio: 1600, cantidad: 2 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 20 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 6 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 2 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 48000, cantidad: 3 }
    ],
    total: 542350
  },
  // PDF 6 - MIRTA (ESTE ES DIFERENTE - tiene menos items)
  {
    cliente: "MIRTA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 7 - MABEL (mismo que MIRTA)
  {
    cliente: "MABEL",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 8 - MONICA (mismo que MIRTA)
  {
    cliente: "MONICA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 9 - CLAUDIA (mismo que MIRTA)
  {
    cliente: "CLAUDIA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 10 - ALEJANDRA (mismo que MIRTA)
  {
    cliente: "ALEJANDRA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 11 - LORENA (mismo que MIRTA)
  {
    cliente: "LORENA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 12 - GRACIELA (mismo que MIRTA)
  {
    cliente: "GRACIELA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 13 - PATRICIA (mismo que MIRTA)
  {
    cliente: "PATRICIA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 14 - SUSANA (mismo que MIRTA)
  {
    cliente: "SUSANA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  },
  // PDF 15 - ANDREA (mismo que MIRTA)
  {
    cliente: "ANDREA",
    items: [
      { producto: "CAJON POLLO SOFIA X20KG N°7", precio: 68000, cantidad: 1 },
      { producto: "SUPREMA", precio: 6500, cantidad: 5 },
      { producto: "GALLINA RF KG.", precio: 2600, cantidad: 1 },
      { producto: "PECHUGA KG.", precio: 5500, cantidad: 10 },
      { producto: "CAJON POLLO TROZADO X20KG INDACOR", precio: 61750, cantidad: 2 },
      { producto: "PAN RALLADO X10 KG", precio: 10500, cantidad: 3 },
      { producto: "PATITAS POLLO X5KG GRANGIS", precio: 31000, cantidad: 1 }
    ],
    total: 262250
  }
]

async function verificarPresupuestosCreados() {
  console.log('=== VERIFICANDO PRESUPUESTOS CREADOS HOY ===\n')

  const hoy = new Date().toISOString().split('T')[0]

  const { data: presupuestos } = await supabase
    .from('presupuestos')
    .select('id, numero_presupuesto, created_at, estado, cliente_id, total_estimado')
    .gte('created_at', `${hoy}T00:00:00`)
    .order('created_at', { ascending: true })

  console.log(`Presupuestos creados hoy: ${presupuestos?.length || 0}\n`)

  for (const p of presupuestos || []) {
    // Obtener cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('id', p.cliente_id)
      .single()

    // Obtener items
    const { data: items } = await supabase
      .from('presupuesto_items')
      .select('producto_id, cantidad_solicitada, precio_unit_est, producto:productos(nombre)')
      .eq('presupuesto_id', p.id)

    console.log(`#${p.numero_presupuesto} - ${cliente?.nombre || 'N/A'} - $${p.total_estimado?.toLocaleString('es-AR')} - ${items?.length} items`)
  }
}

verificarPresupuestosCreados().then(() => process.exit(0))
