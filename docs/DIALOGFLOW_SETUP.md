# 🤖 Guía de Configuración - Dialogflow

Nota: esta guia es complementaria para configurar Dialogflow. La referencia vigente de integraciones IA y variables del proyecto esta en `docs/GOOGLE_CLOUD_SETUP.md`, `docs/IA_CAPABILITIES.md` y `env.example`.

Esta guía te ayudará a configurar Dialogflow para el bot inteligente de WhatsApp.

## 📋 Prerrequisitos

- Proyecto de Google Cloud creado
- Dialogflow API habilitada
- Service Account configurado

## 🔧 Paso 1: Crear Agente Dialogflow

1. Ve a [Dialogflow Console](https://dialogflow.cloud.google.com/)
2. Selecciona tu proyecto de Google Cloud
3. Haz clic en **Create Agent**
4. Completa:
   - **Agent name**: `Avicola del Sur Bot`
   - **Default language**: `Spanish (Argentina)`
   - **Time zone**: `America/Argentina/Buenos_Aires`
5. Haz clic en **Create**

## 🎯 Paso 2: Crear Intenciones Básicas

### Intención: pedido

1. Haz clic en **Intents** → **Create Intent**
2. **Intent name**: `pedido`
3. **Training phrases** (frases de entrenamiento):
   - "Quiero hacer un pedido"
   - "Necesito comprar"
   - "Quiero pedir productos"
   - "Hacer pedido"
   - "Comprar"
4. **Responses**:
   - "Perfecto, vamos a crear tu pedido. ¿Qué productos necesitas?"
5. Guarda la intención

### Intención: consulta_stock

1. **Intent name**: `consulta_stock`
2. **Training phrases**:
   - "¿Tienen stock de pollo?"
   - "¿Hay disponibilidad?"
   - "¿Tienen disponible?"
   - "Consultar stock"
   - "Stock disponible"
3. **Responses**:
   - "Déjame consultar el stock disponible. ¿Qué producto te interesa?"
4. Guarda la intención

### Intención: consulta_precio

1. **Intent name**: `consulta_precio`
2. **Training phrases**:
   - "¿Cuánto cuesta?"
   - "¿Qué precio tiene?"
   - "Precios"
   - "Consultar precios"
   - "Lista de precios"
3. **Responses**:
   - "Te ayudo con los precios. ¿De qué producto querés saber el precio?"
4. Guarda la intención

### Intención: cancelar_pedido

1. **Intent name**: `cancelar_pedido`
2. **Training phrases**:
   - "Cancelar pedido"
   - "Quiero cancelar"
   - "Anular pedido"
   - "No quiero el pedido"
3. **Responses**:
   - "Entendido, cancelando tu pedido..."
4. Guarda la intención

## 🔑 Paso 3: Obtener Agent ID

1. En Dialogflow Console, ve a **Settings** (⚙️)
2. En la pestaña **General**, copia el **Agent ID**
3. Configura `GOOGLE_DIALOGFLOW_AGENT_ID` en tu `.env.local`

## 📝 Paso 4: Configurar Entidades (Opcional)

Para extraer información específica de los mensajes:

1. Ve a **Entities** → **Create Entity**
2. Crea entidades como:
   - `@producto`: Pollo, Huevos, etc.
   - `@cantidad`: 5kg, 10 unidades, etc.
3. Asocia estas entidades a las intenciones correspondientes

## ✅ Paso 5: Probar el Agente

1. En Dialogflow Console, ve a la pestaña **Try it now**
2. Escribe frases como:
   - "Quiero hacer un pedido"
   - "¿Tienen stock?"
3. Verifica que las intenciones se detecten correctamente

## 🔄 Paso 6: Integración con el Sistema

El sistema ya está configurado para usar Dialogflow. Solo necesitas:

1. Configurar las variables de entorno:
   ```env
   GOOGLE_DIALOGFLOW_PROJECT_ID=tu-project-id
   GOOGLE_DIALOGFLOW_AGENT_ID=tu-agent-id
   GOOGLE_DIALOGFLOW_LANGUAGE_CODE=es-AR
   ```

2. El bot automáticamente usará Dialogflow para procesar mensajes

## 📚 Recursos Adicionales

- [Dialogflow Documentation](https://cloud.google.com/dialogflow/docs)
- [Dialogflow Best Practices](https://cloud.google.com/dialogflow/docs/best-practices)

---

**Nota**: Las intenciones básicas están implementadas con fallback a procesamiento básico si Dialogflow no está disponible.

