# Arquitectura: Migración a Vertex AI Agent Builder para Bot WhatsApp

## Resumen Ejecutivo

Migración del bot WhatsApp actual (Gemini Flash simple) a **Vertex AI Agent Builder** con:
- **Memoria conversacional** (Sessions)
- **RAG Engine** integrado con Supabase
- **ADK TypeScript** para lógica personalizada
- **Gemini 3 Pro** para razonamiento complejo

---

## Arquitectura de Alto Nivel

```
┌─────────────────┐
│  Cliente        │
│  WhatsApp       │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────┐
│  Twilio Webhook                     │
│  (POST /api/bot)                    │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│  Vertex AI Agent Engine             │
│  - Agent Development Kit (ADK)      │
│  - Gemini 3 Pro / Flash             │
│  - Sessions (memoria)               │
│  - RAG Engine                       │
└────────┬────────────────────────────┘
         │
         ├────────────────────────────┐
         │                            │
         ↓                            ↓
┌─────────────────┐          ┌─────────────────┐
│  Supabase       │          │  Lógica Custom  │
│  - RAG Sources  │          │  - Validaciones │
│  - Historial    │          │  - RPCs         │
│  - Catálogo     │          │  - Reglas       │
└─────────────────┘          └─────────────────┘
```

---

## Componentes Principales

### 1. Vertex AI Agent Engine

**Responsabilidades:**
- Orquestar conversación con memoria
- Ejecutar herramientas (tools) del ADK
- Mantener contexto entre mensajes
- Evaluar calidad de respuestas

**Configuración:**
```typescript
// src/lib/vertex/agent-config.ts
import { Agent } from '@google-cloud/vertexai-agent-builder'

export const avicolaAgent = new Agent({
  name: 'avicola-whatsapp-agent',
  model: 'gemini-3-pro', // Razonamiento complejo
  fallbackModel: 'gemini-2-5-flash', // Respuestas rápidas
  tools: [
    'crear-presupuesto',
    'consultar-stock',
    'consultar-estado-pedido',
    'consultar-cuenta-corriente',
    'crear-reclamo'
  ],
  ragEngine: {
    sources: ['supabase-productos', 'supabase-politicas']
  }
})
```

### 2. RAG Engine con Supabase

**Fuentes de Datos:**

| Fuente | Tabla/Vista | Propósito |
|--------|-------------|-----------|
| `productos_con_stock` | Vista | Catálogo con stock real |
| `clientes` | Tabla | Datos del cliente |
| `pedidos` | Tabla | Historial de pedidos |
| `cuentas_corrientes` | Tabla | Estado de cuenta |
| `politicas_entrega` | Tabla | Reglas de entrega |

**Configuración RAG:**
```typescript
// src/lib/vertex/rag-config.ts
export const ragConfig = {
  sources: [
    {
      name: 'supabase-productos',
      type: 'postgresql',
      connection: process.env.SUPABASE_DB_CONNECTION_URL,
      tables: ['productos_con_stock'],
      embeddingModel: 'text-embedding-004',
      similarityThreshold: 0.7
    },
    {
      name: 'supabase-politicas',
      type: 'postgresql',
      connection: process.env.SUPABASE_DB_CONNECTION_URL,
      tables: ['politicas_entrega', 'horarios_atencion'],
      embeddingModel: 'text-embedding-004',
      similarityThreshold: 0.8
    }
  ]
}
```

### 3. Sessions (Memoria Conversacional) - Vertex AI Nativo

**Vertex AI Agent Engine Sessions** - API nativa para gestión de sesiones:

```typescript
// src/lib/vertex/session-manager.ts
import { AgentEngineClient } from '@google-cloud/vertexai-agent-builder'

const agentEngineClient = new AgentEngineClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-central1',
  agentEngineName: 'avicola-whatsapp-agent'
})

export async function createOrGetSession(phoneNumber: string) {
  // Crear sesión nativa de Vertex AI
  const session = await agentEngineClient.sessions.create({
    name: 'avicola-whatsapp-agent',
    user_id: phoneNumber // Usamos phone_number como user_id
  })
  
  return session
}

export async function getSession(sessionId: string) {
  return await agentEngineClient.sessions.get({
    name: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/us-central1/agentEngines/avicola-whatsapp-agent/sessions/${sessionId}`
  })
}
```

**Memory Bank** - Generación automática de memorias:

```typescript
// src/lib/vertex/memory-bank.ts
export async function generateMemories(sessionId: string) {
  await agentEngineClient.memories.generate({
    name: 'avicola-whatsapp-agent',
    vertex_session_source: {
      session: sessionId
    },
    scope: {
      user_id: phoneNumber
    },
    config: {
      wait_for_completion: true
    }
  })
}
```

**Ventajas de usar Sessions nativo:**
- No requiere tabla adicional en Supabase
- Memory Bank genera memorias automáticamente
- Gestión de scope por usuario nativa
- Persistencia en Vertex AI (alta disponibilidad)

---

## Flujo de Datos Completo

### Flujo 1: Pedido con Memoria

```
1. Cliente: "Quiero 5 kg de ala"
   ↓
