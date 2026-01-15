---
name: avicola-prompt-engineering
description: Prompt engineering guide for Avícola del Sur ERP. Vertex AI (Gemini) prompts, WhatsApp bot system prompts, bank reconciliation prompts, Spanish Argentine persona, tool definitions, memory bank patterns. Use when improving AI interactions in the ERP.
---

# Avícola del Sur - Prompt Engineering

Comprehensive prompt engineering guide for Vertex AI (Gemini) integration in the Avícola del Sur ERP.

## Stack de IA

- **Platform**: Google Vertex AI
- **Model**: Gemini 1.5 Flash (gen-lang-client-0184145853)
- **Location**: us-central1
- **SDK**: @google-cloud/vertexai
- **Use Cases**: WhatsApp bot, bank reconciliation, customer support

## Core Principles

### 1. Spanish Argentine Persona

**Why**: Natural communication with customers in Tucumán, Argentina.

**System Prompt Template**:
```typescript
const SYSTEM_PROMPT = `
Eres un asistente virtual de Avícola del Sur, una empresa de productos avícolas en Tucumán, Argentina.

## Tu Personalidad
- Hablas en español argentino de Tucumán
- Usas un tono amigable y cercano
- Eres servicial y paciente
- Conoces todos los productos y precios de Avícola del Sur

## Estilo de Comunicación
- Usás "vos" en lugar de "tú"
- Usás expresiones locales: "che", "dale", "genial"
- Respondés de forma concisa pero amable
- Si no entendés algo, preguntás de nuevo con otras palabras

## Productos Principales
- Pollo entero: $5.000/kg
- Pollo en presas: $5.500/kg
- Menudencias: $2.000/kg
- Chorizos de pollo: $4.500/kg

## Horarios
- Atención: Lunes a viernes 8:00-18:00
- Reparto: Lunes a viernes 8:00-14:00
- WhatsApp: 24/7 (automático)

## Lo que podés hacer
- Consultar stock de productos
- Crear presupuestos
- Consultar estado de pedidos
- Consultar saldo de cuenta corriente
- Crear reclamos

## Lo que NO podés hacer
- Modificar datos de clientes
- Ver información de otros clientes
- Realizar cobros
- Modificar precios

Si el cliente pide algo que no podés hacer, explicale amablemente y sugerile que contacte por teléfono.
`;
```

### 2. Clear Tool Definitions

**Principle**: Tools must have clear descriptions, parameters, and examples.

**Tool Definition Template**:
```typescript
const tools = {
  'consultar-stock': {
    description: 'Consulta el stock disponible de un producto específico. Usá esto cuando el cliente pregunte por disponibilidad de productos.',
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
    examples: [
      {
        input: { producto_codigo: 'POLLO001' },
        output: { producto: 'Pollo Entero', stock: 150, unidad: 'kg' }
      }
    ]
  },

  'crear-presupuesto': {
    description: 'Crea un presupuesto para un cliente. Usá esto cuando el cliente quiera hacer un pedido o consultar precios.',
    parameters: {
      type: 'object',
      properties: {
        cliente_id: {
          type: 'string',
          description: 'ID del cliente (UUID)'
        },
        items: {
          type: 'array',
          description: 'Lista de productos y cantidades',
          items: {
            type: 'object',
            properties: {
              producto_codigo: { type: 'string' },
              cantidad: { type: 'number' }
            }
          }
        }
      },
      required: ['cliente_id', 'items']
    },
    examples: [
      {
        input: {
          cliente_id: 'uuid-cliente',
          items: [
            { producto_codigo: 'POLLO001', cantidad: 5 },
            { producto_codigo: 'PRESAS001', cantidad: 3 }
          ]
        },
        output: {
          presupuesto_id: 'uuid-presupuesto',
          numero: 'PRES-20250115-0001',
          total: 41500,
          items: [
            { producto: 'Pollo Entero', cantidad: 5, subtotal: 25000 },
            { producto: 'Pollo en Presas', cantidad: 3, subtotal: 16500 }
          ]
        }
      }
    ]
  }
};
```

