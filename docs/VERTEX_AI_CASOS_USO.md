# 🤖 Casos de Uso de Vertex AI para Avícola del Sur ERP

## 📋 Resumen Ejecutivo

Vertex AI puede transformar tu ERP de reactivo a proactivo, agregando inteligencia artificial en 6 áreas clave: **Bot WhatsApp avanzado**, **Predicción de demanda**, **Análisis de reclamos**, **Recomendaciones personalizadas**, **OCR de documentos** y **Análisis de sentimiento**.

**Prioridad recomendada**: Comenzar con **Bot WhatsApp** (impacto inmediato) y luego **Predicción de demanda** (ROI alto).

---

## 🎯 Casos de Uso Prioritarios

### 1️⃣ **Bot de WhatsApp con NLU Avanzado** ⭐ ALTA PRIORIDAD

#### Problema Actual
- Bot procesa comandos estructurados: `"POLLO001 5"` 
- No entiende lenguaje natural: `"quiero 5 kilos de pollo para mañana"`
- Clientes deben aprender comandos específicos

#### Solución con Vertex AI
**Gemini API** para comprensión de lenguaje natural:

```typescript
// Ejemplo de integración en /api/bot/route.ts
import { VertexAI } from '@google-cloud/aiplatform';

async function procesarMensajeNatural(mensaje: string, contextoCliente: any) {
  const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT_ID,
    location: 'us-central1'
  });
  
  const model = vertexAI.preview.getGenerativeModel({
    model: 'gemini-pro',
  });
  
  const prompt = `
Eres un asistente de Avícola del Sur. El cliente ${contextoCliente.nombre} escribió:
"${mensaje}"

Productos disponibles: ${JSON.stringify(contextoCliente.productos_frecuentes)}

Extrae:
1. Productos mencionados (códigos)
2. Cantidades
3. Fecha/urgencia
4. Intención (pedido, consulta, reclamo)

Responde en JSON:
{
  "intencion": "pedido" | "consulta" | "reclamo",
  "productos": [{"codigo": "POLLO001", "cantidad": 5}],
  "fecha_entrega": "mañana" | "hoy" | null,
  "mensaje_respuesta": "mensaje amigable al cliente"
}
`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
```

#### Beneficios
- ✅ Clientes hablan naturalmente (mayor conversión)
- ✅ Menos errores por malinterpretación
- ✅ Sugerencias inteligentes de productos
- ✅ Análisis de sentimiento en tiempo real

#### Costo Estimado
- ~$0.001 por mensaje (Gemini Pro)
- 1000 mensajes/día = $1/día = $30/mes

---

### 2️⃣ **Predicción de Demanda y Alertas Proactivas** ⭐ ALTA PRIORIDAD

#### Problema Actual
- Alertas de stock **reactivas** (cuando ya está bajo)
- Proyección simple basada en promedio de últimos 30 días
- No considera estacionalidad, días festivos, tendencias

#### Solución con Vertex AI
**Vertex AI Forecasting** o **AutoML Tables** para predicción:

```typescript
// Ejemplo de Server Action para predicción
// src/actions/prediccion.actions.ts

export async function predecirDemanda(
  productoId: string,
  diasFuturo: number = 7
): Promise<ApiResponse<{
  prediccion: number;
  intervalo_confianza: [number, number];
  factores_clave: string[];
}>> {
  // 1. Recopilar datos históricos
  const historial = await obtenerHistorialVentas(productoId, 90); // 3 meses
  
  // 2. Agregar contexto: día semana, feriados, clima, promociones
  const datosEnriquecidos = enriquecerConContexto(historial);
  
  // 3. Llamar a Vertex AI Forecasting
  const vertexAI = new VertexAI({...});
  const prediction = await vertexAI.forecasting.predict({
    dataset: datosEnriquecidos,
    targetColumn: 'cantidad_vendida',
    timeColumn: 'fecha',
    horizon: diasFuturo
  });
  
  // 4. Comparar con stock actual y generar alertas
  const stockActual = await obtenerStockActual(productoId);
  if (prediction.prediccion > stockActual * 0.8) {
    await generarAlertaProactiva(productoId, prediction);
  }
  
  return { success: true, data: prediction };
}
```

