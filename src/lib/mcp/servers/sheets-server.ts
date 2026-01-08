#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { google } from "googleapis";
import { getGoogleAuthClient } from "../../services/google-cloud/auth";

/**
 * Servidor MCP Personalizado para Google Sheets
 * Se integra nativamente con la autenticación de Avícola del Sur
 */
const server = new Server(
    {
        name: "avicola-sheets-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * Herramienta: Leer una hoja de cálculo
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "read_spreadsheet",
                description: "Lee datos de una hoja de cálculo de Google Sheets",
                inputSchema: zodToJsonSchema(
                    z.object({
                        spreadsheetId: z.string().describe("ID de la hoja de cálculo"),
                        range: z.string().describe("Rango a leer (ej: 'Hoja1!A1:D10')"),
                    })
                ),
            },
            {
                name: "create_spreadsheet",
                description: "Crea una nueva hoja de cálculo",
                inputSchema: zodToJsonSchema(
                    z.object({
                        title: z.string().describe("Título de la nueva hoja"),
                    })
                ),
            },
            {
                name: "get_spreadsheet_metadata",
                description: "Obtiene metadatos (título, hojas) de un spreadsheet",
                inputSchema: zodToJsonSchema(
                    z.object({
                        spreadsheetId: z.string().describe("ID de la hoja de cálculo"),
                    })
                )
            }
        ],
    };
});

/**
 * Manejador de llamadas a herramientas
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const auth = getGoogleAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    try {
        if (request.params.name === "read_spreadsheet") {
            const { spreadsheetId, range } = request.params.arguments as any;

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return { content: [{ type: "text", text: "No se encontraron datos." }] };
            }

            // 1. Verificar si hay filas vacías al principio
            const startRow = rows.findIndex(row => row.length > 0 && row.some(cell => cell.trim() !== ''));

            // 2. Si todo esta vacio, devolver mensaje
            if (startRow === -1) {
                return { content: [{ type: "text", text: "El rango está vacío." }] };
            }

            // 3. Obtener el header (primera fila no vacía)
            const headers = rows[startRow];

            // 4. Formatear como texto legible (Markdown Table o CSV-like)
            const dataRows = rows.slice(startRow + 1);

            // Construir una representación de texto simple
            let output = `Sheet Data (Rows: ${rows.length})\n`;
            output += headers.join(" | ") + "\n";
            output += headers.map(() => "---").join("|") + "\n";

            dataRows.forEach(row => {
                output += row.join(" | ") + "\n";
            });

            return {
                content: [
                    {
                        type: "text",
                        text: output,
                    },
                ],
            };
        }

        if (request.params.name === "create_spreadsheet") {
            const { title } = request.params.arguments as any;

            const response = await sheets.spreadsheets.create({
                requestBody: {
                    properties: {
                        title,
                    },
                },
            });

            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Hoja creada exitosamente.\nID: ${response.data.spreadsheetId}\nURL: ${response.data.spreadsheetUrl}`,
                    },
                ],
            };
        }

        if (request.params.name === "get_spreadsheet_metadata") {
            const { spreadsheetId } = request.params.arguments as any;
            const response = await sheets.spreadsheets.get({
                spreadsheetId
            });

            const info = {
                title: response.data.properties?.title,
                url: response.data.spreadsheetUrl,
                sheets: response.data.sheets?.map(s => s.properties?.title)
            };

            return {
                content: [{ type: "text", text: JSON.stringify(info, null, 2) }]
            };
        }

        throw new Error(`Herramienta desconocida: ${request.params.name}`);

    } catch (error: any) {
        console.error("Error en herramienta Sheets:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

// Iniciar servidor
const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
    console.error("Error iniciando servidor Sheets MCP:", err);
    process.exit(1);
});
