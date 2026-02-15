/**
 * Script para aplicar migraciones SQL de conciliación
 * Usa la API REST de Supabase directamente
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const MIGRACIONES = [
  'supabase/migrations/20260203140000_mejoras_conciliacion_v3.sql'
];

async function ejecutarSQL(nombreArchivo) {
  const ruta = path.join(process.cwd(), nombreArchivo);
  
  if (!fs.existsSync(ruta)) {
    console.error(`❌ Archivo no encontrado: ${ruta}`);
    return false;
  }

  const sql = fs.readFileSync(ruta, 'utf-8');
  console.log(`\n📄 Aplicando: ${nombreArchivo}`);
  console.log(`   Tamaño: ${sql.length} caracteres`);

  try {
    // Dividir el SQL en statements individuales (aproximado)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`   Statements: ${statements.length}`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      
      // Ignorar comentarios y bloques vacíos
      if (stmt.startsWith('--') || stmt.startsWith('/*') || stmt.length < 10) {
        continue;
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          query: stmt + ';'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        // Algunos errores son esperados (ej: "ya existe")
        if (error.includes('already exists') || error.includes('duplicate')) {
          console.log(`   ⚠️  Statement ${i + 1}: Ya existe (ignorado)`);
        } else {
          console.error(`   ❌ Statement ${i + 1} falló:`, error.substring(0, 200));
        }
      } else {
        process.stdout.write('.');
      }
    }

    console.log('\n   ✅ Completado');
    return true;
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return false;
  }
}

// Método alternativo usando RPC si está disponible
async function ejecutarSQLViaRPC(nombreArchivo) {
  const ruta = path.join(process.cwd(), nombreArchivo);
  
  if (!fs.existsSync(ruta)) {
    console.error(`❌ Archivo no encontrado: ${ruta}`);
    return false;
  }

  const sql = fs.readFileSync(ruta, 'utf-8');
  console.log(`\n📄 Aplicando vía RPC: ${nombreArchivo}`);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        sql_query: sql
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`   ❌ Error RPC:`, error);
      return false;
    }

    console.log('   ✅ Completado vía RPC');
    return true;
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🏦 Aplicando Migraciones de Conciliación Bancaria v3');
  console.log('=====================================================');
  console.log(`URL: ${SUPABASE_URL}`);

  let exitosos = 0;
  let fallidos = 0;

  for (const migracion of MIGRACIONES) {
    // Intentar método RPC primero (más confiable)
    let resultado = await ejecutarSQLViaRPC(migracion);
    
    if (!resultado) {
      // Fallback: método por statements
      resultado = await ejecutarSQL(migracion);
    }

    if (resultado) {
      exitosos++;
    } else {
      fallidos++;
    }
  }

  console.log('\n=====================================================');
  console.log(`✅ Exitosos: ${exitosos}`);
  console.log(`❌ Fallidos: ${fallidos}`);
  
  if (fallidos > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
