// Script simple para ejecutar SQL en Supabase usando la Management API.
// Requiere variables de entorno para evitar exponer tokens en el repositorio.
const fs = require('fs');
const https = require('https');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SQL_FILE = process.argv[2] || 'scripts/migracion_v3.sql';

if (!PROJECT_REF || !TOKEN) {
  throw new Error(
    'Faltan SUPABASE_PROJECT_REF o SUPABASE_ACCESS_TOKEN. Definelas en el entorno antes de ejecutar este script.'
  );
}

let sql = fs.readFileSync(SQL_FILE, 'utf-8');

// Limpiar el SQL
sql = sql
  .replace(/--.*$/gm, '') // Remover comentarios de línea
  .replace(/\/\*[\s\S]*?\*\//g, '') // Remover comentarios de bloque
  .replace(/^\s*[\r\n]/gm, '') // Remover líneas vacías
  .trim();

const payload = { query: sql };
const data = JSON.stringify(payload);

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/sql/execute`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('🚀 Ejecutando SQL en Supabase...');
console.log(`📄 Archivo: ${SQL_FILE}`);
console.log(`📊 Statements: ${sql.split(';').filter(s => s.trim().length > 10).length}`);

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log(`\n📊 Status: ${res.statusCode}`);
    
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ SQL ejecutado exitosamente!');
      if (responseData && responseData.trim()) {
        try {
          const json = JSON.parse(responseData);
          console.log('📋 Resultado:', JSON.stringify(json, null, 2).substring(0, 500));
        } catch {
          console.log('📋 Respuesta:', responseData.substring(0, 500));
        }
      }
    } else {
      console.error('❌ Error:');
      try {
        const err = JSON.parse(responseData);
        console.error(JSON.stringify(err, null, 2));
      } catch {
        console.error(responseData);
      }
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  process.exit(1);
});

req.write(data);
req.end();
