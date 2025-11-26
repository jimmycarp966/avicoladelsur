#!/usr/bin/env node
/**
 * Script para importar códigos de clientes desde CLIENTES.xlsx
 * Hace match por nombre y actualiza los códigos en la base de datos
 * 
 * Uso: node scripts/importar-codigos-clientes.js
 * 
 * Requisitos:
 * - Archivo CLIENTES.xlsx en la raíz del proyecto
 * - Variables de entorno configuradas en .env.local
 * - Dependencias: pandas (Python) o xlsx (Node.js)
 */

const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Función para normalizar nombres (eliminar acentos, espacios extras, uppercase)
function normalizarNombre(nombre) {
  if (!nombre) return ''
  return nombre
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/\s+/g, ' ') // Múltiples espacios a uno
    .replace(/[^A-Z0-9\s]/g, '') // Eliminar caracteres especiales
    .trim()
}

// Función para normalizar nombres de forma más flexible (para matching)
function normalizarNombreFlexible(nombre) {
  if (!nombre) return ''
  return nombre
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/\s+/g, '') // Eliminar todos los espacios
    .replace(/[^A-Z0-9]/g, '') // Eliminar caracteres especiales
}

// Función para calcular similitud entre dos strings (Levenshtein simplificado)
function calcularSimilitud(str1, str2) {
  const s1 = normalizarNombreFlexible(str1)
  const s2 = normalizarNombreFlexible(str2)
  
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0
  
  // Si uno contiene al otro, alta similitud
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9
  }
  
  // Calcular distancia simple
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length === 0) return 1.0
  
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++
  }
  
  return matches / longer.length
}

// Función para leer Excel usando Python pandas
function leerExcel() {
  const excelPath = path.join(process.cwd(), 'CLIENTES.xlsx')
  
  if (!fs.existsSync(excelPath)) {
    throw new Error(`❌ No se encontró el archivo CLIENTES.xlsx en ${excelPath}`)
  }

  console.log('📖 Leyendo archivo CLIENTES.xlsx...\n')

  try {
    // Crear script Python temporal
    const tempScriptPath = path.join(process.cwd(), 'temp_read_excel.py')
    const pythonScript = `import pandas as pd
import json
import sys

try:
    df = pd.read_excel('CLIENTES.xlsx')
    # Limpiar filas inválidas
    df = df.dropna(subset=['Codigo', 'Descripcion'])
    # Filtrar solo filas con código numérico válido
    df = df[df['Codigo'].astype(str).str.match(r'^\\d+$', na=False)]
    # Convertir a JSON
    result = df.to_dict('records')
    # Reemplazar NaN por None para JSON válido
    for record in result:
        for key, value in record.items():
            if pd.isna(value):
                record[key] = None
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)
`

    fs.writeFileSync(tempScriptPath, pythonScript, 'utf-8')

    try {
      const result = execSync(`python "${tempScriptPath}"`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })

      if (result.includes('ERROR:')) {
        throw new Error(result)
      }

      const data = JSON.parse(result.trim())
      console.log(`✅ Leídos ${data.length} registros del Excel\n`)
      return data
    } finally {
      // Limpiar archivo temporal
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath)
      }
    }
  } catch (error) {
    console.error('❌ Error al leer Excel:', error.message)
    if (error.stdout) console.error('Salida:', error.stdout)
    if (error.stderr) console.error('Error:', error.stderr)
    throw error
  }
}

// Función para obtener todos los clientes de la BD
async function obtenerClientesBD() {
  console.log('📊 Obteniendo clientes de la base de datos...\n')
  
  const { data, error } = await supabase
    .from('clientes')
    .select('id, codigo, nombre')
    .order('nombre', { ascending: true })

  if (error) {
    throw new Error(`Error al obtener clientes: ${error.message}`)
  }

  console.log(`✅ Encontrados ${data.length} clientes en la BD\n`)
  return data
}

