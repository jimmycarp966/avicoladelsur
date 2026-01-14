# Plan: Routing Híbrido (Google Maps + OpenRouteService/OSRM)

Este plan migra el cálculo de rutas a OpenStreetMap (OpenRouteService u OSRM) manteniendo Google Maps para visualización y marcadores.

## Objetivo
Usar datos actualizados de OSM para routing, conservando la UI de Google Maps (mapa, pins, polylines) y resolviendo el problema de calles mal mapeadas en Google.

## Alcance
- Reparto (NavigationView, NavigationInteractivo, ruta-mapa-content)
- Monitor GPS (MonitorMap)
- API de rutas alternativas
- Geocoding: se puede seguir con Google (sin cambios)

## Fases

### Fase 1 – Configuración
1) Elegir proveedor OSM para routing:
   - Opción A (recomendada): **OpenRouteService** (gratis 2,000 req/día; €49/mes si se escala)
   - Opción B: **OSRM self-hosted** (gratis, requiere VPS €5-20/mes)
2) Variables de entorno:
   - OPENROUTESERVICE_API_KEY (si se elige ORS)
   - OSRM_BASE_URL (si se elige OSRM)
3) No tocar Google Maps para mapa/pins.

### Fase 2 – Implementación
1) Crear wrapper OSM:
   - Archivo: `src/lib/rutas/ors-directions.ts` o `osrm-directions.ts`
   - Función: `getDirectionsOSM(request) -> { polyline, distance, duration, provider }`
2) Actualizar frontend:
   - `MonitorMap.tsx`: reemplazar llamada a Google Directions por wrapper OSM (mantener fallback a Google/local)
   - `NavigationView.tsx`: calcular ruta con wrapper OSM, decodificar polyline y dibujar en Google Maps
   - `NavigationInteractivo.tsx`: usar `/api/rutas/alternativas` actualizado
3) Actualizar API:
   - `src/app/api/rutas/alternativas/route.ts`: llamar wrapper OSM (ORS/OSRM) y retornar rutas alternativas

### Fase 3 – Pruebas
1) Casos con calles de sentido único mal en Google (los que dieron problemas)
2) Recalcular rutas en NavigationView y MonitorMap (consola: ver `provider: osm`)
3) Comparar distancia/tiempo vs Google; validar que respete sentidos

### Fase 4 – Rollout
1) Si todo ok: dejar OSM como default, Google como fallback
2) Si hay zonas rurales sin buen dato OSM: ruta híbrida por zona (OSM para zonas conflictivas, Google para el resto)

## Cambios previstos (archivos)
- Nuevo: `src/lib/rutas/ors-directions.ts` (o `osrm-directions.ts`)
- `src/components/reparto/MonitorMap.tsx`
- `src/components/reparto/NavigationView.tsx`
- `src/components/reparto/NavigationInteractivo.tsx`
- `src/app/api/rutas/alternativas/route.ts`

## Riesgos y mitigación
- Límite de 2,000 req/día en ORS → monitorizar; pasar a plan €49/mes si se supera
- OSRM requiere VPS y mantenimiento → elegir ORS si no quieres operar servidores
- Datos OSM faltantes en alguna zona → mantener fallback a Google

## Decisión a tomar
- ¿Proveedor? ORS (fácil, sin servidor) o OSRM (gratis pero con VPS)
- Confirmar para arrancar implementación