#### Beneficios
- ✅ Alertas **antes** de quedarte sin stock
- ✅ Optimización de compras (comprar justo a tiempo)
- ✅ Reducción de desperdicio (menos exceso de inventario)
- ✅ Mejor planificación de producción

#### Datos Necesarios
- Historial de ventas (últimos 12 meses mínimo)
- Días de semana y feriados
- Promociones activas
- Eventos locales (festivales, ferias)

#### Costo Estimado
- Vertex AI Forecasting: ~$0.10 por predicción
- 50 productos × 1 predicción/día = $5/día = $150/mes
- **ROI**: Ahorro en pérdidas por faltante >> $150/mes

---

### 3️⃣ **Análisis Inteligente de Reclamos** 🟡 MEDIA PRIORIDAD

#### Problema Actual
- Módulo en desarrollo
- Procesamiento manual de reclamos
- No hay priorización automática

#### Solución con Vertex AI
**Gemini** para análisis de texto y clasificación:

```typescript
// src/actions/reclamos.actions.ts

export async function analizarReclamo(
  textoReclamo: string,
  contextoCliente: any
): Promise<ApiResponse<{
  categoria: string;
  urgencia: 'baja' | 'media' | 'alta' | 'critica';
  temas_clave: string[];
  respuesta_sugerida: string;
  productos_mencionados: string[];
}>> {
  const vertexAI = new VertexAI({...});
  const model = vertexAI.preview.getGenerativeModel({ model: 'gemini-pro' });
  
  const prompt = `
Analiza este reclamo de ${contextoCliente.nombre}:
"${textoReclamo}"

Clasifica:
1. Categoría: calidad | entrega | facturación | otro
2. Urgencia: baja | media | alta | crítica
3. Temas clave extraídos
4. Respuesta sugerida profesional
5. Productos mencionados (códigos si aplica)

Responde en JSON.
`;

  const result = await model.generateContent(prompt);
  const analisis = JSON.parse(result.response.text());
  
  // Auto-priorizar reclamos críticos
  if (analisis.urgencia === 'critica') {
    await notificarAdminInmediato(analisis);
  }
  
  return { success: true, data: analisis };
}
```

#### Beneficios
- ✅ Respuesta automática inmediata
- ✅ Priorización inteligente
- ✅ Detección de problemas recurrentes
- ✅ Respuestas sugeridas para vendedores

---

### 4️⃣ **Recomendaciones Personalizadas** 🟡 MEDIA PRIORIDAD

#### Problema Actual
- Catálogo genérico sin personalización
- Clientes deben buscar productos manualmente

#### Solución con Vertex AI
**Gemini** para recomendaciones contextuales:

```typescript
// Integración en bot de WhatsApp
async function generarRecomendaciones(clienteId: string, contexto: string) {
  const historialCliente = await obtenerHistorialCompras(clienteId, 90);
  const productosDisponibles = await obtenerProductosConStock();
  
  const prompt = `
Cliente: ${clienteId}
Últimas compras: ${JSON.stringify(historialCliente.slice(0, 5))}
Contexto: "${contexto}" (ej: "para fin de semana", "para restaurante")

Recomienda 3-5 productos relevantes con razones.

Responde en JSON:
{
  "recomendaciones": [
    {"codigo": "POLLO001", "razon": "producto que compras frecuentemente"},
    ...
  ]
}
`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
```

#### Beneficios
- ✅ Mayor ticket promedio
- ✅ Descubrimiento de productos nuevos
- ✅ Experiencia personalizada

---

### 5️⃣ **OCR y Extracción de Documentos** 🟡 MEDIA PRIORIDAD

#### Problema Actual
- Facturas y comprobantes ingresados manualmente
- Riesgo de errores humanos

#### Solución con Vertex AI
**Document AI** para extracción automática:

