#!/usr/bin/env node
/**
 * Script para importar productos y clientes desde archivos Excel
 * Uso: node scripts/importar-datos.js
 */

const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const { readFileSync } = require('fs')
const { join } = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan')
}

// Función auxiliar para obtener valor de columna flexible
function getValue(row, keys) {
  const rowKeys = Object.keys(row).map(k => k.toLowerCase())
  for (const key of keys) {
    const found = rowKeys.find(rk => rk === key.toLowerCase())
    if (found) {
      const origKey = Object.keys(row).find(ok => ok.toLowerCase() === found)
      return row[origKey]
    }
  }
  return null
}

// Leer productos desde Excel
function leerProductos(rutaArchivo) {
  logInfo(`Leyendo productos desde: ${rutaArchivo}`)
  const workbook = XLSX.readFile(rutaArchivo)
  const sheetName = workbook.SheetNames[0]
  logInfo(`Hoja encontrada: ${sheetName}`)
  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false })
  
  logInfo(`Filas leídas del Excel: ${rows.length}`)
  if (rows.length > 0) {
    logInfo(`Primera fila (columnas): ${Object.keys(rows[0]).join(', ')}`)
    logInfo(`Primera fila (muestra): ${JSON.stringify(rows[0]).substring(0, 300)}`)
    if (rows.length > 1) {
      logInfo(`Segunda fila (muestra): ${JSON.stringify(rows[1]).substring(0, 300)}`)
    }
    if (rows.length > 2) {
      logInfo(`Tercera fila (muestra): ${JSON.stringify(rows[2]).substring(0, 300)}`)
    }
  }

  const productos = []
  const errores = []

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i]
      const codigo = getValue(row, ['codigo', 'Codigo', 'código', 'cod', 'Código', 'CODIGO'])?.toString()?.trim()
      const nombre = getValue(row, ['nombre', 'Nombre', 'name', 'Name', 'descripcion', 'Descripcion', 'descripción', 'NOMBRE', 'DESCRIPCION'])?.toString()?.trim()
      // Buscar precio en cualquier columna que tenga "precio" en el nombre
      const precioRaw = getValue(row, ['precio_venta', 'Precio Venta', 'precio venta', 'Precio', 'precio', 'Precio Venta Unitario', 'PRECIO_VENTA', 'Precio_Venta'])
      let precioVenta = 0
      
      if (precioRaw) {
        precioVenta = parseFloat(
          precioRaw.toString().replace(/[^0-9.,-]/g, '').replace(',', '.') || '0'
        )
      } else {
        // Buscar cualquier columna que contenga "precio"
        for (const key of Object.keys(row)) {
          if (key.toLowerCase().includes('precio')) {
            precioVenta = parseFloat(
              row[key]?.toString()?.replace(/[^0-9.,-]/g, '')?.replace(',', '.') || '0'
            )
            break
          }
        }
      }

      // Saltar filas vacías o sin código válido
      if (!codigo || codigo === '0' || codigo === '') {
        continue
      }

      if (!nombre || nombre === '') {
        errores.push(`Fila ${i + 2}: Falta nombre para código ${codigo}`)
        continue
      }

      // Si no hay precio, usar 0 (se podrá actualizar después)
      if (isNaN(precioVenta)) {
        precioVenta = 0
        logWarning(`Fila ${i + 2}: Producto ${codigo} sin precio, se usará 0`)
      }

      // Buscar costo
      const costoRaw = getValue(row, ['precio_costo', 'Precio Costo', 'precio costo', 'Costo', 'costo', 'costo unitario', 'Costo Unitario'])
      let precioCosto = null
      
      if (costoRaw) {
        precioCosto = parseFloat(
          costoRaw.toString().replace(/[^0-9.,-]/g, '').replace(',', '.') || '0'
        )
        if (isNaN(precioCosto) || precioCosto <= 0) precioCosto = null
      } else {
        // Buscar cualquier columna que contenga "costo"
        for (const key of Object.keys(row)) {
          if (key.toLowerCase().includes('costo')) {
            precioCosto = parseFloat(
              row[key]?.toString()?.replace(/[^0-9.,-]/g, '')?.replace(',', '.') || '0'
            )
            if (isNaN(precioCosto) || precioCosto <= 0) precioCosto = null
            break
          }
        }
      }

      const stockMinimo = parseInt(
        getValue(row, ['stock_minimo', 'stock mínimo', 'stock', 'stock minimo'])
          ?.toString()
          ?.replace(/[^0-9]/g, '') || '0'
      )

      // Si el nombre es igual a la descripción, usar solo uno
      const descripcion = getValue(row, ['descripcion', 'Descripcion', 'descripción', 'desc', 'DESCRIPCION'])
      const descripcionFinal = descripcion?.toString()?.trim() && descripcion !== nombre ? descripcion.toString().trim() : null

      productos.push({
        codigo,
        nombre,
        descripcion: descripcionFinal,
        categoria: getValue(row, ['categoria', 'Categoria', 'categoría', 'Categoría', 'cat', 'tipo', 'Tipo', 'CATEGORIA'])?.toString()?.trim() || null,
        precio_venta: precioVenta,
        precio_costo: isNaN(precioCosto) || precioCosto <= 0 ? null : precioCosto,
        unidad_medida: getValue(row, ['unidad_medida', 'Unidad Medida', 'unidad medida', 'unidad', 'Unidad', 'um', 'UM'])?.toString()?.trim() || 'kg',
        stock_minimo: isNaN(stockMinimo) ? 0 : stockMinimo,
        activo: true,
      })
    } catch (error) {
      errores.push(`Fila ${i + 2}: ${error.message}`)
    }
  }

  return { productos, errores }
}

