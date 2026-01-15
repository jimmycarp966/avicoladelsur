---
name: avicola-mcp-builder
description: MCP (Model Context Protocol) builder guide for Avícola del Sur ERP. Building MCP servers for Google Maps, OpenRouteService, Vertex AI, Supabase. Use when creating new integrations or external API connections.
---

# Avícola del Sur - MCP Builder

Comprehensive guide for building MCP (Model Context Protocol) servers for the Avícola del Sur ERP system.

## What is MCP?

MCP (Model Context Protocol) is a protocol that allows AI models to interact with external systems through standardized tools. It enables:

- **Tool Discovery**: AI can discover available capabilities
- **Structured I/O**: Type-safe input/output
- **Error Handling**: Standardized error responses
- **Authentication**: Secure access control

## MCP Servers for Avícola del Sur

### 1. Google Maps MCP Server

**Purpose**: Provide map rendering, geocoding, and directions for the Reparto module.

**Server Structure**:
```typescript
// mcp-servers/google-maps/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'google-maps-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'geocode',
        description: 'Convert address to latitude/longitude coordinates',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Address to geocode (e.g., "San Martín 123, Tucumán")',
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'reverse-geocode',
        description: 'Convert latitude/longitude to address',
        inputSchema: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              description: 'Latitude',
            },
            lng: {
              type: 'number',
              description: 'Longitude',
            },
          },
          required: ['lat', 'lng'],
        },
      },
      {
        name: 'get-directions',
        description: 'Get driving directions between two points',
        inputSchema: {
          type: 'object',
          properties: {
            origin: {
              type: 'string',
              description: 'Origin address or "lat,lng"',
            },
            destination: {
              type: 'string',
              description: 'Destination address or "lat,lng"',
            },
            waypoints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional waypoints',
            },
          },
          required: ['origin', 'destination'],
        },
      },
      {
        name: 'get-static-map',
        description: 'Get a static map image URL with markers and polylines',
        inputSchema: {
          type: 'object',
          properties: {
            center: {
              type: 'string',
              description: 'Center point "lat,lng"',
            },
            zoom: {
              type: 'number',
              description: 'Zoom level (1-20)',
              default: 13,
            },
            markers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                  label: { type: 'string' },
                  color: { type: 'string', default: 'red' },
                },
              },
            },
            polyline: {
              type: 'string',
              description: 'Encoded polyline',
            },
          },
          required: ['center'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'geocode':
        return await geocode(args.address);
      case 'reverse-geocode':
        return await reverseGeocode(args.lat, args.lng);
      case 'get-directions':
        return await getDirections(args.origin, args.destination, args.waypoints);
      case 'get-static-map':
        return await getStaticMap(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }),
        },
      ],
      isError: true,
    };
  }
});

// Tool implementations
async function geocode(address: string) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  );
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const { lat, lng } = data.results[0].geometry.location;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ lat, lng, formatted_address: data.results[0].formatted_address }),
      },
    ],
  };
}

async function getDirections(origin: string, destination: string, waypoints?: string[]) {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.append('origin', origin);
  url.searchParams.append('destination', destination);
  url.searchParams.append('key', process.env.GOOGLE_MAPS_API_KEY!);
  
  if (waypoints && waypoints.length > 0) {
    url.searchParams.append('waypoints', waypoints.join('|'));
  }

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Directions failed: ${data.status}`);
  }

  const route = data.routes[0];
  const steps = route.legs[0].steps.map((step: any) => ({
    instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
    distance: step.distance.text,
    duration: step.duration.text,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          summary: route.summary,
          distance: route.legs[0].distance.text,
          duration: route.legs[0].duration.text,
          polyline: route.overview_polyline.points,
          steps,
        }),
      },
    ],
  };
}

async function getStaticMap(args: any) {
  const params = new URLSearchParams();
  params.append('center', args.center);
  params.append('zoom', args.zoom?.toString() || '13');
  params.append('size', '600x400');
  params.append('key', process.env.GOOGLE_MAPS_API_KEY!);

  // Add markers
  if (args.markers && args.markers.length > 0) {
    const markerParams = args.markers.map((m: any) => 
      `${m.lat},${m.lng}${m.label ? `,label:${m.label}` : ''}${m.color ? `,color:${m.color}` : ''}`
    );
    params.append('markers', markerParams.join('|'));
  }

  // Add polyline
  if (args.polyline) {
    params.append('path', `enc:${args.polyline}`);
  }

  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ url }),
      },
    ],
  };
}

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Package.json**:
```json
{
  "name": "google-maps-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 2. OpenRouteService MCP Server

**Purpose**: Provide route optimization for the Reparto module (fallback when Google Maps fails).

**Server Structure**:
```typescript
// mcp-servers/openrouteservice/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'openrouteservice-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'optimize-route',
        description: 'Optimize route using OpenRouteService (Nearest Neighbor + 2-opt)',
        inputSchema: {
          type: 'object',
          properties: {
            coordinates: {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2,
              },
              description: 'Array of [longitude, latitude] coordinates',
            },
            profile: {
              type: 'string',
              description: 'Routing profile (driving-car, driving-hgv, cycling-regular, foot-walking)',
              default: 'driving-car',
            },
          },
          required: ['coordinates'],
        },
      },
      {
        name: 'get-matrix',
        description: 'Get distance/duration matrix between multiple points',
        inputSchema: {
          type: 'object',
          properties: {
            coordinates: {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2,
              },
            },
            profile: {
              type: 'string',
              default: 'driving-car',
            },
          },
          required: ['coordinates'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'optimize-route':
        return await optimizeRoute(args.coordinates, args.profile);
      case 'get-matrix':
        return await getMatrix(args.coordinates, args.profile);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }),
        },
      ],
      isError: true,
    };
  }
});