### 3. Memory Bank Integration

**Principle**: Remember customer preferences and frequent products for personalized service.

**Memory Bank Pattern**:
```typescript
interface CustomerContext {
  phone_number: string;
  productos_frecuentes: {
    producto_codigo: string;
    producto_nombre: string;
    veces_comprado: number;
    ultima_compra: string;
  }[];
  preferencias: {
    zona_entrega?: string;
    horario_preferido?: string;
    comentarios?: string;
  };
  metadata: {
    total_pedidos: number;
    total_gastado: number;
    ultima_interaccion: string;
  };
}

// Update memory after each interaction
async function updateCustomerContext(
  phoneNumber: string,
  interaction: Interaction
) {
  const context = await getCustomerContext(phoneNumber);

  // Add product to frequent list
  if (interaction.items) {
    interaction.items.forEach(item => {
      const existing = context.productos_frecuentes.find(
        p => p.producto_codigo === item.producto_codigo
      );

      if (existing) {
        existing.veces_comprado++;
        existing.ultima_compra = new Date().toISOString();
      } else {
        context.productos_frecuentes.push({
          producto_codigo: item.producto_codigo,
          producto_nombre: item.producto_nombre,
          veces_comprado: 1,
          ultima_compra: new Date().toISOString()
        });
      }
    });
  }

  // Update metadata
  context.metadata.total_pedidos++;
  context.metadata.total_gastado += interaction.total;
  context.metadata.ultima_interaccion = new Date().toISOString();

  await saveCustomerContext(phoneNumber, context);
}

// Use memory in prompts
function buildPromptWithMemory(
  userMessage: string,
  context: CustomerContext
): string {
  let prompt = SYSTEM_PROMPT;

  // Add frequent products
  if (context.productos_frecuentes.length > 0) {
    prompt += `\n\n## Productos Frecuentes del Cliente\n`;
    context.productos_frecuentes.slice(0, 5).forEach(p => {
      prompt += `- ${p.producto_nombre} (${p.veces_comprado} veces)\n`;
    });
  }

  // Add preferences
  if (context.preferencias.zona_entrega) {
    prompt += `\n\n## Preferencias del Cliente\n`;
    prompt += `- Zona de entrega: ${context.preferencias.zona_entrega}\n`;
  }

  prompt += `\n\n## Mensaje del Cliente\n${userMessage}`;

  return prompt;
}
```

## Use Case: WhatsApp Bot

### Conversation Flow

```
Cliente: "Hola, quiero hacer un pedido"
Bot: "¡Hola! ¿Cómo estás? ¿Qué productos te gustaría pedir? 🐔"

Cliente: "5 kilos de pollo entero"
Bot: "Dale, 5kg de pollo entero. ¿Algo más?"

Cliente: "No, eso es todo"
Bot: "Perfecto. Te paso el presupuesto:\n\n📋 Presupuesto PRES-20250115-0001\n- Pollo Entero: 5kg x $5.000 = $25.000\n\n💰 Total: $25.000\n\n¿Te confirmo el pedido?"

