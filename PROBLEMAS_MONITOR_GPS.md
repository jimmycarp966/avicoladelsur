# 🔍 Análisis de Problemas en Monitor GPS

## Problemas Identificados en la Visualización del Mapa

### ❌ Problema 1: No Escucha el Evento de Carga de Google Maps
**Ubicación**: `src/components/reparto/MonitorMap.tsx` línea 670-676

**Descripción**: 
- El componente `MonitorMap` solo verifica una vez si `window.google` existe
- No escucha el evento personalizado `'google-maps-loaded'` que emite `GoogleMapsScript`
- Si Google Maps carga asincrónicamente, puede fallar la inicialización

**Comparación**:
- `RutaMap.tsx` (líneas 492-571) tiene la lógica correcta con event listener
- `MonitorMap.tsx.backup` también tenía esta lógica pero fue eliminada

### ❌ Problema 2: Falta Validación Completa de APIs
**Ubicación**: `src/components/reparto/MonitorMap.tsx` línea 672

**Descripción**:
- Solo verifica `window.google` pero no valida que todas las APIs necesarias estén disponibles:
  - `window.google.maps.Map`
  - `window.google.maps.Marker`
  - `window.google.maps.Polyline`
  - `window.google.maps.InfoWindow`
  - `window.google.maps.LatLng`
  - `window.google.maps.LatLngBounds`
  - `window.google.maps.geometry.encoding` (usado en línea 438)

**Impacto**: Si alguna API no está cargada, el mapa puede inicializarse parcialmente y fallar después

### ❌ Problema 3: No Tiene Lógica de Reintentos
**Ubicación**: `src/components/reparto/MonitorMap.tsx` línea 670-676

**Descripción**:
- No hay mecanismo de reintentos si Google Maps no está listo inmediatamente
- Si el script carga tarde, el componente no lo detecta

**Comparación**:
- `RutaMap.tsx` tiene un loop de reintentos con `maxRetries = 30` y intervalo de 500ms

### ❌ Problema 4: Verificación de API Key Incompleta
**Ubicación**: `src/components/reparto/MonitorMap.tsx` línea 109-119

**Descripción**:
- Solo espera 3 segundos para detectar Google Maps
- Si la API key está mal configurada pero el script intenta cargar, el timeout puede ser insuficiente
- No diferencia entre "no configurado" y "cargando"

### ❌ Problema 5: Dependencias del useEffect Incorrectas
**Ubicación**: `src/components/reparto/MonitorMap.tsx` línea 670-676

**Descripción**:
- El `useEffect` solo depende de `initializeMap` y `mapsLoaded`
- Si `window.google` cambia después del primer render, no se detecta
- No hay limpieza de event listeners

### ✅ Solución Recomendada

Reemplazar el `useEffect` de inicialización (líneas 670-676) con una implementación similar a `RutaMap.tsx` que incluya:

1. **Event Listener** para `'google-maps-loaded'`
2. **Validación completa** de todas las APIs necesarias
3. **Lógica de reintentos** con timeout
4. **Limpieza adecuada** de listeners y timeouts

## Impacto de los Problemas

- 🔴 **Alta**: El mapa puede no mostrarse si Google Maps carga lentamente
- 🟡 **Media**: Errores en consola si las APIs no están listas
- 🟡 **Media**: Experiencia de usuario degradada con mensajes de error confusos