async function optimizeRoute(coordinates: number[][], profile: string = 'driving-car') {
  // Use ORS optimization endpoint
  const response = await fetch('https://api.openrouteservice.org/optimization', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.OPENROUTESERVICE_API_KEY!,
    },
    body: JSON.stringify({
      jobs: coordinates.slice(1).map((coord, index) => ({
        id: index + 1,
        location: coord,
      })),
      vehicles: [{
        id: 1,
        start: coordinates[0],
        end: coordinates[0],
        profile,
      }],
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`ORS optimization failed: ${data.error}`);
  }

  const route = data.routes[0];
  const order = route.steps.map((step: any) => step.location);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          order,
          distance: route.summary.distance,
          duration: route.summary.duration,
          geometry: route.geometry,
        }),
      },
    ],
  };
}

async function getMatrix(coordinates: number[][], profile: string = 'driving-car') {
  const response = await fetch('https://api.openrouteservice.org/v2/matrix/' + profile, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.OPENROUTESERVICE_API_KEY!,
    },
    body: JSON.stringify({
      locations: coordinates,
      metrics: ['distance', 'duration'],
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`ORS matrix failed: ${data.error}`);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          distances: data.distances,
          durations: data.durations,
        }),
      },
    ],
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3. Vertex AI MCP Server

**Purpose**: Provide AI capabilities for the WhatsApp bot and bank reconciliation.

**Server Structure**:
```typescript
// mcp-servers/vertex-ai/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
});

const server = new Server(
  {
    name: 'vertex-ai-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'generate-content',
        description: 'Generate content using Gemini AI',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Text prompt for generation',
            },
            model: {
              type: 'string',
              description: 'Model name (gemini-1.5-flash, gemini-1.5-pro)',
              default: 'gemini-1.5-flash',
            },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens to generate',
              default: 1024,
            },
            temperature: {
              type: 'number',
              description: 'Temperature (0.0-1.0)',
              default: 0.7,
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'parse-bank-statement',
        description: 'Parse bank statement PDF/CSV and extract transactions',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Bank statement content (text or base64 PDF)',
            },
            format: {
              type: 'string',
              description: 'Format (text, pdf, csv)',
              default: 'text',
            },
          },
          required: ['content'],
        },
      },
      {
        name: 'match-transactions',
        description: 'Match bank transactions with caja movements',
        inputSchema: {
          type: 'object',
          properties: {
            bankTransaction: {
              type: 'object',
              properties: {
                fecha: { type: 'string' },
                monto: { type: 'number' },
                descripcion: { type: 'string' },
                referencia: { type: 'string' },
              },
            },
            cajaMovements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  cliente_id: { type: 'string' },
                  cliente_nombre: { type: 'string' },
                  monto: { type: 'number' },
                  fecha: { type: 'string' },
                },
              },
            },
          },
          required: ['bankTransaction', 'cajaMovements'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'generate-content':
        return await generateContent(args);
      case 'parse-bank-statement':
        return await parseBankStatement(args);
      case 'match-transactions':
        return await matchTransactions(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }),
        },
      ],
      isError: true,
    };
  }
});

async function generateContent(args: any) {
  const model = vertexAI.getGenerativeModel({
    model: args.model || 'gemini-1.5-flash',
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: args.prompt }] }],
    generationConfig: {
      maxOutputTokens: args.maxTokens || 1024,
      temperature: args.temperature || 0.7,
    },
  });

  const response = result.response;
  const text = response.candidates[0].content.parts[0].text;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ text }),
      },
    ],
  };
}

async function parseBankStatement(args: any) {
  const prompt = `
Parse the following bank statement and extract deposit transactions.

Format: ${args.format}

Content:
${args.content}

Extract: fecha, monto, descripcion, referencia
Return as JSON array.
`;

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.1,
    },
  });

  const text = result.response.candidates[0].content.parts[0].text;
  const transactions = JSON.parse(text);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ transactions }),
      },
    ],
  };
}

async function matchTransactions(args: any) {
  const prompt = `
Match this bank transaction with caja movements:

Bank Transaction:
${JSON.stringify(args.bankTransaction, null, 2)}

Caja Movements:
${JSON.stringify(args.cajaMovements, null, 2)}

