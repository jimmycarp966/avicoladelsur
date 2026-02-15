// Script para procesar PDFs de presupuestos y cargar a BD
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Datos extraídos de los PDFs
const presupuestosPDF = [
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
  },
  {
    cliente: "GABINA (segundo)",
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

async function procesarPresupuestos() {
  console.log('=== PROCESANDO PRESUPUESTOS DESDE PDFs ===\n')

  try {
    // 1. Obtener todos los clientes
    console.log('📋 Obteniendo clientes...')
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('activo', true)

    if (clientesError) {
      console.error('❌ Error obteniendo clientes:', clientesError)
      return
    }

    // Crear mapa de nombre -> id (normalizando nombres)
    const clientesMap = {}
    for (const c of clientes) {
      const nombreNormalizado = c.nombre.toUpperCase().trim()
      clientesMap[nombreNormalizado] = c.id
      // También agregar sinónimos comunes
      if (c.nombre.includes(' ')) {
        const primerNombre = c.nombre.split(' ')[0].toUpperCase()
        clientesMap[primerNombre] = c.id
      }
    }

    console.log(`✅ Clientes encontrados: ${clientes.length}\n`)

    // 2. Obtener todos los productos
    console.log('📦 Obteniendo productos...')
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('id, nombre, codigo')
      .eq('activo', true)

    if (productosError) {
      console.error('❌ Error obteniendo productos:', productosError)
      return
    }

    // Crear mapa de nombre -> id
    const productosMap = {}
    for (const p of productos) {
      const nombreNormalizado = p.nombre.toUpperCase().trim()
      productosMap[nombreNormalizado] = p.id
    }

    console.log(`✅ Productos encontrados: ${productos.length}\n`)

    // 3. Analizar todos los precios para encontrar el más usado de cada producto
    console.log('📊 Analizando precios más usados...\n')
    const preciosPorProducto = {}

    for (const pres of presupuestosPDF) {
      for (const item of pres.items) {
        const nombreProd = item.producto.toUpperCase().trim()
        if (!preciosPorProducto[nombreProd]) {
          preciosPorProducto[nombreProd] = {}
        }
        preciosPorProducto[nombreProd][item.precio] = (preciosPorProducto[nombreProd][item.precio] || 0) + 1
      }
    }

    // 4. Cargar precios en Lista Mayorista
    console.log('💾 Cargando precios en Lista Mayorista...')
    const listaMayoristaId = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

    // Primero vaciar
    await supabase.from('precios_productos').delete().eq('lista_precio_id', listaMayoristaId)

    let preciosCargados = 0
    for (const nombreProd in preciosPorProducto) {
      const precios = preciosPorProducto[nombreProd]
      let precioMasUsado = null
      let maxCount = 0

      for (const precio in precios) {
        if (precios[precio] > maxCount) {
          maxCount = precios[precio]
          precioMasUsado = parseFloat(precio)
        }
      }

      const productoId = productosMap[nombreProd]
      if (productoId && precioMasUsado) {
        const { error } = await supabase
          .from('precios_productos')
          .insert({
            lista_precio_id: listaMayoristaId,
            producto_id: productoId,
            precio: precioMasUsado,
            activo: true
          })

        if (!error) {
          preciosCargados++
        }
      }
    }

    console.log(`✅ Precios cargados: ${preciosCargados}\n`)

    // 5. Crear presupuestos
    console.log('📝 Creando presupuestos...\n')
    console.log('='.repeat(100))

    let presupuestosCreados = 0
    let presupuestosError = 0
    const presupuestosNoCreados = []

    for (const pres of presupuestosPDF) {
      // Buscar cliente
      const nombreCliente = pres.cliente.toUpperCase().trim()
      let clienteId = clientesMap[nombreCliente]

      // Si no encuentra, buscar por coincidencia parcial
      if (!clienteId) {
        for (const [nombre, id] of Object.entries(clientesMap)) {
          if (nombre.includes(nombreCliente) || nombreCliente.includes(nombre)) {
            clienteId = id
            break
          }
        }
      }

      if (!clienteId) {
        console.log(`⚠️  Cliente no encontrado: ${pres.cliente}`)
        presupuestosNoCreados.push({ cliente: pres.cliente, razon: 'Cliente no encontrado' })
        presupuestosError++
        continue
      }

      // Preparar items para RPC
      const itemsJson = []
      let totalEstimado = 0

      for (const item of pres.items) {
        const productoId = productosMap[item.producto.toUpperCase().trim()]
        if (productoId) {
          const subtotal = item.precio * item.cantidad
          totalEstimado += subtotal
          itemsJson.push({
            producto_id: productoId,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            lista_precio_id: null
          })
        }
      }

      if (itemsJson.length === 0) {
        console.log(`⚠️  No se encontraron productos válidos para: ${pres.cliente}`)
        presupuestosNoCreados.push({ cliente: pres.cliente, razon: 'Sin productos válidos' })
        presupuestosError++
        continue
      }

      // Crear presupuesto usando RPC
      const { data: result, error: rpcError } = await supabase.rpc('fn_crear_presupuesto_desde_bot', {
        p_cliente_id: clienteId,
        p_items: itemsJson,
        p_observaciones: null,
        p_zona_id: null,
        p_fecha_entrega_estimada: new Date().toISOString().split('T')[0],
        p_lista_precio_id: null
      })

      if (rpcError || !result?.success) {
        console.log(`❌ Error creando presupuesto para ${pres.cliente}: ${rpcError?.message || result?.error}`)
        presupuestosNoCreados.push({ cliente: pres.cliente, razon: rpcError?.message || result?.error })
        presupuestosError++
      } else {
        presupuestosCreados++
        console.log(`✅ ${pres.cliente.padEnd(20)} - #${result.numero_presupuesto} - $${totalEstimado.toLocaleString('es-AR')}`)
      }
    }

    console.log('='.repeat(100))
    console.log('\n📊 RESUMEN:')
    console.log(`   Presupuestos creados: ${presupuestosCreados}`)
    console.log(`   Errores: ${presupuestosError}`)
    console.log(`   Precios cargados: ${preciosCargados}`)

    if (presupuestosNoCreados.length > 0) {
      console.log('\n⚠️  Presupuestos no creados:')
      for (const p of presupuestosNoCreados) {
        console.log(`   - ${p.cliente}: ${p.razon}`)
      }
    }

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

procesarPresupuestos().then(() => {
  console.log('\n=== FIN DEL PROCESO ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