Cliente: "Sí, confirmo"
Bot: "¡Genial! Pedido confirmado. Te lo enviamos por la zona de Tafí del Valle. Te aviso cuando salga. ¡Gracias por tu compra! 🚚"
```

### Bot Prompt Engineering

**Handling Ambiguity**:
```typescript
// When user says "pollo" without specifying type
if (userMessage.includes('pollo') && !userMessage.includes('entero') && !userMessage.includes('presas')) {
  return {
    message: "¿Te refieres al pollo entero ($5.000/kg) o al pollo en presas ($5.500/kg)?",
    options: ['Pollo entero', 'Pollo en presas']
  };
}
```

**Handling Out of Stock**:
```typescript
// When product is out of stock
if (stock === 0) {
  return {
    message: "¡Uy! No tenemos stock de pollo entero en este momento. ¿Te gustaría pollo en presas? Tenemos 50kg disponibles.",
    alternatives: ['Pollo en presas', 'Menudencias']
  };
}
```

**Handling Credit Limit**:
```typescript
// When customer exceeds credit limit
if (saldoPendiente > limiteCredito) {
  return {
    message: `Che, tenés un saldo pendiente de $${saldoPendiente} y tu límite de crédito es $${limiteCredito}. Para hacer este pedido necesitás que abones primero. ¿Te paso los datos para transferir?`,
    requiresPayment: true
  };
}
```

## Use Case: Bank Reconciliation

### Prompt for Parsing Bank Statements

```typescript
const RECONCILIATION_PROMPT = `
Eres un asistente financiero especializado en conciliación bancaria.

## Tu Tarea
Parsear el siguiente extracto bancario y extraer las transacciones de depósitos de clientes.

## Formato de Entrada
El extracto puede estar en formato CSV o texto plano.

## Información a Extraer
Para cada transacción, extraé:
- fecha: Fecha de la transacción (DD/MM/YYYY)
- monto: Monto del depósito (número, sin símbolos)
- descripcion: Descripción del depósito (texto completo)
- referencia: Número de referencia o cuenta (si existe)

## Reglas de Extracción
1. Ignorá transacciones que no sean depósitos
2. Ignorá transacciones con monto 0
3. Normalizá fechas al formato DD/MM/YYYY
4. Extraé montos como números (ej: 1500.50, no "$1,500.50")
5. Si no encontrás información, dejá el campo como null

## Ejemplo de Salida
[
  {
    "fecha": "15/01/2025",
    "monto": 5000.00,
    "descripcion": "DEPOSITO CUENTA 123456789",
    "referencia": "123456789"
  }
]

## Extracto a Parsear
${bankStatementText}
`;
```

### Prompt for Matching Transactions

```typescript
const MATCHING_PROMPT = `
Eres un asistente financiero especializado en matching de transacciones.

## Tu Tarea
Matchear una transacción bancaria con movimientos de caja de Avícola del Sur.

## Transacción Bancaria
{
  "fecha": "15/01/2025",
  "monto": 5000.00,
  "descripcion": "DEPOSITO JUAN PEREZ",
  "referencia": "123456789"
}

## Movimientos de Caja Candidatos
${JSON.stringify(cajaMovimientos, null, 2)}

## Reglas de Matching
1. **Monto**: Debe coincidir exactamente (o con diferencia mínima < $10)
2. **Fecha**: Debe ser el mismo día o el día anterior
3. **Cliente**: El nombre del cliente debe coincidir parcialmente (similitud > 0.7)
4. **Estado**: El movimiento debe estar pendiente de conciliación

## Criterios de Similitud
- Coincidencia exacta de nombre: 1.0
- Coincidencia parcial de nombre: 0.7-0.9
- Coincidencia de monto y fecha: 0.8
- Coincidencia de monto solamente: 0.5

## Salida Esperado
{
  "matches": [
    {
      "movimiento_id": "uuid-movimiento",
      "cliente_id": "uuid-cliente",
      "cliente_nombre": "Juan Perez",
      "similitud": 0.95,
      "razon": "Coincidencia exacta de nombre y monto"
    }
  ],
  "best_match": {
    "movimiento_id": "uuid-movimiento",
    "cliente_id": "uuid-cliente",
    "cliente_nombre": "Juan Perez",
    "similitud": 0.95
  }
}

Si no encontrás ningún match con similitud > 0.7, devolvé "best_match": null.
`;
```

## Prompt Testing

### Test Framework

```typescript
async function testPrompt(
  prompt: string,
  expectedOutput: any,
  tolerance: number = 0.1
): Promise<boolean> {
  const response = await vertexAI.generateContent(prompt);
  const output = JSON.parse(response.text);

  // Compare with expected output
  const diff = compareObjects(output, expectedOutput, tolerance);
  
  if (diff > tolerance) {
    console.error('Prompt test failed:', diff);
    return false;
  }

  return true;
}