// Función para hacer match entre Excel y BD
function hacerMatch(excelData, clientesBD) {
  console.log('🔍 Haciendo match entre Excel y BD...\n')

  const resultados = {
    actualizados: [],
    noEncontrados: [],
    codigosDuplicados: [],
    errores: []
  }

  // Crear mapa de códigos para detectar duplicados en Excel
  const codigosExcel = new Map()
  excelData.forEach((row, index) => {
    const codigo = String(row.Codigo || '').trim()
    if (codigo && codigo !== 'Codigo' && codigo !== 'Estado') {
      if (codigosExcel.has(codigo)) {
        resultados.codigosDuplicados.push({
          codigo,
          fila1: codigosExcel.get(codigo),
          fila2: index + 1,
          nombre1: row.Descripcion,
          nombre2: row.Descripcion
        })
      } else {
        codigosExcel.set(codigo, index + 1)
      }
    }
  })

  // Crear índice de clientes por nombre normalizado
  const clientesPorNombre = new Map()
  const clientesPorNombreFlexible = new Map()
  clientesBD.forEach(cliente => {
    const nombreNormalizado = normalizarNombre(cliente.nombre)
    const nombreFlexible = normalizarNombreFlexible(cliente.nombre)
    
    if (!clientesPorNombre.has(nombreNormalizado)) {
      clientesPorNombre.set(nombreNormalizado, [])
    }
    clientesPorNombre.get(nombreNormalizado).push(cliente)
    
    if (!clientesPorNombreFlexible.has(nombreFlexible)) {
      clientesPorNombreFlexible.set(nombreFlexible, [])
    }
    clientesPorNombreFlexible.get(nombreFlexible).push(cliente)
  })

  // Hacer match
  excelData.forEach((row, index) => {
    const codigo = String(row.Codigo || '').trim()
    const nombreExcel = String(row.Descripcion || '').trim()
    
    // Saltar filas inválidas
    if (!codigo || codigo === 'Codigo' || codigo === 'Estado' || !nombreExcel) {
      return
    }

    const nombreNormalizado = normalizarNombre(nombreExcel)
    const nombreFlexible = normalizarNombreFlexible(nombreExcel)
    
    // Intentar match exacto primero
    let clientesMatch = clientesPorNombre.get(nombreNormalizado)
    
    // Si no hay match exacto, intentar match flexible
    if (!clientesMatch || clientesMatch.length === 0) {
      clientesMatch = clientesPorNombreFlexible.get(nombreFlexible)
    }
    
    // Si aún no hay match, intentar búsqueda por similitud
    if (!clientesMatch || clientesMatch.length === 0) {
      const candidatos = []
      clientesBD.forEach(cliente => {
        const similitud = calcularSimilitud(nombreExcel, cliente.nombre)
        if (similitud > 0.7) { // Umbral de similitud
          candidatos.push({ cliente, similitud })
        }
      })
      
      if (candidatos.length > 0) {
        // Ordenar por similitud y tomar el mejor
        candidatos.sort((a, b) => b.similitud - a.similitud)
        clientesMatch = [candidatos[0].cliente]
      }
    }

    if (!clientesMatch || clientesMatch.length === 0) {
      resultados.noEncontrados.push({
        codigo,
        nombre: nombreExcel,
        fila: index + 1
      })
    } else if (clientesMatch.length > 1) {
      // Si hay múltiples matches, intentar usar el que no tiene código aún
      const sinCodigo = clientesMatch.filter(c => !c.codigo || c.codigo.trim() === '')
      const clienteElegido = sinCodigo.length > 0 ? sinCodigo[0] : clientesMatch[0]
      
      resultados.actualizados.push({
        clienteId: clienteElegido.id,
        codigoActual: clienteElegido.codigo,
        codigoNuevo: codigo,
        nombre: clienteElegido.nombre,
        fila: index + 1,
        nota: clientesMatch.length > 1 ? `Múltiples matches, usando: ${clienteElegido.nombre}` : undefined
      })
    } else {
      const cliente = clientesMatch[0]
      resultados.actualizados.push({
        clienteId: cliente.id,
        codigoActual: cliente.codigo,
        codigoNuevo: codigo,
        nombre: cliente.nombre,
        fila: index + 1
      })
    }
  })

  return resultados
}

