# Plan: Mejoras Vertex AI Bot - Verificación y Extensiones

Verificar consistencia entre creación manual de presupuestos y bot, agregar mejoras sugeridas, implementar Memory Bank y documentar variables de entorno para Vercel.

## 1. Verificación de Creación de Presupuestos

**Objetivo**: Asegurar que el bot cree presupuestos idénticos a la creación manual.

**Comparación actual:**

| Aspecto | Manual (crearPresupuestoAction) | Bot (crearPresupuestoTool) | Estado |
|---------|--------------------------------|---------------------------|--------|
| Validación de usuario | ✅ Requiere auth + rol vendedor/admin | ❌ No valida usuario | ⚠️ Problema |
| Schema Zod | ✅ Validación completa | ❌ Sin validación | ⚠️ Problema |
| Items con precio | ✅ `precio_unit_est` requerido | ❌ `precio_unit_est = 0` | ⚠️ Problema |
| RPC llamada | ✅ `fn_crear_presupuesto_desde_bot` | ✅ Misma RPC | ✅ OK |
| Notificación WhatsApp | ✅ Enviada | ✅ Enviada | ✅ OK |
| Revalidate paths | ✅ Revalida rutas | ❌ No revalida | ⚠️ Menor |

**Problema identificado:**
- El bot usa `crearPresupuestoAction` que requiere autenticación y rol vendedor/admin
- El bot no tiene usuario autenticado, por lo que fallaría

**Solución propuesta:**
- NO crear usuario de sistema (innecesario)
- Modificar `crearPresupuestoTool` para llamar directamente a la RPC `fn_crear_presupuesto_desde_bot` usando `createAdminClient()`
- La RPC ya está diseñada para ser llamada desde el bot sin validación de usuario
- Mantener `precio_unit_est = 0` (la RPC calcula precios automáticamente con lista de precios del cliente)

## 2. Mejoras de Tools (Punto 2)

**Tools actuales:**
- `crear-presupuesto` ✅ Funcional
- `consultar-stock` ✅ Funcional
- `consultar-estado` ✅ Funcional

**Nuevas tools sugeridas:**

| Tool | Descripción | Prioridad |
|------|-------------|-----------|
| `consultar-saldo` | Consultar saldo pendiente de cliente | Alta |
| `crear-reclamo` | Crear reclamo desde WhatsApp | Alta |
| `consultar-reclamos` | Ver reclamos del cliente | Media |
| `consultar-precios` | Ver precios de productos específicos | Media |
| `actualizar-cliente` | Actualizar datos del cliente | Baja |

## 3. Vertex AI Memory Bank (Punto 3)

**Objetivo**: Implementar memoria persistente para contexto de conversaciones.

**Implementación:**
- Usar Vertex AI Sessions API nativa (ya parcialmente implementada en `session-manager.ts`)
- Almacenar en Supabase tabla `bot_sessions` (ya creada)
- Campos: `customer_context` (JSON) para datos persistentes del cliente

**Funcionalidades:**
- Recordar preferencias del cliente (productos frecuentes, zona, etc.)
- Mantener contexto de conversación previa
- Persistir entre sesiones (expiración configurable)

## 4. Variables de Entorno para Vercel

**Variables existentes (Supabase):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Variables nuevas (Vertex AI):**
- `GOOGLE_CLOUD_PROJECT_ID` = `gen-lang-client-0184145853`
- `GOOGLE_CLOUD_CREDENTIALS_BASE64` = (credenciales Service Account en base64)

**Variables existentes (WhatsApp):**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `WHATSAPP_FROM_NUMBER`

**Opcional (Meta Business):**
- `META_WHATSAPP_PHONE_ID`
- `META_WHATSAPP_ACCESS_TOKEN`

## Pasos de Implementación

1. **Verificar y corregir creación de presupuestos**
   - Crear usuario de sistema "bot_whatsapp"
   - Modificar `crearPresupuestoTool` para usar auth del bot
   - Validar que RPC calcule precios correctamente

2. **Implementar nuevas tools**
   - `consultar-saldo` → consultar cuenta corriente
   - `crear-reclamo` → crear reclamo con fotos (opcional)

3. **Mejorar Memory Bank**
   - Completar implementación en `session-manager.ts`
   - Agregar función para generar memorias con Vertex AI
   - Integrar con `customer_context`

4. **Documentar y testear**
   - Crear guía de variables de entorno
   - Testear cada tool con script de prueba
   - Validar en Vercel

## Archivos a Modificar

- `src/lib/vertex/tools/crear-presupuesto.ts` - Agregar auth de bot
- `src/lib/vertex/tools/consultar-saldo.ts` - Nueva tool
- `src/lib/vertex/tools/crear-reclamo.ts` - Nueva tool
- `src/lib/vertex/session-manager.ts` - Mejorar Memory Bank
- `src/lib/vertex/agent.ts` - Integrar nuevas tools
- `supabase/migrations/` - Crear usuario de bot
