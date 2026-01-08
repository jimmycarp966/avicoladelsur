/**
 * Hub de Servidores MCP - Avícola del Sur
 * 
 * Configuración centralizada de todos los servidores MCP disponibles
 * para integración con agentes de IA.
 * 
 * @see https://modelcontextprotocol.io/
 */

export interface MCPServerConfig {
    name: string
    description: string
    type: 'builtin' | 'google-cloud' | 'custom'
    command: string
    args: string[]
    env?: Record<string, string>
    enabled: boolean
}

/**
 * Configuración de servidores MCP disponibles
 */
export const MCP_SERVERS: MCPServerConfig[] = [
    // =============================================
    // Servidores Personalizados (internos)
    // =============================================
    {
        name: 'avicola-sheets',
        description: 'Servidor MCP personalizado para Google Sheets integrado con autenticación propia',
        type: 'custom',
        command: 'npx',
        args: ['tsx', 'src/lib/mcp/servers/sheets-server.ts'],
        enabled: true,
    },

    // =============================================
    // Servidores Oficiales de Google Cloud
    // =============================================
    {
        name: 'google-storage',
        description: 'Google Cloud Storage MCP - Gestión de buckets y archivos (PDFs, comprobantes)',
        type: 'google-cloud',
        command: 'npx',
        args: ['-y', '@google-cloud/storage-mcp'],
        env: {
            GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH || '',
        },
        enabled: true,
    },
    {
        name: 'google-gcloud',
        description: 'Google Cloud CLI MCP - Gestión de infraestructura cloud',
        type: 'google-cloud',
        command: 'npx',
        args: ['-y', '@google-cloud/gcloud-mcp'],
        enabled: false, // Habilitar solo si se necesita gestión de infra
    },
    {
        name: 'google-observability',
        description: 'Google Cloud Observability MCP - Logs, métricas y trazas',
        type: 'google-cloud',
        command: 'npx',
        args: ['-y', '@google-cloud/observability-mcp'],
        enabled: false, // Habilitar para debugging avanzado
    },

    // =============================================
    // Servidores de Terceros
    // =============================================
    {
        name: 'supabase',
        description: 'Supabase MCP - Gestión de base de datos vía IA',
        type: 'builtin',
        command: 'supabase-mcp-server', // Ya configurado en el entorno
        args: [],
        enabled: true,
    },
]

/**
 * Obtiene la configuración de un servidor MCP por nombre
 */
export function getMCPServer(name: string): MCPServerConfig | undefined {
    return MCP_SERVERS.find(s => s.name === name)
}

/**
 * Obtiene todos los servidores MCP habilitados
 */
export function getEnabledMCPServers(): MCPServerConfig[] {
    return MCP_SERVERS.filter(s => s.enabled)
}

/**
 * Categorías de uso recomendado por servidor
 */
export const MCP_USE_CASES = {
    'avicola-sheets': [
        'Leer datos de hojas de cálculo de proveedores',
        'Exportar reportes a Google Sheets',
        'Importar listas de precios',
    ],
    'google-storage': [
        'Gestionar comprobantes de pago (subir, listar)',
        'Almacenar PDFs de facturas y reportes',
        'Gestionar firmas digitales de entregas',
    ],
    'supabase': [
        'Consultas de datos en lenguaje natural',
        'Crear migraciones asistidas por IA',
        'Análisis de estructura de base de datos',
    ],
}
