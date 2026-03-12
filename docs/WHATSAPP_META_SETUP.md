# Guía Completa de Configuración - WhatsApp Business API (Meta)

Esta guía te ayudará a configurar WhatsApp Business API oficial de Meta para habilitar botones interactivos en el bot de Avícola del Sur.

## 📋 Requisitos Previos

- Cuenta de Meta Business (https://business.facebook.com)
- Número de teléfono verificado
- Acceso a Meta Business Manager
- Certificado/Token de acceso de WhatsApp Business API

---

## 🚀 Paso 1: Crear Aplicación en Meta

1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Inicia sesión con tu cuenta de Meta Business
3. Haz clic en **"Mis Aplicaciones"** → **"Crear Aplicación"**
4. Selecciona **"Negocio"** como tipo de aplicación
5. Completa los datos:
   - **Nombre de la aplicación**: Avícola del Sur ERP
   - **Email de contacto**: tu email
   - **Propósito comercial**: Selecciona la opción apropiada

---

## 🔑 Paso 2: Obtener App ID y App Secret

1. En el dashboard de tu aplicación, ve a **"Configuración"** → **"Básica"**
2. Encontrarás:
   - **ID de la aplicación (App ID)**: Cópialo, lo necesitarás para `WHATSAPP_META_APP_ID`
   - **Secreto de la aplicación (App Secret)**: Haz clic en "Mostrar" y cópialo, lo necesitarás para `WHATSAPP_META_APP_SECRET`

⚠️ **Importante**: El App Secret solo se muestra una vez. Guárdalo de forma segura.

---

## 📱 Paso 3: Configurar WhatsApp Business API

1. En el dashboard de tu aplicación, ve a **"Agregar producto"**
2. Busca **"WhatsApp"** y haz clic en **"Configurar"**
3. Sigue los pasos para conectar tu número de teléfono:
   - Si ya tienes un número verificado, selecciónalo
   - Si no, sigue el proceso de verificación de número

---

## 🆔 Paso 4: Obtener Phone Number ID

1. En el dashboard de WhatsApp, ve a **"Configuración"** → **"WhatsApp"**
2. En la sección **"Números de teléfono"**, encontrarás tu número
3. Haz clic en el número para ver los detalles
4. El **Phone Number ID** aparece en la URL o en los detalles del número
   - Formato: `123456789012345` (número largo)
   - También puedes encontrarlo en la API: `GET /v21.0/{phone-number-id}`

**Ejemplo de URL**: `https://business.facebook.com/wa/manage/phone-numbers/123456789012345`

El número `123456789012345` es tu Phone Number ID.

---

## 🔐 Paso 5: Obtener Access Token Permanente

### Opción A: Token Temporal (Para Pruebas)

1. En el dashboard de WhatsApp, ve a **"Configuración"** → **"WhatsApp"**
2. En la sección **"Token de acceso temporal"**, haz clic en **"Generar token"**
3. Copia el token generado
4. ⚠️ Este token expira en 24 horas

### Opción B: Token Permanente (Recomendado para Producción)

1. Ve a **"Configuración"** → **"Básica"** en tu aplicación
2. En la sección **"Token de acceso de la aplicación"**, genera un token
3. Para hacerlo permanente:
   - Ve a **"Configuración"** → **"Avanzada"**
   - En **"Modo de aplicación"**, cambia a **"Modo de producción"**
   - Configura los permisos necesarios:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Genera un token de acceso del sistema (System User Token)

**Nota**: El token que proporcionaste parece estar codificado. Si es un token permanente, úsalo directamente en `WHATSAPP_META_ACCESS_TOKEN`.

---

## 🔒 Paso 6: Configurar Verify Token

El Verify Token es un string que tú defines para verificar que los webhooks vienen de Meta.

1. Elige un token seguro y largo (ej: `change-this-to-a-long-random-verify-token`)
2. Configúralo en `.env.local`:
   ```
   WHATSAPP_META_VERIFY_TOKEN=change-this-to-a-long-random-verify-token
   ```
3. **Importante**: Usa el mismo token cuando configures el webhook en Meta (Paso 7)

---

## 🌐 Paso 7: Configurar Webhook

### 7.1 Obtener URL del Webhook

Tu webhook debe ser accesible públicamente. Si estás en desarrollo local, usa ngrok:

```bash
ngrok http 3000
```

Copia la URL HTTPS generada (ej: `https://abc123.ngrok.io`)

### 7.2 Configurar en Meta

1. En el dashboard de WhatsApp, ve a **"Configuración"** → **"WhatsApp"** → **"Configuración"**
2. En la sección **"Webhooks"**, haz clic en **"Configurar webhooks"**
3. Completa:
   - **URL de devolución de llamada**: `https://tu-dominio.com/api/webhooks/whatsapp-meta`
     - Desarrollo: `https://abc123.ngrok.io/api/webhooks/whatsapp-meta`
     - Producción: `https://avicoladelsur.vercel.app/api/webhooks/whatsapp-meta`
   - **Token de verificación**: El mismo que configuraste en `.env.local` (ej: `change-this-to-a-long-random-verify-token`)
4. Haz clic en **"Verificar y guardar"**
5. Meta enviará una petición GET a tu webhook para verificar
6. Si todo está bien, verás **"Verificado"** en verde

### 7.3 Suscribirse a Eventos

Después de verificar el webhook, suscríbete a los eventos:

1. En la misma sección de webhooks, haz clic en **"Administrar"**
2. Selecciona los eventos:
   - ✅ **mensajes** (mensajes entrantes)
   - ✅ **estados de mensajes** (enviado, entregado, leído)
3. Guarda los cambios

---

## ⚙️ Paso 8: Configurar Variables de Entorno

Copia las siguientes variables a tu `.env.local`:

```env
# WhatsApp Business API (Meta)
WHATSAPP_META_ACCESS_TOKEN=tu_token_aqui
WHATSAPP_META_PHONE_NUMBER_ID=tu_phone_number_id_aqui
WHATSAPP_META_APP_ID=tu_app_id_aqui
WHATSAPP_META_APP_SECRET=tu_app_secret_aqui
WHATSAPP_META_VERIFY_TOKEN=change-this-to-a-long-random-verify-token
WHATSAPP_META_WEBHOOK_URL=https://tu-dominio.com/api/webhooks/whatsapp-meta

# Proveedor de WhatsApp (meta o twilio)
WHATSAPP_PROVIDER=meta

# Habilitar botones interactivos
WHATSAPP_ENABLE_BUTTONS=true
```

---

## 🧪 Paso 9: Probar la Configuración

### 9.1 Verificar Webhook

1. Envía un mensaje de prueba a tu número de WhatsApp Business
2. Revisa los logs de tu aplicación:
   ```bash
   npm run dev
   ```
3. Deberías ver logs como:
   ```
   [WhatsApp Meta Webhook] Mensaje recibido: { from: '+5493812345678', type: 'text' }
   ```

### 9.2 Probar Botones

1. Envía "hola" o "menu" a tu número
2. Deberías recibir un mensaje con botones interactivos
3. Haz clic en un botón
4. El bot debería responder según el botón presionado

---

## 🔍 Troubleshooting

### Error: "Webhook verification failed"

**Causa**: El Verify Token no coincide.

**Solución**:
1. Verifica que `WHATSAPP_META_VERIFY_TOKEN` en `.env.local` sea exactamente igual al configurado en Meta
2. Reinicia tu servidor después de cambiar variables de entorno

### Error: "Invalid access token"

**Causa**: El Access Token es inválido o expiró.

**Solución**:
1. Verifica que el token esté correctamente copiado (sin espacios)
2. Si es un token temporal, genera uno nuevo
3. Si es permanente, verifica que la aplicación esté en modo producción

### Error: "Phone number ID not found"

**Causa**: El Phone Number ID es incorrecto.

**Solución**:
1. Verifica que el ID sea correcto en Meta Business
2. Asegúrate de que el número esté verificado y activo

### Los botones no aparecen

**Causa**: Los botones están deshabilitados o Meta no está configurado.

**Solución**:
1. Verifica que `WHATSAPP_ENABLE_BUTTONS=true` en `.env.local`
2. Verifica que `WHATSAPP_PROVIDER=meta`
3. Verifica que todas las credenciales de Meta estén configuradas
4. Revisa los logs para ver errores específicos

### Los mensajes no llegan

**Causa**: El webhook no está configurado correctamente.

**Solución**:
1. Verifica que el webhook esté verificado en Meta
2. Verifica que la URL sea accesible públicamente
3. Verifica que los eventos estén suscritos (mensajes, estados)
4. Revisa los logs del servidor para ver errores

---

## 📚 Recursos Adicionales

- [Documentación oficial de WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Guía de mensajes interactivos](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/interactive-messages)
- [Referencia de API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference)

---

## 🔄 Migración desde Twilio

Si estás migrando desde Twilio Sandbox:

1. **Fase 1**: Configura Meta manteniendo Twilio activo
2. **Fase 2**: Prueba ambos sistemas en paralelo
3. **Fase 3**: Cambia `WHATSAPP_PROVIDER=meta` cuando estés listo
4. **Fase 4**: Deshabilita Twilio (el código se mantiene como respaldo)

El sistema detecta automáticamente qué proveedor usar según la configuración.

---

## ✅ Checklist de Configuración

- [ ] Aplicación creada en Meta for Developers
- [ ] App ID y App Secret obtenidos
- [ ] WhatsApp Business API agregado a la aplicación
- [ ] Número de teléfono verificado
- [ ] Phone Number ID obtenido
- [ ] Access Token permanente generado
- [ ] Verify Token configurado
- [ ] Webhook configurado y verificado
- [ ] Eventos suscritos (mensajes, estados)
- [ ] Variables de entorno configuradas
- [ ] Pruebas realizadas exitosamente

---

**Última actualización**: Enero 2025