Return: matches array with similarity scores, best_match
`;

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.3,
    },
  });

  const text = result.response.candidates[0].content.parts[0].text;
  const matches = JSON.parse(text);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(matches),
      },
    ],
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 4. Supabase MCP Server

**Purpose**: Provide database access with RLS enforcement.

**Server Structure**:
```typescript
// mcp-servers/supabase/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const server = new Server(
  {
    name: 'supabase-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'execute-rpc',
        description: 'Execute a PostgreSQL RPC function',
        inputSchema: {
          type: 'object',
          properties: {
            functionName: {
              type: 'string',
              description: 'Name of the RPC function',
            },
            params: {
              type: 'object',
              description: 'Parameters for the RPC function',
            },
          },
          required: ['functionName'],
        },
      },
      {
        name: 'query-table',
        description: 'Query a table with filters',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name',
            },
            select: {
              type: 'string',
              description: 'Columns to select (comma-separated or "*")',
              default: '*',
            },
            filters: {
              type: 'object',
              description: 'Filter conditions',
            },
            orderBy: {
              type: 'string',
              description: 'Order by column',
            },
            limit: {
              type: 'number',
              description: 'Limit results',
            },
          },
          required: ['table'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'execute-rpc':
        return await executeRPC(args.functionName, args.params);
      case 'query-table':
        return await queryTable(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }),
        },
      ],
      isError: true,
    };
  }
});

async function executeRPC(functionName: string, params: any) {
  const { data, error } = await supabase.rpc(functionName, params);

  if (error) {
    throw new Error(`RPC error: ${error.message}`);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ data }),
      },
    ],
  };
}

async function queryTable(args: any) {
  let query = supabase.from(args.table).select(args.select);

  if (args.filters) {
    Object.entries(args.filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }

  if (args.orderBy) {
    query = query.order(args.orderBy);
  }

  if (args.limit) {
    query = query.limit(args.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Query error: ${error.message}`);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ data }),
      },
    ],
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
```

## MCP Configuration

### Configuring MCP Servers in Windsurf

```json
// .windsurf/mcp-config.json
{
  "mcpServers": {
    "google-maps": {
      "command": "node",
      "args": ["mcp-servers/google-maps/dist/index.js"],
      "env": {
        "GOOGLE_MAPS_API_KEY": "${GOOGLE_MAPS_API_KEY}"
      }
    },
    "openrouteservice": {
      "command": "node",
      "args": ["mcp-servers/openrouteservice/dist/index.js"],
      "env": {
        "OPENROUTESERVICE_API_KEY": "${OPENROUTESERVICE_API_KEY}"
      }
    },
    "vertex-ai": {
      "command": "node",
      "args": ["mcp-servers/vertex-ai/dist/index.js"],
      "env": {
        "GOOGLE_CLOUD_PROJECT_ID": "${GOOGLE_CLOUD_PROJECT_ID}",
        "GOOGLE_CLOUD_LOCATION": "us-central1"
      }
    },
    "supabase": {
      "command": "node",
      "args": ["mcp-servers/supabase/dist/index.js"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}"
      }
    }
  }
}
```

## Using MCP Tools in Server Actions

```typescript
// Example: Using Google Maps MCP in a Server Action
'use server';

import { mcpCall } from '@/lib/mcp/client';

export async function geocodificarDireccion(direccion: string) {
  const result = await mcpCall('google-maps', 'geocode', {
    address: direccion,
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return JSON.parse(result.text);
}

export async function obtenerRuta(origen: string, destino: string) {
  const result = await mcpCall('google-maps', 'get-directions', {
    origin: origen,
    destination: destino,
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return JSON.parse(result.text);
}
```

## Testing MCP Servers

```typescript
// Test Google Maps MCP
describe('Google Maps MCP', () => {
  it('should geocode address', async () => {
    const result = await mcpCall('google-maps', 'geocode', {
      address: 'San Martín 123, Tucumán',
    });

    expect(result.error).toBeUndefined();
    const data = JSON.parse(result.text);
    expect(data.lat).toBeDefined();
    expect(data.lng).toBeDefined();
  });

  it('should get directions', async () => {
    const result = await mcpCall('google-maps', 'get-directions', {
      origin: '-26.8241,-65.2226',
      destination: '-26.8350,-65.2070',
    });

    expect(result.error).toBeUndefined();
    const data = JSON.parse(result.text);
    expect(data.polyline).toBeDefined();
    expect(data.steps).toBeDefined();
  });
});
```

## Quick Reference

| MCP Server | Tools | Use Case |
|------------|-------|----------|
| google-maps | geocode, reverse-geocode, get-directions, get-static-map | Reparto GPS, navigation |
| openrouteservice | optimize-route, get-matrix | Route optimization fallback |
| vertex-ai | generate-content, parse-bank-statement, match-transactions | Bot, reconciliation |
| supabase | execute-rpc, query-table | Database access |

## Related Skills

- **erp-reparto** - GPS and routing implementation
- **erp-tesoreria** - Reconciliation with Vertex AI
- **erp-ventas-chatbot** - Bot with Vertex AI