// Leer clientes desde Excel
function leerClientes(rutaArchivo) {
  logInfo(`Leyendo clientes desde: ${rutaArchivo}`)
  const workbook = XLSX.readFile(rutaArchivo)
  const sheetName = workbook.SheetNames[0]
  logInfo(`Hoja encontrada: ${sheetName}`)
  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false })
  
  logInfo(`Filas leídas del Excel: ${rows.length}`)
  if (rows.length > 0) {
    logInfo(`Primera fila (columnas): ${Object.keys(rows[0]).join(', ')}`)
    logInfo(`Primera fila (muestra): ${JSON.stringify(rows[0]).substring(0, 300)}`)
    if (rows.length > 1) {
      logInfo(`Segunda fila (muestra): ${JSON.stringify(rows[1]).substring(0, 300)}`)
    }
  }

  const clientes = []
  const errores = []

  const normalizarTelefono = (tel) => {
    if (!tel) return null
    return tel.toString().trim().replace(/[^0-9+]/g, '') || null
  }

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i]
      let nombre = getValue(row, ['nombre', 'Nombre', 'name', 'Name', 'NOMBRE', 'cliente', 'Cliente', 'razon social', 'razón social'])
      
      // Si no encuentra "nombre", usar "Descripcion" o "Descripción"
      if (!nombre) {
        nombre = getValue(row, ['descripcion', 'Descripcion', 'descripción', 'Descripción', 'DESCRIPCION'])
      }
      
      nombre = nombre?.toString()?.trim()

      if (!nombre || nombre === '') {
        errores.push(`Fila ${i + 2}: Falta nombre`)
        continue
      }

      // Si el estado es INACTIVO, marcarlo como inactivo
      const estado = getValue(row, ['estado', 'Estado', 'ESTADO'])?.toString()?.trim()?.toUpperCase()
      const activo = estado !== 'INACTIVO'

      const limiteCredito = parseFloat(
        getValue(row, ['limite_credito', 'límite crédito', 'limite credito', 'límite', 'credito', 'crédito'])
          ?.toString()
          ?.replace(/[^0-9.,-]/g, '')
          ?.replace(',', '.') || '0'
      )

      // Buscar localidad por nombre si no hay ID
      let localidad_id = getValue(row, ['localidad_id', 'localidad id', 'localidadid', 'Localidad ID'])?.toString()?.trim() || null
      const localidadNombre = getValue(row, ['localidad', 'Localidad', 'LOCALIDAD'])?.toString()?.trim()
      
      // Si hay nombre de localidad pero no ID, intentar buscar en BD (después)
      // Por ahora solo guardamos el nombre en zona_entrega si no hay zona
      const zona_entrega = getValue(row, ['zona_entrega', 'zona', 'Zona', 'Zona Entrega', 'zona entrega', 'sector', 'Sector'])?.toString()?.trim() || 
                          (localidadNombre ? localidadNombre : null)

      clientes.push({
        nombre,
        telefono: normalizarTelefono(getValue(row, ['telefono', 'Teléfono', 'tel', 'Tel', 'telefono', 'phone', 'Phone', 'TELEFONO'])),
        whatsapp: normalizarTelefono(getValue(row, ['whatsapp', 'Whatsapp', 'wa', 'Wa', 'whats app', 'Whats App', 'WHATSAPP'])),
        email: getValue(row, ['email', 'Email', 'mail', 'Mail', 'correo', 'Correo', 'e-mail', 'E-mail', 'EMAIL'])?.toString()?.trim() || null,
        direccion: getValue(row, ['direccion', 'Dirección', 'dirección', 'Dir', 'dir', 'domicilio', 'Domicilio', 'address', 'Address', 'DIRECCION'])?.toString()?.trim() || null,
        zona_entrega: zona_entrega,
        localidad_id: localidad_id,
        tipo_cliente: getValue(row, ['tipo_cliente', 'Tipo Cliente', 'tipo', 'Tipo', 'tipo cliente', 'categoria cliente', 'Tipo Cliente', 'TIPO_CLIENTE'])?.toString()?.trim() || 'minorista',
        limite_credito: isNaN(limiteCredito) ? 0 : limiteCredito,
        activo: activo,
      })
    } catch (error) {
      errores.push(`Fila ${i + 2}: ${error.message}`)
    }
  }

  return { clientes, errores }
}

