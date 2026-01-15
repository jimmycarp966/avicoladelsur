---
name: erp-ventas-chatbot
description: Gestión de preventa, presupuestos y Bot WhatsApp con Vertex AI. Usar al modificar módulo de Ventas/CRM/Bot.
---

# ERP Ventas y Chatbot

Optimiza captación y cierre de ventas.

## WhatsApp Bot
1. **Provider**: Respetar `WHATSAPP_PROVIDER=twilio` (no Meta)
2. **Bypass RLS**: Usar `createAdminClient()` con `fn_crear_presupuesto_desde_bot`
3. **Memory Bank**: Persistir en `bot_sessions.customer_context`
   - productos_frecuentes, preferencias, metadata

## Presupuestos → Pedidos
- **Bloqueo Pesaje**: "Pasar a Pedidos" deshabilitado si hay pesables sin peso
- **Listas de Precios**: Validar asignación correcta (ej. "MAYORISTA")
- **Conversión**: `fn_convertir_presupuesto_a_pedido` respeta `peso_final`

## Tablas Clave
- `presupuestos`: Cotizaciones activas
- `presupuesto_items`: Detalle con indicadores de stock
- `clientes`: CRM completo
- `listas_precios`: Precios dinámicos con vigencia

## Bot Tools (Vertex AI)
- crear-presupuesto
- consultar-stock
- consultar-estado
- consultar-saldo
- crear-reclamo

## Debugging Bot WhatsApp

### Symptom: Bot no responde

**Check 1: Twilio webhook recibe mensajes**
```typescript
// src/app/api/bot/route.ts
export async function POST(req: Request) {
  console.log('[Bot] Webhook recibido');

  const body = await req.json();
  console.log('[Bot] Body:', JSON.stringify(body, null, 2));

  const { From, Body, MessageSid } = body;

  console.log('[Bot] De:', From);
  console.log('[Bot] Mensaje:', Body);
  console.log('[Bot] SID:', MessageSid);

  // ... procesar mensaje
}
```

**Check 2: Vertex AI se inicializa correctamente**
```typescript
// src/lib/vertex/agent.ts
import { VertexAI } from '@google-cloud/vertexai';

console.log('[Vertex] Inicializando...');
console.log('[Vertex] Project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
console.log('[Vertex] Model:', process.env.GEMINI_MODEL_FLASH);

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
  location: 'us-central1',
});

const model = vertexAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL_FLASH!,
});

console.log('[Vertex] Modelo inicializado:', model);
```

**Check 3: Tools están registradas**
```typescript
// src/lib/vertex/tools/index.ts
const tools = {
  'consultar-stock': {
    description: 'Consulta el stock disponible de un producto',
    parameters: { /* ... */ },
    execute: async (args) => {
      console.log('[Tool] consultar-stock ejecutado:', args);
      const result = await consultarStock(args);
      console.log('[Tool] Resultado:', result);
      return result;
    }
  },
  // ... otras tools
};

console.log('[Vertex] Tools registradas:', Object.keys(tools));
```

### Symptom: Bot responde incorrectamente

**Check 1: System prompt está configurado**
```typescript
// src/lib/vertex/prompts/system-prompt.ts
export const SYSTEM_PROMPT = `
Eres un asistente virtual de Avícola del Sur.

## Personalidad
- Hablás en español argentino de Tucumán
- Usás "vos" en lugar de "tú"
- Sos amable y servicial

## Productos
- Pollo entero: $5.000/kg
- Pollo en presas: $5.500/kg
- Menudencias: $2.000/kg
- Chorizos de pollo: $4.500/kg

## Lo que podés hacer
- Consultar stock
- Crear presupuestos
- Consultar estado de pedidos
- Consultar saldo
- Crear reclamos
`;

console.log('[Vertex] System prompt configurado');
```

**Check 2: Memory Bank funciona**
```typescript
// src/lib/vertex/session-manager.ts
async function getCustomerContext(phoneNumber: string): Promise<CustomerContext> {
  console.log('[Session] Obteniendo contexto para:', phoneNumber);

  const { data, error } = await supabase
    .from('bot_sessions')
    .select('context')
    .eq('phone_number', phoneNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('[Session] Error obteniendo contexto:', error);
    return { productos_frecuentes: [], preferencias: {}, metadata: {} };
  }

  console.log('[Session] Contexto:', JSON.stringify(data?.context, null, 2));
  return data?.context || { productos_frecuentes: [], preferencias: {}, metadata: {} };
}

async function updateCustomerContext(
  phoneNumber: string,
  context: CustomerContext
): Promise<void> {
  console.log('[Session] Actualizando contexto para:', phoneNumber);
  console.log('[Session] Nuevo contexto:', JSON.stringify(context, null, 2));

  const { error } = await supabase
    .from('bot_sessions')
    .upsert({
      phone_number: phoneNumber,
      context,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
    });

  if (error) {
    console.error('[Session] Error actualizando contexto:', error);
  }
}
```

### Symptom: Tool no se ejecuta

