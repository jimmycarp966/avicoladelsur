import { AvicolaMCPClient } from './client';
import path from 'path';

/**
 * Script de prueba para conectar al Servidor MCP de Google Sheets
 */
async function testSheetsConnection() {
    console.log('🧪 Iniciando prueba de conexión a Google Sheets MCP...');

    const client = new AvicolaMCPClient('Google Sheets Integration');

    try {
        // Conectamos pasando las variables de entorno necesarias
        // Intentamos pasar la API KEY que el usuario nos acaba de dar o la de Maps
        const env = {
            ...process.env,
            GOOGLE_API_KEY:
                process.env.GOOGLE_GEMINI_API_KEY ||
                process.env.GEMINI_API_KEY ||
                process.env.GOOGLE_AI_API_KEY ||
                process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        };

        console.log('🔌 Conectando al servidor sheets-server.ts (LOCAL)...');

        // Ejecutamos nuestro propio servidor
        await client.connectStdio('npx', [
            'tsx',
            'src/lib/mcp/servers/sheets-server.ts'
        ], env as Record<string, string>);

        // 1. Listar herramientas
        console.log('\n🛠️  Herramientas de Sheets disponibles:');
        const tools = await client.listTools();

        if (tools.tools.length === 0) {
            console.warn('⚠️  No se encontraron herramientas. Verifica las credenciales.');
        } else {
            tools.tools.forEach(tool => {
                console.log(`- ${tool.name}: ${tool.description}`);
            });
        }

        // 2. Aquí podríamos intentar crear una hoja de prueba si tuvieramos herramientas de escritura
        // const result = await client.callTool('create_spreadsheet', { title: 'Prueba MCP Avícola' });
        // console.log('✅ Hoja creada:', result);

    } catch (error) {
        console.error('❌ Error en la prueba de Sheets:', error);
        console.error('💡 Verifica que la API de Google Sheets esté habilitada en tu proyecto de Cloud.');
    } finally {
        await client.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

testSheetsConnection();