2. Twilio Webhook → /api/bot
   ↓
3. Obtener sesión del cliente (Sessions)
   ↓
4. RAG Engine busca:
   - Stock de "ala" en productos_con_stock
   - Historial de pedidos del cliente
   - Políticas de entrega
   ↓
5. Gemini 3 Pro genera respuesta:
   "Perfecto, anoté 5 kg de ala. ¿Querés que sea para mañana?"
   ↓
6. Guardar mensaje en sesión
   ↓
7. Respuesta al cliente
```

### Flujo 2: Seguimiento de Pedido

```
1. Cliente: "¿Cómo va mi pedido?"
   ↓
2. Twilio Webhook → /api/bot
   ↓
3. Obtener sesión (contiene: "Quiero 5 kg de ala")
   ↓
4. RAG Engine busca:
   - Último pedido del cliente
   - Estado actual
   ↓
5. Gemini 3 Pro con contexto:
   "Tu pedido de 5 kg de ala está en preparación y saldrá mañana en el turno mañana."
   ↓
6. Guardar en sesión
   ↓
7. Respuesta al cliente
```

---

## Implementación ADK TypeScript

### Estructura de Proyecto

```
src/
├── lib/
│   └── vertex/
│       ├── agent-config.ts          # Configuración del agente
│       ├── rag-config.ts            # Configuración RAG
│       ├── session-manager.ts       # Gestión de sesiones
│       ├── tools/                   # Herramientas del agente
│       │   ├── crear-presupuesto.ts
│       │   ├── consultar-stock.ts
│       │   ├── consultar-estado.ts
│       │   └── crear-reclamo.ts
│       └── prompts/
│           ├── system-prompt.ts     # Prompt del sistema
│           └── context-prompt.ts    # Prompt contextual
├── app/
│   └── api/
│       └── bot/
│           └── route.ts             # Webhook Twilio (modificado)
```

### Tool: Crear Presupuesto

```typescript
// src/lib/vertex/tools/crear-presupuesto.ts
import { Tool } from '@google-cloud/vertexai-agent-builder'
import { crearPresupuestoAction } from '@/actions/presupuestos.actions'

export const crearPresupuestoTool: Tool = {
  name: 'crear-presupuesto',
  description: 'Crea un nuevo presupuesto con los productos especificados',
  parameters: {
    type: 'object',
    properties: {
      cliente_id: {
        type: 'string',
        description: 'ID del cliente'
      },
      productos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            producto_id: { type: 'string' },
            cantidad: { type: 'number' }
          }
        }
      },
      observaciones: {
        type: 'string',
        description: 'Observaciones adicionales'
      }
    },
    required: ['cliente_id', 'productos']
  },
  execute: async (params: any) => {
    const formData = new FormData()
    formData.append('cliente_id', params.cliente_id)
    formData.append('observaciones', params.observaciones || 'Presupuesto desde WhatsApp (Vertex AI)')
    formData.append('items', JSON.stringify(params.productos.map((p: any) => ({
      producto_id: p.producto_id,
      cantidad_solicitada: p.cantidad,
      precio_unit_est: 0 // Se calculará con lista de precios
    }))))
    
    const result = await crearPresupuestoAction(formData)
    
    return {
      success: result.success,
      presupuesto_id: result.data?.presupuesto_id,
      numero_presupuesto: result.data?.numero_presupuesto,
      total_estimado: result.data?.total_estimado
    }
  }
}
```

### System Prompt

```typescript
// src/lib/vertex/prompts/system-prompt.ts
export const SYSTEM_PROMPT = `Eres el asistente virtual de Avícola del Sur, una empresa avícola argentina.

TU ROL:
- Atender pedidos de productos avícolas por WhatsApp
- Consultar stock y disponibilidad
- Informar sobre estado de pedidos
- Manejar consultas sobre precios y políticas
- Registrar reclamos cuando sea necesario

TU PERSONALIDAD:
- Amable y cercano, usando español argentino
- Proactivo: sugerir productos alternativos si no hay stock
- Consciente del contexto: recuerda pedidos anteriores y preferencias
- Profesional pero informal

REGLAS DE NEGOCIO:
1. Solo crear presupuestos si hay stock disponible
2. Confirmar siempre antes de procesar pedidos mayores a $5000
3. Ofrecer productos similares si no hay stock del solicitado
4. Recordar preferencias del cliente (ej: siempre pide ala los viernes)
5. Ser honesto sobre tiempos de entrega

PRODUCTOS PRINCIPALES:
- Ala, Pechuga, Muslo, Pata, Filet, Suprema
- Unidades: kg, cajones (1 cajón ≈ 10-12 kg)
- Stock en tiempo real desde RAG

POLÍTICAS DE ENTREGA:
- Turno mañana: entregas antes de las 12:00
- Turno tarde: entregas después de las 12:00
- Zonas: Norte, Sur, Centro, Oeste
- Horario de atención: 07:00 - 18:00

RESPONDE DE FORMA CONCISA (máximo 3 líneas) Y AMIGABLE.
Usa emojis moderadamente.
Nunca inventes información que no tengas.`
```

---

## Integración con Webhook Twilio

```typescript
// src/app/api/bot/route.ts (modificado)
import { avicolaAgent } from '@/lib/vertex/agent-config'
import { getSessionContext, updateSession } from '@/lib/vertex/session-manager'

