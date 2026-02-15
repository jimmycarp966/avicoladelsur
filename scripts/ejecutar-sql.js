// Script simple para ejecutar SQL en Supabase usando la Management API
const fs = require('fs');
const https = require('https');

const PROJECT_REF = 'tvijhnglmryjmrstfvbv';
const TOKEN = 'sbp_3f640b43bed62c1338ef5f3dd93e47f2f35bfbd9';
const SQL_FILE = process.argv[2] || 'scripts/migracion_v3.sql';

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
