import { AvicolaMCPClient } from './client';
import path from 'path';

/**
 * Script de prueba para validar la arquitectura MCP
 * Intentará listar los archivos del directorio actual usando un servidor MCP
 */
async function testMCPConnection() {
    console.log('🧪 Iniciando prueba de conexión MCP...');

    // Usamos el servidor 'filesystem' oficial como prueba
    // En un caso real, esto sería el servidor de Google Maps o Sheets
    const client = new AvicolaMCPClient('Filesystem Test');

    try {
        // Conectar al servidor (asumiendo que npx está disponible)
        // Usamos el servidor @modelcontextprotocol/server-filesystem
        // Nota: Esto requiere que el usuario tenga Node.js instalado
        const projectRoot = path.resolve(process.cwd());
        console.log(`📂 Directorio base: ${projectRoot}`);

        await client.connectStdio('npx', [
            '-y',
            '@modelcontextprotocol/server-filesystem',
            projectRoot
        ]);

        // 1. Listar herramientas disponibles
        console.log('\n🛠️  Herramientas disponibles:');
        const tools = await client.listTools();
        tools.tools.forEach(tool => {
            console.log(`- ${tool.name}: ${tool.description}`);
        });

        // 2. Ejecutar una herramienta (Listar directorio)
        console.log('\n📂 Ejecutando herramienta list_directory...');
        const result = await client.callTool('list_directory', {
            path: projectRoot
        });

        console.log('✅ Resultado:', result);

    } catch (error) {
        console.error('❌ Error en la prueba:', error);
    } finally {
        await client.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

// Ejecutar si se llama directamente
testMCPConnection();