// Borrar todos los productos usando función RPC si existe, sino borrado directo
async function borrarTodosProductos() {
  logInfo('Borrando todos los productos...')
  
  try {
    // Intentar usar función RPC si existe
    const { data: rpcResult, error: rpcError } = await supabase.rpc('fn_borrar_todos_productos')
    
    if (!rpcError && rpcResult && rpcResult.success) {
      logSuccess('Productos borrados usando función RPC')
      return true
    }

    // Fallback: borrado manual - usar SQL directo
    logInfo('Usando borrado manual (función RPC no disponible)...')
    
    // Obtener todos los productos primero
    const { data: productos } = await supabase.from('productos').select('id')
    if (!productos || productos.length === 0) {
      logInfo('No hay productos para borrar')
      return true
    }

    const productoIds = productos.map(p => p.id)

    // Borrar relaciones primero (en orden correcto para foreign keys)
    try {
      // 1. Borrar presupuesto_items (referencia productos)
      await supabase.from('presupuesto_items').delete().in('producto_id', productoIds)
      await supabase.from('detalles_presupuesto').delete().in('producto_id', productoIds)
      
      // 2. Borrar detalles de pedido y cotización
      await supabase.from('detalles_pedido').delete().in('producto_id', productoIds)
      await supabase.from('detalles_cotizacion').delete().in('producto_id', productoIds)
      
      // 3. Obtener lotes relacionados y borrar sus relaciones
      const { data: lotes } = await supabase.from('lotes').select('id').in('producto_id', productoIds)
      if (lotes && lotes.length > 0) {
        const loteIds = lotes.map(l => l.id)
        
        // Borrar movimientos y checklists de lotes
        await supabase.from('movimientos_stock').delete().in('lote_id', loteIds)
        await supabase.from('checklists_calidad').delete().in('lote_id', loteIds)
        
        // Borrar stock_reservations si existe
        await supabase.from('stock_reservations').delete().in('lote_id', loteIds)
      }
      
      // 4. Borrar lotes
      await supabase.from('lotes').delete().in('producto_id', productoIds)
    } catch (e) {
      logWarning(`Algunas relaciones no se pudieron borrar: ${e.message}`)
      // Continuar de todas formas
    }
    
    // Finalmente borrar productos
    const { error } = await supabase.from('productos').delete().in('id', productoIds)
    
    if (error) throw error
    logSuccess(`Productos borrados exitosamente: ${productos.length}`)
    return true
  } catch (error) {
    logError(`Error al borrar productos: ${error.message}`)
    return false
  }
}

