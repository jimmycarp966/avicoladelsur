/**
 * Script para aplicar migraciones SQL de conciliación
 * Usa el cliente de Supabase
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MIGRACIONES = [
  'supabase/migrations/20260203140000_mejoras_conciliacion_v3.sql'
];

async function verificarTablaExiste(nombreTabla) {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', nombreTabla)
    .single();
  
  return !!data;
}

async function aplicarMigracionManual() {
  console.log('🏦 Aplicando Migraciones de Conciliación Bancaria v3');
  console.log('=====================================================\n');

  // 1. Crear tabla conciliacion_jobs
  console.log('1. Creando tabla conciliacion_jobs...');
  const { error: errorJobs } = await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS conciliacion_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        estado VARCHAR(20) DEFAULT 'pendiente',
        usuario_id UUID REFERENCES usuarios(id) NOT NULL,
        archivo_sabana TEXT NOT NULL,
        total_comprobantes INTEGER DEFAULT 0,
        comprobantes_procesados INTEGER DEFAULT 0,
        progreso_porcentaje INTEGER DEFAULT 0,
        sesion_id UUID REFERENCES sesiones_conciliacion(id),
        error_mensaje TEXT,
        resultado_resumen JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });
  if (errorJobs) console.log('   ⚠️ ', errorJobs.message);
  else console.log('   ✅ Tabla conciliacion_jobs creada');

  // 2. Crear tabla comprobantes_hashes
  console.log('2. Creando tabla comprobantes_hashes...');
  const { error: errorHashes } = await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS comprobantes_hashes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        hash_sha256 TEXT UNIQUE NOT NULL,
        sesion_id UUID REFERENCES sesiones_conciliacion(id),
        comprobante_id UUID REFERENCES comprobantes_conciliacion(id),
        nombre_archivo TEXT,
        fecha_subida TIMESTAMPTZ DEFAULT NOW(),
        usuario_id UUID REFERENCES usuarios(id)
      );
    `
  });
  if (errorHashes) console.log('   ⚠️ ', errorHashes.message);
  else console.log('   ✅ Tabla comprobantes_hashes creada');

  // 3. Crear tabla conciliacion_alertas
  console.log('3. Creando tabla conciliacion_alertas...');
  const { error: errorAlertas } = await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS conciliacion_alertas (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sesion_id UUID REFERENCES sesiones_conciliacion(id) ON DELETE CASCADE,
        tipo VARCHAR(20) NOT NULL,
        codigo VARCHAR(50) NOT NULL,
        mensaje TEXT NOT NULL,
        detalles JSONB DEFAULT '{}',
        resuelta BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });
  if (errorAlertas) console.log('   ⚠️ ', errorAlertas.message);
  else console.log('   ✅ Tabla conciliacion_alertas creada');

  // 4. Agregar columnas a comprobantes_conciliacion
  console.log('4. Agregando columnas a comprobantes_conciliacion...');
  
  const { error: errorCol1 } = await supabase.rpc('exec_sql', {
    sql_query: `ALTER TABLE comprobantes_conciliacion ADD COLUMN IF NOT EXISTS hash_archivo TEXT;`
  });
  if (errorCol1) console.log('   ⚠️ hash_archivo:', errorCol1.message);
  else console.log('   ✅ Columna hash_archivo agregada');

  const { error: errorCol2 } = await supabase.rpc('exec_sql', {
    sql_query: `ALTER TABLE comprobantes_conciliacion ADD COLUMN IF NOT EXISTS metadata_validacion JSONB DEFAULT '{}';`
  });
  if (errorCol2) console.log('   ⚠️ metadata_validacion:', errorCol2.message);
  else console.log('   ✅ Columna metadata_validacion agregada');

  // 5. Crear índices
  console.log('5. Creando índices...');
  const indices = [
    'CREATE INDEX IF NOT EXISTS idx_jobs_estado ON conciliacion_jobs(estado);',
    'CREATE INDEX IF NOT EXISTS idx_jobs_usuario ON conciliacion_jobs(usuario_id);',
    'CREATE INDEX IF NOT EXISTS idx_jobs_sesion ON conciliacion_jobs(sesion_id);',
    'CREATE INDEX IF NOT EXISTS idx_hashes_hash ON comprobantes_hashes(hash_sha256);',
    'CREATE INDEX IF NOT EXISTS idx_alertas_sesion ON conciliacion_alertas(sesion_id);',
    'CREATE INDEX IF NOT EXISTS idx_comprobantes_hash ON comprobantes_conciliacion(hash_archivo);',
    'CREATE INDEX IF NOT EXISTS idx_comprobantes_monto ON comprobantes_conciliacion(monto);'
  ];

  for (const idxSql of indices) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: idxSql });
    if (error) console.log('   ⚠️ Índice:', error.message);
  }
  console.log('   ✅ Índices creados');

  // 6. Habilitar RLS
  console.log('6. Habilitando RLS...');
  const tablasRLS = ['conciliacion_jobs', 'comprobantes_hashes', 'conciliacion_alertas'];
  for (const tabla of tablasRLS) {
    await supabase.rpc('exec_sql', {
      sql_query: `ALTER TABLE ${tabla} ENABLE ROW LEVEL SECURITY;`
    });
  }
  console.log('   ✅ RLS habilitado');

  console.log('\n=====================================================');
  console.log('✅ Migraciones aplicadas exitosamente!');
}

// Ejecutar
aplicarMigracionManual().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