```typescript
// src/actions/documentos.actions.ts

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

export async function procesarFacturaPDF(
  fileBuffer: Buffer
): Promise<ApiResponse<{
  numero_factura: string;
  fecha: string;
  proveedor: string;
  productos: Array<{nombre: string, cantidad: number, precio: number}>;
  total: number;
}>> {
  const client = new DocumentProcessorServiceClient();
  const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  
  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: fileBuffer.toString('base64'),
      mimeType: 'application/pdf'
    }
  });
  
  const documento = result.document;
  
  // Extraer datos estructurados
  const datosExtraidos = {
    numero_factura: extraerCampo(documento, 'numero_factura'),
    fecha: extraerCampo(documento, 'fecha'),
    proveedor: extraerCampo(documento, 'proveedor'),
    productos: extraerTabla(documento, 'productos'),
    total: extraerCampo(documento, 'total')
  };
  
  // Validar y crear registro en BD
  await crearIngresoMercaderia(datosExtraidos);
  
  return { success: true, data: datosExtraidos };
}
```

#### Beneficios
- ✅ Ahorro de tiempo (80% menos tiempo)
- ✅ Menos errores
- ✅ Trazabilidad automática

---

### 6️⃣ **Análisis de Sentimiento en Conversaciones** 🔵 BAJA PRIORIDAD

#### Problema Actual
- No hay visibilidad del nivel de satisfacción en tiempo real
- Problemas detectados tarde

#### Solución con Vertex AI
**Natural Language API** para análisis de sentimiento:

```typescript
import language from '@google-cloud/language';

export async function analizarSentimiento(mensajes: string[]): Promise<{
  score: number; // -1 (negativo) a +1 (positivo)
  magnitud: number; // Intensidad
}> {
  const client = new language.LanguageServiceClient();
  
  const document = {
    content: mensajes.join(' '),
    type: 'PLAIN_TEXT',
  };
  
  const [result] = await client.analyzeSentiment({ document });
  const sentiment = result.documentSentiment;
  
  // Alertar si sentimiento muy negativo
  if (sentiment.score < -0.5) {
    await notificarAdmin('Cliente insatisfecho detectado');
  }
  
  return { score: sentiment.score, magnitud: sentiment.magnitude };
}
```

---

## 📊 Plan de Implementación Recomendado

### Fase 1: Quick Wins (1-2 semanas)
1. **Bot WhatsApp con Gemini** - Impacto inmediato
   - Integrar Gemini en `/api/bot/route.ts`
   - Entrenar con ejemplos de tu catálogo
   - Pruebas con 10 clientes beta

### Fase 2: Valor Estratégico (1 mes)
2. **Predicción de Demanda**
   - Recopilar 3 meses de historial mínimo
   - Entrenar modelo Vertex AI Forecasting
   - Integrar alertas proactivas en dashboard

### Fase 3: Optimización (2-3 meses)
3. **Análisis de Reclamos**
4. **Recomendaciones Personalizadas**
5. **OCR de Documentos** (si hay volumen alto)

---

## 💰 Estimación de Costos

| Caso de Uso | Costo Mensual Estimado | ROI Esperado |
|-------------|------------------------|--------------|
| Bot WhatsApp Gemini | $30-50 | Alta conversión |
| Predicción Demanda | $150-300 | Ahorro en faltantes |
| Análisis Reclamos | $20-40 | Mejor satisfacción |
| Recomendaciones | $30-60 | +15% ticket promedio |
| OCR Documentos | $50-100 | Ahorro tiempo 80% |
| **TOTAL (todos)** | **$280-550/mes** | **ROI alto** |

---

## 🚀 Próximos Pasos

1. **Crear cuenta Google Cloud** y activar Vertex AI
2. **Obtener credenciales** (service account JSON)
3. **Implementar POC** del bot con Gemini (1-2 días)
4. **Evaluar resultados** con clientes reales
5. **Escalar** a otros casos de uso según ROI

---

## 📚 Recursos

- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Guide](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Document AI Setup](https://cloud.google.com/document-ai/docs/setup)
- [Vertex AI Forecasting](https://cloud.google.com/vertex-ai/docs/time-series-forecasting)

---

**¿Necesitas ayuda con la implementación?** Puedo crear un ejemplo completo de integración del bot con Gemini como primer paso.