// Borrar todos los clientes usando función RPC si existe, sino borrado directo
async function borrarTodosClientes() {
  logInfo('Borrando todos los clientes...')
  
  try {
    // Intentar usar función RPC si existe
    const { data: rpcResult, error: rpcError } = await supabase.rpc('fn_borrar_todos_clientes')
    
    if (!rpcError && rpcResult && rpcResult.success) {
      logSuccess('Clientes borrados usando función RPC')
      return true
    }

    // Fallback: borrado manual
    logInfo('Usando borrado manual (función RPC no disponible)...')
    
    // Obtener todos los clientes primero
    const { data: clientes } = await supabase.from('clientes').select('id')
    if (!clientes || clientes.length === 0) {
      logInfo('No hay clientes para borrar')
      return true
    }

    const clienteIds = clientes.map(c => c.id)

    // Borrar relaciones primero (en orden)
    try {
      // Borrar presupuestos
      const { data: presupuestos } = await supabase.from('presupuestos').select('id').in('cliente_id', clienteIds)
      if (presupuestos && presupuestos.length > 0) {
        const presupuestoIds = presupuestos.map(p => p.id)
        await supabase.from('detalles_presupuesto').delete().in('presupuesto_id', presupuestoIds)
        await supabase.from('presupuestos').delete().in('id', presupuestoIds)
      }

      // Borrar pedidos
      const { data: pedidos } = await supabase.from('pedidos').select('id').in('cliente_id', clienteIds)
      if (pedidos && pedidos.length > 0) {
        const pedidoIds = pedidos.map(p => p.id)
        await supabase.from('detalles_pedido').delete().in('pedido_id', pedidoIds)
        await supabase.from('detalles_ruta').delete().in('pedido_id', pedidoIds)
        await supabase.from('pedidos').delete().in('id', pedidoIds)
      }

      // Borrar cotizaciones
      const { data: cotizaciones } = await supabase.from('cotizaciones').select('id').in('cliente_id', clienteIds)
      if (cotizaciones && cotizaciones.length > 0) {
        const cotizacionIds = cotizaciones.map(c => c.id)
        await supabase.from('detalles_cotizacion').delete().in('cotizacion_id', cotizacionIds)
        await supabase.from('cotizaciones').delete().in('id', cotizacionIds)
      }

      // Borrar reclamos
      await supabase.from('reclamos').delete().in('cliente_id', clienteIds)

      // Borrar cuentas corrientes
      const { data: cuentas } = await supabase.from('cuentas_corrientes').select('id').in('cliente_id', clienteIds)
      if (cuentas && cuentas.length > 0) {
        const cuentaIds = cuentas.map(c => c.id)
        await supabase.from('cuentas_movimientos').delete().in('cuenta_corriente_id', cuentaIds)
        await supabase.from('cuentas_corrientes').delete().in('id', cuentaIds)
      }
    } catch (e) {
      logWarning(`Algunas relaciones no se pudieron borrar: ${e.message}`)
    }
    
    // Finalmente borrar clientes
    const { error } = await supabase.from('clientes').delete().in('id', clienteIds)
    
    if (error) throw error
    logSuccess(`Clientes borrados exitosamente: ${clientes.length}`)
    return true
  } catch (error) {
    logError(`Error al borrar clientes: ${error.message}`)
    return false
  }
}

// Importar productos
async function importarProductos(productos) {
  logInfo(`Importando ${productos.length} productos...`)
  
  let importados = 0
  const errores = []

  // Insertar en lotes de 50
  const loteSize = 50
  for (let i = 0; i < productos.length; i += loteSize) {
    const lote = productos.slice(i, i + loteSize)
    const { data, error } = await supabase.from('productos').insert(lote).select()

    if (error) {
      // Intentar uno por uno
      for (const producto of lote) {
        const { error: errorIndividual } = await supabase.from('productos').insert(producto)
        if (errorIndividual) {
          errores.push(`Producto ${producto.codigo}: ${errorIndividual.message}`)
        } else {
          importados++
        }
      }
    } else {
      importados += data?.length || 0
    }
  }

  return { importados, errores }
}

// Importar clientes
async function importarClientes(clientes) {
  logInfo(`Importando ${clientes.length} clientes...`)
  
  let importados = 0
  const errores = []

  // Insertar en lotes de 50
  const loteSize = 50
  for (let i = 0; i < clientes.length; i += loteSize) {
    const lote = clientes.slice(i, i + loteSize)
    const { data, error } = await supabase.from('clientes').insert(lote).select()

    if (error) {
      // Intentar uno por uno
      for (const cliente of lote) {
        const { data: clienteInsertado, error: errorIndividual } = await supabase
          .from('clientes')
          .insert(cliente)
          .select()
          .single()

        if (errorIndividual) {
          errores.push(`Cliente ${cliente.nombre}: ${errorIndividual.message}`)
        } else {
          importados++
          // Crear cuenta corriente
          if (clienteInsertado) {
            await supabase.rpc('fn_asegurar_cuenta_corriente', {
              p_cliente_id: clienteInsertado.id,
            })
          }
        }
      }
    } else {
      importados += data?.length || 0
      // Crear cuentas corrientes
      for (const cliente of data || []) {
        await supabase.rpc('fn_asegurar_cuenta_corriente', {
          p_cliente_id: cliente.id,
        })
      }
    }
  }

  return { importados, errores }
}

