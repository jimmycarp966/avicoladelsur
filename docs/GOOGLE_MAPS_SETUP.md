# 🗺️ Configuración de Google Maps API Key

Esta guía te ayudará a obtener y configurar la API Key de Google Maps para habilitar la optimización de rutas con Google Directions API.

## 📋 Requisitos Previos

- Cuenta de Google (Gmail)
- Tarjeta de crédito (Google ofrece $200 USD de crédito gratuito mensual)

## 🚀 Pasos para Obtener la API Key

### Paso 1: Acceder a Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Inicia sesión con tu cuenta de Google

### Paso 2: Crear o Seleccionar un Proyecto

1. En la parte superior, haz clic en el selector de proyectos
2. Si ya tienes un proyecto, selecciónalo
3. Si no, haz clic en **"Nuevo Proyecto"**:
   - **Nombre del proyecto**: `Avicola del Sur ERP` (o el que prefieras)
   - Haz clic en **"Crear"**
   - Espera unos segundos a que se cree el proyecto

### Paso 3: Habilitar la API de Directions

1. En el menú lateral, ve a **"APIs y servicios"** → **"Biblioteca"**
2. Busca **"Directions API"**
3. Haz clic en el resultado
4. Haz clic en **"Habilitar"**
5. Espera a que se habilite (puede tardar unos segundos)

**Nota**: También puedes habilitar **"Maps JavaScript API"** si planeas usar mapas interactivos en el futuro, pero no es necesario para la optimización de rutas.

### Paso 4: Crear Credenciales (API Key)

1. En el menú lateral, ve a **"APIs y servicios"** → **"Credenciales"**
2. Haz clic en **"+ CREAR CREDENCIALES"** en la parte superior
3. Selecciona **"Clave de API"**
4. Se creará una API Key automáticamente
5. **¡IMPORTANTE!** Copia la API Key inmediatamente (aparece en un popup)

### Paso 5: Configurar Restricciones de Seguridad (Recomendado)

**⚠️ CRÍTICO**: Sin restricciones, cualquiera que tenga tu API Key puede usarla y generar costos.

1. En la lista de credenciales, haz clic en el nombre de tu API Key (o en el ícono de editar)
2. En **"Restricciones de aplicación"**, selecciona:
   - **"Direcciones IP"** (para servidor) o
   - **"Sitios web HTTP"** (si vas a usar en frontend)
3. Agrega las restricciones:
   - **Para desarrollo local**: `localhost` o tu IP local
   - **Para producción**: Tu dominio (ej: `https://tudominio.com`)
4. En **"Restricciones de API"**, selecciona:
   - **"Limitar claves"**
   - Marca solo **"Directions API"**
5. Haz clic en **"Guardar"**

### Paso 6: Configurar Facturación (Opcional pero Recomendado)

1. Ve a **"Facturación"** en el menú lateral
2. Si no tienes una cuenta de facturación, créala:
   - Google ofrece **$200 USD de crédito gratuito** mensual
   - Esto cubre aproximadamente **40,000 requests** de Directions API
3. Asocia tu proyecto con la cuenta de facturación

**Costos estimados:**
- **Directions API**: $5 USD por cada 1,000 requests
- **Con crédito gratuito**: Puedes hacer ~40,000 requests/mes sin costo
- **Para 10 rutas/día con 20 paradas**: ~$1.50 USD/mes

## ⚙️ Configurar en el Proyecto

### Opción 1: Archivo `.env.local` (Desarrollo Local)

1. En la raíz del proyecto, crea o edita el archivo `.env.local`
2. Agrega la siguiente línea:

```env
GOOGLE_MAPS_API_KEY=tu-api-key-aqui
```

3. Reemplaza `tu-api-key-aqui` con la API Key que copiaste en el Paso 4
4. **IMPORTANTE**: El archivo `.env.local` está en `.gitignore`, así que no se subirá al repositorio

### Opción 2: Variables de Entorno del Servidor (Producción)

Si estás usando **Vercel**, **Netlify** u otro servicio:

1. Ve a la configuración de tu proyecto
2. Busca la sección **"Environment Variables"** o **"Variables de Entorno"**
3. Agrega:
   - **Nombre**: `GOOGLE_MAPS_API_KEY`
   - **Valor**: Tu API Key
