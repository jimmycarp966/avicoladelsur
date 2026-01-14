# Instrucciones de Configuración - GraphHopper

## Resumen

Se ha implementado GraphHopper como proveedor de routing alternativo a Google Maps para solucionar el problema de rutas incorrectas por sentidos únicos. El sistema usa GraphHopper primero, con fallback automático a Google Maps y finalmente al optimizador local.

## Pasos para Configurar

### 1. Obtener API Key de GraphHopper

1. Ir a https://graphhopper.com/
2. Registrarse o iniciar sesión
3. Ir a "Dashboard" → "API Keys"
4. Crear una nueva API Key
5. Copiar la API Key

**Plan gratuito**: 1 vehículo (suficiente para pruebas limitadas)

**Plan pago**: Desde €60/mes para 2 vehículos (escalable según cantidad de vehículos)

### 2. Configurar Variables de Entorno 

Crear o editar el archivo `.env.local` en la raíz del proyecto:

```bash
# Google Maps API (existente - mantener)
GOOGLE_MAPS_API_KEY=tu_google_maps_api_key_aqui

# GraphHopper API (nuevo)
GRAPHHOPPER_API_KEY=tu_graphhopper_api_key_aqui
```

**Nota**: No es necesario agregar `GRAPHHOPPER_ENABLED` ni `GRAPHHOPPER_FALLBACK_TO_GOOGLE` ya que el sistema maneja esto automáticamente.

### 3. Reiniciar el Servidor de Desarrollo

```bash
# Detener el servidor actual (Ctrl+C)
npm run dev
```

## Cómo Funciona el Sistema

### Orden de Proveedores (Fallback Automático)

1. **GraphHopper** (primera opción)
   - Usa datos de OpenStreetMap
   - Mejor manejo de sentidos únicos
   - Correcciones más rápidas

2. **Google Maps** (fallback si GraphHopper falla)
   - Se usa si GraphHopper no responde o da error
   - Mantiene compatibilidad con sistema existente

3. **Local Optimizer** (último fallback)
   - Algoritmo Nearest Neighbor + 2-opt
   - Solo usa distancia euclidiana
   - No respeta restricciones de vías

### Componentes Modificados

| Componente | Archivo | Cambio |
|------------|---------|--------|
| Wrapper GraphHopper | `src/lib/rutas/graphhopper-directions.ts` | Nuevo archivo |
| Monitor GPS | `src/components/reparto/MonitorMap.tsx` | Usa GraphHopper |
| Navegación Repartidor | `src/components/reparto/NavigationView.tsx` | Usa GraphHopper |
| API Rutas Alternativas | `src/app/api/rutas/alternativas/route.ts` | Usa GraphHopper |

## Pruebas

### 1. Verificar que GraphHopper Funciona

Abrir la consola del navegador (F12) y navegar a:
- Monitor GPS: `/monitor-gps`
- Vista del repartidor: `/ruta/[rutaId]`

Buscar logs como:
```
[GraphHopper] Consultando API...
[GraphHopper] Proveedor usado: graphhopper
```

### 2. Verificar Fallback a Google

Si GraphHopper falla (ej: API key inválida), deberías ver:
```
[Routing] GraphHopper falló, intentando Google...
[Routing] ✅ Usando Google Directions (fallback)
```

### 3. Comparar Rutas

1. Elegir una ruta con problemas conocidos de sentidos únicos
2. Verificar que la ruta ahora respeta los sentidos correctos
3. Comparar con Google Maps para ver diferencias

## Logs Importantes

### Monitor GPS
```
🎨 [DEBUG] Polyline insuficiente, solicitando ruta real con GraphHopper/Google para ruta X
🗺️ [DEBUG] Proveedor usado: graphhopper
✅ [DEBUG] Ruta obtenida para ruta X (provider: graphhopper)
```

### NavigationView
```
[NavigationView] requesting route with GraphHopper/Google fallback...
[NavigationView] Route received from provider: graphhopper
```

### API Rutas Alternativas
```
[API rutas/alternativas] Proveedor usado: graphhopper
[API rutas/alternativas] Rutas encontradas: 3
```

## Solución de Problemas

### Error: "GRAPHHOPPER_API_KEY no está configurada"

**Causa**: No se configuró la API key en `.env.local`

**Solución**: Agregar `GRAPHHOPPER_API_KEY=tu_api_key` en `.env.local` y reiniciar el servidor

### Error: "HTTP error: 403 Forbidden"

**Causa**: API key inválida o límite de requests alcanzado

**Solución**: 
- Verificar que la API key sea correcta
- Verificar el límite de requests en el dashboard de GraphHopper
- Considerar plan pago si se excede el límite gratuito

### Las rutas siguen siendo incorrectas

**Causa**: Los datos de OpenStreetMap pueden tener errores en tu zona

**Soluciones**:
1. Reportar el error en OpenStreetMap: https://www.openstreetmap.org/fixthemap
2. Esperar a que GraphHopper actualice sus datos (generalmente 1-2 semanas)
3. Considerar self-hosting GraphHopper con datos personalizados

### El sistema siempre usa Google Maps

**Causa**: GraphHopper puede estar fallando silenciosamente

**Solución**: Verificar logs para ver por qué GraphHopper falla

## Próximos Pasos (Opcionales)

### Self-Hosting GraphHopper

Si necesitas más control o mejor cobertura local:

1. Instalar GraphHopper en servidor propio
2. Importar datos de OpenStreetMap de Argentina
3. Configurar custom profiles para camiones
4. Modificar `GRAPHHOPPER_API_URL` en `graphhopper-directions.ts`

### Route Optimization API

GraphHopper tiene una API especializada para VRP (Vehicle Routing Problem):

- Optimiza múltiples rutas simultáneamente
- Considera ventanas de tiempo
- Soporta múltiples vehículos

### Monitoreo y Métricas

Agregar tracking de:
- Cuántas rutas usa cada proveedor
- Tiempos de respuesta
- Errores por proveedor

## Soporte

- Documentación GraphHopper: https://docs.graphhopper.com/
- OpenStreetMap: https://www.openstreetmap.org/
- Plan de implementación: `.windsurf/plans/graphhopper-migration-plan.md`
