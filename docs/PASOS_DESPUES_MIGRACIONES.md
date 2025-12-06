# 🚀 Pasos Después de Ejecutar las Migraciones

## ✅ Paso 1: Verificar que las Tablas se Crearon Correctamente

Ejecuta esta consulta en Supabase SQL Editor para verificar:

```sql
-- Verificar todas las tablas nuevas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'optimizaciones_rutas',
    'metricas_rutas',
    'conversaciones_bot',
    'transcripciones_audio',
    'metricas_bot',
    'documentos_procesados',
    'extracciones_documentos',
    'predicciones_demanda',
    'alertas_stock_ia',
    'modelos_ml',
    'reportes_ia'
  )
ORDER BY table_name;
```

Deberías ver 11 tablas listadas.

## 🔧 Paso 2: Configurar Variables de Entorno

Copia el contenido de `env.example` a tu archivo `.env.local` y completa las variables de Google Cloud:

```env
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
GOOGLE_CLOUD_REGION=southamerica-east1
GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64=tu-service-account-base64

# APIs específicas (opcionales - puedes habilitarlas gradualmente)
GOOGLE_MAPS_FLEET_ROUTING_API_KEY=tu-api-key
GOOGLE_DIALOGFLOW_PROJECT_ID=tu-project-id
GOOGLE_DIALOGFLOW_AGENT_ID=tu-agent-id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=tu-processor-id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=tu-processor-id
GOOGLE_GEMINI_API_KEY=tu-gemini-api-key

# Configuraciones
GOOGLE_OPTIMIZATION_API_ENABLED=true
GOOGLE_SPEECH_TO_TEXT_ENABLED=true
GOOGLE_VERTEX_AI_ENABLED=true
GOOGLE_AUTOML_ENABLED=true
```

**Nota:** Puedes empezar con solo las variables básicas y habilitar servicios gradualmente.

## 📚 Paso 3: Seguir las Guías de Configuración

### 3.1 Configuración Base de Google Cloud
Sigue la guía completa en: [`docs/GOOGLE_CLOUD_SETUP.md`](./GOOGLE_CLOUD_SETUP.md)

**Pasos principales:**
1. Crear proyecto en Google Cloud Console
2. Crear Service Account y descargar JSON
3. Habilitar las APIs necesarias
4. Configurar las credenciales

### 3.2 Configurar Dialogflow (Opcional - Fase 2)
Sigue la guía en: [`docs/DIALOGFLOW_SETUP.md`](./DIALOGFLOW_SETUP.md)

**Pasos principales:**
1. Crear agente Dialogflow
2. Crear intenciones básicas (pedido, consulta_stock, etc.)
3. Obtener Agent ID

### 3.3 Configurar Document AI (Opcional - Fase 3)
1. Ir a [Document AI Console](https://console.cloud.google.com/ai/document-ai)
2. Crear processors para facturas y remitos
3. Copiar los Processor IDs

## 🧪 Paso 4: Probar las Funcionalidades

### 4.1 Optimización de Rutas Avanzada (Fase 1)
1. Ve a `/reparto/rutas/[id]/optimizar` (reemplaza `[id]` con un ID de ruta existente)
2. Configura objetivos y restricciones
3. Haz clic en "Optimizar Ruta"
4. Verifica que se muestren los resultados con métricas de ahorro

### 4.2 Dashboard con Métricas
1. Ve a `/dashboard` (admin)
2. Verifica que aparezca la nueva tarjeta "Eficiencia de Rutas"
3. Debería mostrar ahorros de la semana (si hay optimizaciones aplicadas)

### 4.3 Predicciones de Demanda (Fase 4)
Puedes probar las predicciones usando el endpoint:

```bash
# Obtener predicción para un producto
GET /api/predictions/demand?productoId=<uuid>&diasFuturos=7

# Generar predicciones para todos los productos
POST /api/predictions/generate
```

### 4.4 Alertas de Stock IA (Fase 4)
```bash
# Obtener alertas activas
GET /api/predictions/alerts
```

## 🔄 Paso 5: Configurar Jobs Automáticos (Opcional)

Para generar predicciones y alertas automáticamente, puedes configurar:

### Opción A: Supabase pg_cron
```sql
-- Ejecutar predicciones diariamente a las 2 AM
SELECT cron.schedule(
    'generar-predicciones-diarias',
    '0 2 * * *',
    $$SELECT fn_generar_alertas_stock()$$
);

-- Ejecutar alertas cada 6 horas
SELECT cron.schedule(
    'generar-alertas-stock',
    '0 */6 * * *',
    $$SELECT fn_generar_alertas_stock()$$
);
```

### Opción B: Vercel Cron (si usas Vercel)
Crea `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/predictions/generate",
      "schedule": "0 2 * * *"
    }
  ]
}
```

## 📊 Paso 6: Verificar Funciones RPC

Prueba que las funciones RPC funcionen correctamente:

```sql
-- Probar función de métricas de rutas
SELECT fn_obtener_metricas_rutas_semana(CURRENT_DATE);

-- Probar función de métricas del bot
SELECT fn_obtener_metricas_bot_semana(CURRENT_DATE);

-- Probar función de predicciones
SELECT * FROM fn_obtener_predicciones_semana(CURRENT_DATE);
```

## 🎯 Próximos Pasos Recomendados

1. **Comenzar con Fase 1** (Optimización de Rutas) - Ya está lista para usar
2. **Configurar Google Cloud** siguiendo la guía de setup
3. **Probar optimización avanzada** con una ruta real
4. **Habilitar gradualmente** las demás fases según necesidad

## ⚠️ Notas Importantes

- **Sin configuración de Google Cloud**: El sistema funcionará con fallbacks básicos
- **Optimización avanzada**: Requiere `GOOGLE_MAPS_FLEET_ROUTING_API_KEY` o `GOOGLE_OPTIMIZATION_API_ENABLED=true`
- **Bot inteligente**: Requiere Dialogflow configurado, pero tiene fallback básico
- **Predicciones**: Funcionan con análisis básico sin Vertex AI, mejoran con datos históricos

## 🆘 Solución de Problemas

Si encuentras errores:

1. **Verifica las variables de entorno** en `.env.local`
2. **Revisa los logs** del servidor para ver errores específicos
3. **Verifica permisos** del Service Account en Google Cloud
4. **Confirma que las APIs estén habilitadas** en Google Cloud Console

---

**¿Necesitas ayuda con algún paso específico?** Revisa las guías detalladas o consulta los logs del sistema.

