import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

/**
 * Cliente MCP Base para Avícola del Sur
 * Gestiona conexiones a servidores MCP (Google Maps, Sheets, etc.)
 */
export class AvicolaMCPClient {
    private client: Client;
    private transport: StdioClientTransport | null = null;
    private serverName: string;

    constructor(serverName: string) {
        this.serverName = serverName;
        this.client = new Client(
            {
                name: "avicola-erp-client",
                version: "1.0.0",
            },
            {
                capabilities: {
                    prompts: {},
                    resources: {},
                    tools: {},
                },
            }
        );
    }

    /**
     * Conecta a un servidor MCP local o remoto
     * @param command Comando para ejecutar el servidor (ej: 'npx')
     * @param args Argumentos del comando
     */
    async connectStdio(command: string, args: string[]) {
        try {
            this.transport = new StdioClientTransport({
                command,
                args,
            });

            await this.client.connect(this.transport);
            console.log(`[MCP] Conectado a ${this.serverName}`);
        } catch (error) {
            console.error(`[MCP] Error conectando a ${this.serverName}:`, error);
            throw error;
        }
    }

    /**
     * Lista las herramientas disponibles en el servidor
     */
    async listTools() {
        return await this.client.listTools();
    }

    /**
     * Ejecuta una herramienta específica
     */
    async callTool(name: string, args: Record<string, any>) {
        return await this.client.callTool({
            name,
            arguments: args,
        });
    }

    /**
     * Cierra la conexión
     */
    async close() {
        if (this.transport) {
            await this.transport.close();
        }
    }
}
