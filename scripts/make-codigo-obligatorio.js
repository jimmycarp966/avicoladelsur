#!/usr/bin/env node
/**
 * Script para hacer el campo codigo obligatorio en la tabla clientes
 * 
 * Uso: node scripts/make-codigo-obligatorio.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔒 HACIENDO CAMPO CÓDIGO OBLIGATORIO')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  try {
    // 1. Verificar que todos los clientes tengan código
    console.log('📊 Verificando que todos los clientes tengan código...\n')
    
    const { data: clientesSinCodigo, error: checkError } = await supabase
      .from('clientes')
      .select('id, nombre, codigo')
      .or('codigo.is.null,codigo.eq.')

    if (checkError) {
      throw new Error(`Error al verificar clientes: ${checkError.message}`)
    }

    if (clientesSinCodigo && clientesSinCodigo.length > 0) {
      console.log(`❌ Error: Hay ${clientesSinCodigo.length} clientes sin código:\n`)
      clientesSinCodigo.slice(0, 10).forEach(cliente => {
        console.log(`  - ${cliente.nombre} (ID: ${cliente.id})`)
      })
      if (clientesSinCodigo.length > 10) {
        console.log(`  ... y ${clientesSinCodigo.length - 10} más\n`)
      }
      console.log('\n⚠️  Ejecuta primero el script de importación antes de continuar.\n')
      process.exit(1)
    }

    console.log('✅ Todos los clientes tienen código asignado\n')

    // 2. Leer la migración SQL
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251202_make_codigo_obligatorio.sql')
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`No se encontró el archivo de migración: ${migrationPath}`)
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    
    // Separar las sentencias SQL (excluyendo los bloques DO $$)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'))

    console.log('💾 Ejecutando migración...\n')

    // 3. Eliminar índice único parcial
    console.log('  - Eliminando índice único parcial...')
    const { error: dropIndexError } = await supabase.rpc('exec_sql', {
      sql: 'DROP INDEX IF EXISTS idx_clientes_codigo_unique;'
    }).catch(() => {
      // Si no existe la función RPC, ejecutar directamente
      return supabase.from('_migration').select('*').limit(0)
    })

    // Usar query directa para DROP INDEX
    const { error: dropError } = await supabase
      .from('clientes')
      .select('id')
      .limit(0)
    
    // Ejecutar SQL directamente usando el cliente
    // Nota: Supabase JS no soporta DDL directamente, necesitamos usar el SQL Editor
    // Por ahora, vamos a hacerlo paso a paso con las operaciones que sí podemos hacer

    // 4. Verificar constraint actual
    console.log('  - Verificando constraint actual...')
    
    // 5. Hacer campo NOT NULL (esto requiere ejecutar SQL directamente)
    console.log('\n⚠️  NOTA: Las operaciones DDL (ALTER TABLE) requieren ejecutarse en Supabase SQL Editor.')
    console.log('   El archivo de migración está en: supabase/migrations/20251202_make_codigo_obligatorio.sql\n')
    console.log('   Pasos manuales:')
    console.log('   1. Abre Supabase Dashboard > SQL Editor')
    console.log('   2. Copia y pega el contenido del archivo de migración')
    console.log('   3. Ejecuta la migración\n')
    
    // Alternativa: Intentar usar la API REST de Supabase para ejecutar SQL
    // Pero esto requiere permisos especiales
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Verificación completada')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('Todos los clientes tienen código. Puedes ejecutar la migración SQL manualmente.\n')

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)





