4. Guarda y redespliega la aplicación

**Ejemplo para Vercel:**
```bash
# Desde la CLI de Vercel
vercel env add GOOGLE_MAPS_API_KEY
# Pega tu API Key cuando se solicite
```

## ✅ Verificar que Funciona

### Método 1: Verificar en el Código

El sistema detecta automáticamente si la API Key está configurada. Si no está, usa el algoritmo local (fallback).

Para verificar, puedes revisar los logs del servidor cuando generes una ruta:

```bash
# Si Google está disponible, verás:
# "Ruta optimizada con Google Directions"

# Si no está disponible, verás:
# "Google Directions no disponible, usando fallback local"
```

### Método 2: Probar el Endpoint

```bash
# Probar endpoint interno (requiere autenticación)
curl -X POST http://localhost:3000/api/integrations/google/directions \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": -27.1671, "lng": -65.4995},
    "destination": {"lat": -27.1856, "lng": -65.4923},
    "waypoints": [{"lat": -27.1758, "lng": -65.4959}],
    "optimize": true
  }'
```

### Método 3: Usar el Script de Demo

```bash
./scripts/demo-rutas.sh
```

El script intentará usar Google Directions primero, y si falla, usará el fallback local automáticamente.

## 🔒 Seguridad

### ✅ Buenas Prácticas

1. **Nunca subas la API Key al repositorio**
   - El archivo `.env.local` ya está en `.gitignore`
   - Verifica que no esté en commits anteriores

2. **Usa restricciones de API**
   - Limita la API Key solo a "Directions API"
   - No habilites todas las APIs de Google Maps

3. **Usa restricciones de aplicación**
   - Limita por IP (servidor) o dominio (frontend)
   - Esto previene uso no autorizado

4. **Monitorea el uso**
   - Revisa regularmente en Google Cloud Console
   - Configura alertas de facturación

### ❌ Qué NO Hacer

- ❌ No compartas la API Key públicamente
- ❌ No la incluyas en código fuente
- ❌ No uses la misma API Key en múltiples proyectos sin restricciones
- ❌ No dejes la API Key sin restricciones en producción

## 🆘 Solución de Problemas

### Error: "GOOGLE_MAPS_API_KEY no está configurada"

**Solución**: Verifica que la variable esté en `.env.local` y reinicia el servidor de desarrollo:

```bash
# Detener el servidor (Ctrl+C)
# Reiniciar
npm run dev
```

### Error: "API key not valid"

**Posibles causas:**
1. La API Key está mal copiada (verifica espacios o caracteres extra)
2. La API Key fue revocada o eliminada
3. Las restricciones de IP/dominio están bloqueando tu solicitud

**Solución**: 
- Verifica la API Key en Google Cloud Console
- Revisa las restricciones de aplicación
- Prueba temporalmente sin restricciones (solo para debug)

### Error: "This API project is not authorized to use this API"

**Solución**: 
- Verifica que hayas habilitado "Directions API" en el proyecto
- Espera unos minutos después de habilitar (puede tardar en propagarse)

### El sistema siempre usa fallback local

**Posibles causas:**
1. La variable de entorno no está configurada correctamente
2. El servidor no se reinició después de agregar la variable
3. Hay un error en la API Key

**Solución**:
- Verifica que `GOOGLE_MAPS_API_KEY` esté en `.env.local`
- Reinicia el servidor
- Revisa los logs del servidor para ver el error específico

## 📚 Recursos Adicionales

- [Documentación de Google Directions API](https://developers.google.com/maps/documentation/directions)
- [Guía de Precios de Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Mejores Prácticas de Seguridad](https://developers.google.com/maps/api-security-best-practices)

## 💡 Nota Importante

**El sistema funciona perfectamente sin Google Maps API Key**. Si no la configuras, usará automáticamente el algoritmo local (Nearest Neighbor + 2-opt) que es:
- ✅ Gratis
- ✅ Adecuado para 5-50 paradas
- ✅ No requiere configuración adicional
- ✅ Funciona offline

La API Key de Google solo es necesaria si:
- Tienes más de 50 paradas por ruta
- Necesitas optimización más precisa
- Quieres usar datos de tráfico en tiempo real