**Check 1: Tool parameters son correctos**
```typescript
// src/lib/vertex/tools/consultar-stock.ts
export const consultarStockTool = {
  name: 'consultar-stock',
  description: 'Consulta el stock disponible de un producto específico',
  parameters: {
    type: 'object',
    properties: {
      producto_codigo: {
        type: 'string',
        description: 'Código del producto (ej: POLLO001, PRESAS001, MENUD001)',
        enum: ['POLLO001', 'PRESAS001', 'MENUD001', 'CHORI001']
      }
    },
    required: ['producto_codigo']
  },
  execute: async (args: { producto_codigo: string }) => {
    console.log('[Tool] consultar-stock ejecutado con args:', args);

    const { producto_codigo } = args;

    // Validar código
    if (!['POLLO001', 'PRESAS001', 'MENUD001', 'CHORI001'].includes(producto_codigo)) {
      console.error('[Tool] Código inválido:', producto_codigo);
      throw new Error(`Código de producto inválido: ${producto_codigo}`);
    }

    // Consultar stock
    const { data, error } = await supabase
      .from('productos_con_stock')
      .select('*')
      .eq('codigo', producto_codigo)
      .single();

    if (error) {
      console.error('[Tool] Error consultando stock:', error);
      throw new Error('Error consultando stock');
    }

    console.log('[Tool] Stock consultado:', data);

    return {
      producto: data.nombre,
      stock: data.stock_disponible,
      unidad: data.unidad
    };
  }
};
```

**Check 2: Tool se invoca correctamente**
```typescript
// src/lib/vertex/agent.ts
async function invokeTool(toolName: string, args: any): Promise<any> {
  console.log('[Agent] Invocando tool:', toolName);
  console.log('[Agent] Args:', JSON.stringify(args, null, 2));

  const tool = tools[toolName];

  if (!tool) {
    console.error('[Agent] Tool no encontrada:', toolName);
    throw new Error(`Tool no encontrada: ${toolName}`);
  }

  try {
    const result = await tool.execute(args);
    console.log('[Agent] Tool ejecutada exitosamente');
    console.log('[Agent] Resultado:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[Agent] Error ejecutando tool:', error);
    throw error;
  }
}
```

## Debugging Presupuestos

### Symptom: Presupuesto no se crea desde el bot

**Check 1: RPC se ejecuta con admin client**
```typescript
// src/lib/vertex/tools/crear-presupuesto.ts
import { createAdminClient } from '@/lib/supabase/admin';

export async function crearPresupuestoDesdeBot(args: CrearPresupuestoArgs) {
  console.log('[Bot] Creando presupuesto desde bot:', args);

  // Usar admin client para bypass RLS
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.rpc('fn_crear_presupuesto_desde_bot', {
    p_cliente_id: args.cliente_id,
    p_items: args.items
  });

  if (error) {
    console.error('[Bot] Error RPC:', error);
    throw new Error(error.message);
  }

  console.log('[Bot] Presupuesto creado:', data);
  return data;
}
```

**Check 2: Cliente existe y es válido**
```typescript
// src/lib/vertex/tools/crear-presupuesto.ts
async function validarCliente(clienteId: string): Promise<boolean> {
  console.log('[Bot] Validando cliente:', clientId);

  const { data, error } = await supabase
    .from('clientes')
    .select('id, activo')
    .eq('id', clientId)
    .single();

  if (error || !data) {
    console.error('[Bot] Cliente no encontrado:', error);
    return false;
  }

  if (!data.activo) {
    console.error('[Bot] Cliente inactivo');
    return false;
  }

  console.log('[Bot] Cliente válido');
  return true;
}
```

## Debugging Conversión Presupuesto → Pedido

### Symptom: Conversión falla

**Check 1: Stock disponible**
```typescript
// src/actions/convertir-presupuesto.ts
export async function convertirPresupuestoAPedidoAction(args: {
  presupuestoId: string;
  usuarioId: string;
}) {
  console.log('[Presupuesto] Convirtiendo a pedido:', args);

  // Verificar stock
  const { data: presupuesto } = await supabase
    .from('presupuestos')
    .select(`
      *,
      presupuesto_items (
        producto_id,
        cantidad,
        stock_disponible
      )
    `)
    .eq('id', args.presupuestoId)
    .single();

  const itemsSinStock = presupuesto.presupuesto_items.filter(
    item => item.stock_disponible < item.cantidad
  );

  if (itemsSinStock.length > 0) {
    console.error('[Presupuesto] Items sin stock:', itemsSinStock);
    throw new Error('Stock insuficiente para algunos items');
  }

  console.log('[Presupuesto] Stock verificado OK');

  // Convertir
  const { data, error } = await supabase.rpc('fn_convertir_presupuesto_a_pedido', {
    p_presupuesto_id: args.presupuestoId,
    p_usuario_id: args.usuarioId
  });

  if (error) {
    console.error('[Presupuesto] Error RPC:', error);
    throw new Error(error.message);
  }

  console.log('[Presupuesto] Pedido creado:', data);
  return data;
}
```

## Optimización de Queries

### Index para presupuestos
```sql
-- Índice para búsquedas por cliente y estado
CREATE INDEX idx_presupuestos_cliente_estado
ON presupuestos(cliente_id, estado, created_at DESC);

-- Índice para búsquedas por vendedor
CREATE INDEX idx_presupuestos_vendedor
ON presupuestos(vendedor_id, created_at DESC);

-- Índice para items de presupuesto
CREATE INDEX idx_presupuesto_items_presupuesto
ON presupuesto_items(presupuesto_id);
```

### Batch operations
```typescript
// En lugar de insertar items uno por uno
for (const item of items) {
  await supabase.from('presupuesto_items').insert(item);
}

// Usar batch insert
await supabase.from('presupuesto_items').insert(items);
```

## Related Skills
- **avicola-prompt-engineering** - Prompts para Vertex AI
- **avicola-systematic-debugging** - Debugging bot
- **supabase-rls-audit** - RLS para bypass admin