export async function POST(request: Request) {
  const formData = await request.formData()
  const body = formData.get('Body')?.toString().trim() || ''
  const from = formData.get('From')?.toString() || ''
  const phoneNumber = from.replace('whatsapp:', '')

  try {
    // Obtener sesión existente
    const session = await getSessionContext(phoneNumber)
    
    // Construir contexto para el agente
    const agentContext = {
      phoneNumber,
      sessionId: session.session_id,
      history: session.messages,
      customerContext: session.context
    }

    // Invocar Vertex AI Agent
    const agentResponse = await avicolaAgent.invoke({
      message: body,
      context: agentContext,
      tools: ['crear-presupuesto', 'consultar-stock', 'consultar-estado']
    })

    // Actualizar sesión
    await updateSession(
      session.session_id,
      {
        role: 'user',
        content: body,
        timestamp: new Date().toISOString()
      },
      agentResponse.context
    )

    // Enviar respuesta
    const responseMessage = agentResponse.text
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      }
    )
  } catch (error) {
    console.error('[Vertex AI] Error:', error)
    
    // Fallback al sistema actual
    return handleTwilioWebhook(formData)
  }
}
```

---

## Plan de Migración Gradual

### Fase 1: Setup (1-2 días)
- [ ] Crear proyecto en Vertex AI
- [ ] Configurar ADK TypeScript
- [ ] Crear tabla `vertex_agent_sessions`
- [ ] Configurar RAG Engine con Supabase

### Fase 2: Implementación Core (3-5 días)
- [ ] Implementar `session-manager.ts`
- [ ] Crear tools básicas (consultar-stock, consultar-estado)
- [ ] Implementar system prompt
- [ ] Integrar con webhook Twilio

### Fase 3: Testing (2-3 días)
- [ ] Test de memoria conversacional
- [ ] Test de RAG con Supabase
- [ ] Test de tools (crear presupuesto)
- [ ] Test de fallback al sistema actual

### Fase 4: Deploy y Monitoreo (1-2 días)
- [ ] Deploy a producción
- [ ] Configurar monitoreo de calidad
- [ ] Revisar logs y ajustar prompts
- [ ] Capacitar equipo

### Fase 5: Optimización (continuo)
- [ ] Analizar conversaciones reales
- [ ] Ajustar prompts basado en feedback
- [ ] Agregar nuevas tools según necesidad
- [ ] Optimizar RAG sources

---

## Costos Estimados

| Servicio | Uso Mensual | Costo |
|----------|-------------|-------|
| Gemini 3 Pro | 100K tokens | ~$0.25 |
| Gemini 2.5 Flash | 500K tokens | ~$0.10 |
| Agent Engine | 10K sesiones | ~$1.00 |
| RAG Engine | 50K búsquedas | ~$0.50 |
| Embeddings | 10K vectores | ~$0.05 |
| **Total** | | **~$1.90/mes** |

---

## Beneficios Esperados

1. **Experiencia más natural**: Memoria conversacional hace que el bot se sienta como una persona
2. **Menor carga de soporte**: El bot maneja consultas más complejas
3. **Mejor conversión**: Contexto personalizado aumenta ventas
4. **Escalabilidad**: Agent Builder maneja volúmenes altos
5. **Mejora continua**: Evaluación automática optimiza respuestas

---

## Consideraciones Técnicas

### Seguridad
- Validar todas las entradas del usuario
- Usar Service Role de Supabase para RAG
- Implementar rate limiting
- Sanitizar respuestas antes de enviar

### Performance
- Cache de sesiones en memoria (Redis opcional)
- Batch de embeddings para RAG
- Timeout de 10s para respuestas del agente
- Fallback inmediato si Vertex AI falla

### Monitoreo
- Logs de todas las conversaciones
- Métricas de calidad (Gen AI Evaluation)
- Alertas de errores o respuestas de baja calidad
- Dashboard de uso y costos

---

## Próximos Pasos

1. **Revisar y aprobar arquitectura**
2. **Configurar cuenta Vertex AI**
3. **Implementar Fase 1 (Setup)**
4. **Testing en sandbox**
5. **Deploy gradual (10% → 50% → 100%)**