// Test cases
describe('Bot Prompts', () => {
  it('should handle ambiguous product request', async () => {
    const prompt = buildPrompt('Quiero pollo');
    const response = await vertexAI.generateContent(prompt);
    
    expect(response.text).toContain('¿Te refieres al pollo entero');
  });

  it('should handle out of stock', async () => {
    const prompt = buildPrompt('Quiero 100kg de pollo entero');
    const response = await vertexAI.generateContent(prompt);
    
    expect(response.text).toContain('No tenemos stock');
  });
});
```

## Prompt Optimization

### Iterative Improvement

```typescript
// Version 1: Basic prompt
const v1 = "Parsear este extracto bancario: " + text;

// Version 2: Add context
const v2 = `
Parsear el siguiente extracto bancario y extraer transacciones de depósitos.
${text}
`;

// Version 3: Add rules and examples
const v3 = `
Eres un asistente financiero. Parsear el extracto y extraer depósitos.
Reglas: ignorar no-depósitos, normalizar fechas.
Ejemplo: [...]
${text}
`;

// Version 4: Add structured output
const v4 = `
${SYSTEM_PROMPT}
${text}

Output format: JSON array with fecha, monto, descripcion, referencia
`;

// Test each version
const results = await Promise.all([
  testPrompt(v1, expected),
  testPrompt(v2, expected),
  testPrompt(v3, expected),
  testPrompt(v4, expected)
]);

console.log('Best version:', results.indexOf(Math.max(...results)));
```

## Common Prompt Patterns

### Few-Shot Learning

```typescript
const prompt = `
Ejemplos de cómo responder:

Cliente: "Hola"
Bot: "¡Hola! ¿Cómo estás? ¿En qué puedo ayudarte?"

Cliente: "Quiero hacer un pedido"
Bot: "¡Dale! ¿Qué productos te gustaría pedir?"

Cliente: "¿Cuánto cuesta el pollo?"
Bot: "El pollo entero está a $5.000/kg y el pollo en presas a $5.500/kg. ¿Cuánto querés?"

Ahora respondé a: "${userMessage}"
`;
```

### Chain of Thought

```typescript
const prompt = `
Para crear un presupuesto, seguí estos pasos:

1. Identificar el cliente
2. Verificar stock de productos
3. Calcular total
4. Generar número de presupuesto
5. Devolver resumen al cliente

Cliente: "${userMessage}"

Paso 1: Identificar cliente...
Paso 2: Verificar stock...
Paso 3: Calcular total...
Paso 4: Generar número...
Paso 5: Devolver resumen...
`;
```

### Self-Correction

```typescript
const prompt = `
Revisá tu respuesta y corregí si es necesario:

Respuesta original: "${response}"

¿Es la respuesta correcta? ¿Hay algo que debas corregar?

Respuesta corregida: ...
`;
```

## Anti-Patterns to Avoid

❌ Prompts too long (> 2000 tokens)
❌ Ambiguous instructions
❌ Missing examples
❌ Not testing prompts
❌ Hardcoding values in prompts
❌ Not using memory for personalization
❌ Not handling edge cases

## Quick Reference

| Use Case | Prompt Pattern |
|----------|----------------|
| Bot conversation | System prompt + memory + few-shot |
| Bank parsing | Structured extraction + rules + examples |
| Transaction matching | Scoring criteria + similarity thresholds |
| Customer support | Persona + context + escalation rules |

## Related Skills

- **erp-ventas-chatbot** - Bot implementation
- **erp-tesoreria** - Reconciliation patterns
- **systematic-debugging** - Debugging AI responses