// Función para actualizar códigos en BD
async function actualizarCodigos(resultados) {
  console.log('💾 Actualizando códigos en la base de datos...\n')

  let actualizados = 0
  let errores = 0

  for (const item of resultados.actualizados) {
    // Verificar si el código ya está en uso por otro cliente
    if (item.codigoActual && item.codigoActual !== item.codigoNuevo) {
      const { data: existing } = await supabase
        .from('clientes')
        .select('id')
        .eq('codigo', item.codigoNuevo)
        .neq('id', item.clienteId)
        .single()

      if (existing) {
        resultados.errores.push({
          clienteId: item.clienteId,
          codigo: item.codigoNuevo,
          nombre: item.nombre,
          error: `El código ${item.codigoNuevo} ya está en uso por otro cliente`
        })
        errores++
        continue
      }
    }

    const { error } = await supabase
      .from('clientes')
      .update({ codigo: item.codigoNuevo, updated_at: new Date().toISOString() })
      .eq('id', item.clienteId)

    if (error) {
      resultados.errores.push({
        clienteId: item.clienteId,
        codigo: item.codigoNuevo,
        nombre: item.nombre,
        error: error.message
      })
      errores++
    } else {
      actualizados++
    }
  }

  return { actualizados, errores }
}

// Función principal
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📥 IMPORTACIÓN DE CÓDIGOS DE CLIENTES')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  try {
    // 1. Leer Excel
    const excelData = leerExcel()

    // 2. Obtener clientes de BD
    const clientesBD = await obtenerClientesBD()

    // 3. Hacer match
    const resultados = hacerMatch(excelData, clientesBD)

    // 4. Mostrar preview
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 PREVIEW DE RESULTADOS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log(`✅ Clientes a actualizar: ${resultados.actualizados.length}`)
    console.log(`⚠️  Clientes no encontrados: ${resultados.noEncontrados.length}`)
    console.log(`❌ Códigos duplicados en Excel: ${resultados.codigosDuplicados.length}`)
    console.log(`🔴 Errores de match: ${resultados.errores.length}\n`)

    if (resultados.actualizados.length === 0) {
      console.log('⚠️  No hay clientes para actualizar. Revisa los datos.\n')
      return
    }

    // 5. Confirmar antes de actualizar
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚠️  ¿Deseas continuar con la actualización?')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('Presiona Ctrl+C para cancelar, o espera 5 segundos para continuar...\n')
    
    await new Promise(resolve => setTimeout(resolve, 5000))

    // 6. Actualizar
    const { actualizados, errores } = await actualizarCodigos(resultados)

    // 7. Reporte final
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 REPORTE FINAL')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log(`✅ Clientes actualizados exitosamente: ${actualizados}`)
    console.log(`❌ Errores al actualizar: ${errores}`)
    console.log(`⚠️  Clientes no encontrados: ${resultados.noEncontrados.length}`)
    console.log(`🔴 Códigos duplicados en Excel: ${resultados.codigosDuplicados.length}\n`)

    if (resultados.noEncontrados.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('⚠️  CLIENTES NO ENCONTRADOS (primeros 10):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      resultados.noEncontrados.slice(0, 10).forEach(item => {
        console.log(`  - Código: ${item.codigo}, Nombre: ${item.nombre} (Fila ${item.fila})`)
      })
      if (resultados.noEncontrados.length > 10) {
        console.log(`  ... y ${resultados.noEncontrados.length - 10} más\n`)
      }
    }

    if (resultados.errores.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('❌ ERRORES:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      resultados.errores.slice(0, 10).forEach(item => {
        console.log(`  - ${item.nombre || item.codigo}: ${item.error}`)
      })
      if (resultados.errores.length > 10) {
        console.log(`  ... y ${resultados.errores.length - 10} más\n`)
      }
    }

    console.log('\n✅ Importación completada\n')

  } catch (error) {
    console.error('\n❌ Error durante la importación:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)