// Función principal
async function main() {
  log('\n🚀 Script de Importación de Productos y Clientes\n', 'blue')

  // Rutas de archivos
  const rutaProductos = join(process.cwd(), 'LISTADO DE PRODUCTOS.xlsx')
  const rutaClientes = join(process.cwd(), 'CLIENTES.xlsx')

  // Verificar que los archivos existen
  try {
    readFileSync(rutaProductos)
    readFileSync(rutaClientes)
  } catch (error) {
    logError('No se encuentran los archivos Excel en la raíz del proyecto')
    logInfo('Archivos esperados: LISTADO DE PRODUCTOS.xlsx y CLIENTES.xlsx')
    process.exit(1)
  }

  logSuccess(`Archivo de productos: ${rutaProductos}`)
  logSuccess(`Archivo de clientes: ${rutaClientes}`)

  // Leer archivos
  log('\n📋 Leyendo archivos Excel...\n', 'cyan')
  const { productos, errores: erroresProductos } = leerProductos(rutaProductos)
  const { clientes, errores: erroresClientes } = leerClientes(rutaClientes)


  if (productos.length === 0) {
    logError('No se encontraron productos válidos después de procesar el Excel')
    logInfo(`Total de filas procesadas: ${rows.length}`)
    logInfo(`Errores encontrados: ${erroresProductos.length}`)
    if (erroresProductos.length > 0) {
      erroresProductos.slice(0, 10).forEach(err => logError(`  - ${err}`))
    }
    process.exit(1)
  }

  logSuccess(`Productos encontrados: ${productos.length}`)
  if (erroresProductos.length > 0) {
    logWarning(`Errores/advertencias en productos: ${erroresProductos.length}`)
    erroresProductos.slice(0, 5).forEach(err => logWarning(`  - ${err}`))
  }

  if (clientes.length === 0) {
    logError('No se encontraron clientes válidos después de procesar el Excel')
    process.exit(1)
  }

  logSuccess(`Clientes encontrados: ${clientes.length}`)
  if (erroresClientes.length > 0) {
    logWarning(`Errores/advertencias en clientes: ${erroresClientes.length}`)
    erroresClientes.slice(0, 5).forEach(err => logWarning(`  - ${err}`))
  }

  // Confirmar borrado
  log('\n⚠️  ADVERTENCIA: Este proceso eliminará TODOS los productos y clientes existentes.', 'yellow')
  log('⚠️  Se recomienda hacer un backup de la base de datos antes de continuar.\n', 'yellow')

  // Borrar datos existentes
  log('\n🔄 Borrando datos existentes...\n', 'cyan')
  const productosBorrados = await borrarTodosProductos()
  const clientesBorrados = await borrarTodosClientes()

  if (!productosBorrados || !clientesBorrados) {
    logError('Error al borrar datos existentes. Abortando importación.')
    process.exit(1)
  }

  // Importar nuevos datos
  log('\n📥 Importando nuevos datos...\n', 'cyan')
  const resultadoProductos = await importarProductos(productos)
  const resultadoClientes = await importarClientes(clientes)

  // Mostrar resultados
  log('\n📊 Resultados de la importación:\n', 'blue')
  log(`✅ Productos importados: ${resultadoProductos.importados}`, 'green')
  if (resultadoProductos.errores.length > 0) {
    logWarning('⚠️  Errores en productos:')
    resultadoProductos.errores.slice(0, 10).forEach(err => logWarning(`  - ${err}`))
  }

  log(`✅ Clientes importados: ${resultadoClientes.importados}`, 'green')
  if (resultadoClientes.errores.length > 0) {
    logWarning('⚠️  Errores en clientes:')
    resultadoClientes.errores.slice(0, 10).forEach(err => logWarning(`  - ${err}`))
  }

  logSuccess('\n✨ Importación completada exitosamente!')
}

// Ejecutar
main().catch((error) => {
  logError(`Error fatal: ${error.message}`)
  console.error(error)
  process.exit(1)
})

