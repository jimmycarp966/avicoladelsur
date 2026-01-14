# Alternativas Económicas a GraphHopper

## Problema
El mapa de Google Maps **no está actualizado** - tiene datos desactualizados sobre qué calles son de sentido único. Google tarda meses en actualizar su mapa, lo que causa rutas incorrectas en el sistema de reparto.

## Alternativas Gratuitas o de Bajo Costo

### 1. OSRM (Open Source Routing Machine) - GRATIS
**Costo**: $0 (self-hosteado)

**Ventajas**:
- Completamente gratis y open-source
- Ultra rápido (miles de requests/segundo)
- Usa datos de OpenStreetMap (correcciones rápidas)
- Sin límites de API
- Control total sobre datos

**Desventajas**:
- Requiere servidor propio (VPS desde $5/mes)
- Preprocesamiento de datos toma tiempo (varias horas para Argentina)
- No tiene Route Optimization API (solo routing básico)
- Requiere mantenimiento del servidor

**Infraestructura necesaria**:
- VPS con 4GB+ RAM (DigitalOcean: $20/mes, Hetzner: €5/mes)
- Almacenamiento: ~20GB para datos de Argentina
- Docker para despliegue fácil

**Implementación**:
```bash
# Instalar OSRM con Docker
docker pull osrm/osrm-backend

# Descargar datos de Argentina
wget https://download.geofabrik.de/south-america/argentina-latest.osm.pbf

# Procesar datos (toma 2-4 horas)
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /data/car.lua /data/argentina-latest.osm.pbf

# Iniciar servidor
docker run -t -i -p 5000:5000 -v "${PWD}:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/argentina-latest.osrm
```

**API**:
```
GET http://localhost:5000/route/v1/driving/{lng},{lat};{lng},{lat}?overview=full&geometries=polyline
```

---

### 2. pgRouting + PostGIS - GRATIS
**Costo**: $0 (ya tienes Supabase)

**Ventajas**:
- **Ya tienes PostgreSQL/Supabase**
- Extensión nativa gratuita
- Funciones `pgr_trsp` con restricciones de giro
- Maneja etiquetas `oneway` de OSM automáticamente
- Integrado con tu base de datos existente
- Sin costo adicional de infraestructura

**Desventajas**:
- Requiere migración de datos de OSM a PostGIS
- Preprocesamiento complejo
- Más lento que OSRM
- Requiere conocimientos de SQL avanzado

**Implementación**:
```sql
-- Habilitar extensiones en Supabase
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- Crear tabla de red vial
CREATE TABLE road_network (
  id SERIAL PRIMARY KEY,
  source INTEGER,
  target INTEGER,
  cost FLOAT,
  reverse_cost FLOAT,  -- -1 para oneway
  oneway BOOLEAN,
  the_geom GEOMETRY(LINESTRING, 4326)
);

-- Función para calcular ruta
CREATE OR REPLACE FUNCTION calculate_route(
  start_lat FLOAT,
  start_lng FLOAT,
  end_lat FLOAT,
  end_lng FLOAT
) RETURNS TABLE(path geometry) AS $$
BEGIN
  RETURN QUERY
  SELECT pgr_dijkstra(
    'SELECT id, source, target, cost, reverse_cost FROM road_network',
    (SELECT source FROM road_network ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(start_lng, start_lat), 4326) LIMIT 1),
    (SELECT target FROM road_network ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(end_lng, end_lat), 4326) LIMIT 1),
    directed := true
  );
END;
$$ LANGUAGE plpgsql;
```

**Herramientas para importar OSM**:
- `osm2pgrouting` - Convierte OSM a pgRouting
- `osmosis` - Procesa datos OSM

---

### 3. OpenRouteService - GRATIS (Generoso)
**Costo**: $0 (plan gratuito) / €49/mes (plan profesional)

**Plan gratuito**:
- 2,000 requests/día
- Sin límite de vehículos
- Datos de OpenStreetMap
- Respetan sentidos únicos
- API REST sencilla

**Ventajas**:
- **No requiere infraestructura propia**
- Plan gratuito generoso (2,000 requests/día)
- Fácil de implementar
- Datos actualizados de OSM
- Soporta múltiples modos de transporte

**Desventajas**:
- Límite de 2,000 requests/día en plan gratuito
- Menos control sobre datos
- Posible latencia por ser servicio externo

**Para tu caso**:
- Si tienes ~5 rutas/día con 10 recálculos/ruta = 50 requests/día
- Plan gratuito es suficiente para pruebas y producción moderada
- Si necesitas más: plan profesional €49/mes (aún más barato que GraphHopper)

**API**:
```
GET https://api.openrouteservice.org/v2/directions/driving?start={lng},{lat}&end={lng},{lat}
Headers: Authorization: tu_api_key
```

---

### 4. Valhalla - GRATIS
**Costo**: $0 (self-hosteado)

**Ventajas**:
- Completamente gratis y open-source
- Más moderno que OSRM
- Mejor manejo de restricciones complejas
- Soporta múltiples perfiles de vehículos
- Datos de OpenStreetMap

**Desventajas**:
- Requiere servidor propio
- Curva de aprendizaje más pronunciada
- Comunidad más pequeña que OSRM
- Documentación menos completa

**Infraestructura necesaria**:
- Similar a OSRM (VPS con 4GB+ RAM)
- Docker para despliegue

---

### 5. Mantener Google Maps + Reportar Errores en OSM
**Costo**: $0 (además de Google Maps que ya usas)

**Ventajas**:
- Sin cambio de infraestructura
- Google Maps eventualmente corrige los datos
- Funciona bien en la mayoría de casos

**Desventajas**:
- **Las correcciones demoran meses**
- No tienes control sobre cuándo se corrigen
- Google puede ignorar reportes de OSM
- No resuelve el problema a corto plazo

**Cómo reportar**:
1. Ir a https://www.openstreetmap.org/
2. Encontrar la calle con problema
3. Editar y corregir el sentido
4. Esperar 1-3 meses para que Google actualice

---

## Recomendación por Prioridad

### Opción 1: OpenRouteService (Más Fácil y Económico)
**Por qué**:
- Plan gratuito generoso (2,000 requests/día)
- No requiere infraestructura propia
- Fácil de implementar
- Respetan sentidos únicos
- Datos de OpenStreetMap

**Costo**: $0 (gratis) hasta 2,000 requests/día

**Para tu caso**:
- Si tienes ~5 rutas/día × 10 recálculos = 50 requests/día
- El plan gratuito es suficiente
- Si necesitas más: €49/mes (más barato que GraphHopper)

---

### Opción 2: pgRouting + PostGIS (Mejor Integración)
**Por qué**:
- **Ya tienes Supabase**
- Sin costo adicional
- Integrado con tu base de datos
- Control total

**Costo**: $0 (gratis)

**Desventaja**: Requiere migración de datos OSM → PostGIS (complejo)

---

### Opción 3: OSRM Self-Hosteado (Mejor Performance)
**Por qué**:
- Completamente gratis
- Ultra rápido
- Sin límites de requests

**Costo**: $5-20/mes (VPS)

**Desventaja**: Requiere mantenimiento del servidor

---

## Comparación de Costos

| Solución | Costo Mensual | Requests/día | Infraestructura | Dificultad |
|----------|---------------|--------------|-----------------|------------|
| **OpenRouteService** | $0 (gratis) | 2,000 | Ninguna | Fácil |
| **pgRouting + PostGIS** | $0 (gratis) | Ilimitado | Supabase (existente) | Media |
| **OSRM** | $5-20 (VPS) | Ilimitado | VPS propio | Media |
| **Valhalla** | $5-20 (VPS) | Ilimitado | VPS propio | Difícil |
| **GraphHopper** | €60 | Ilimitado | Ninguna | Fácil |
| **Google Maps** | $200+ | Ilimitado | Ninguna | Fácil |

---

## Próximos Pasos

### Si eliges OpenRouteService (Recomendado):

1. **Registrarse**: https://openrouteservice.org/
2. **Obtener API Key gratuita**
3. **Configurar en `.env.local`**:
```bash
OPENROUTESERVICE_API_KEY=tu_api_key_aqui
```
4. **Modificar wrapper** para usar OpenRouteService
5. **Probar** con rutas problemáticas

### Si eliges pgRouting:

1. **Habilitar extensiones** en Supabase
2. **Importar datos de OSM** con `osm2pgrouting`
3. **Crear funciones** de routing
4. **Modificar wrapper** para usar pgRouting

### Si eliges OSRM:

1. **Alquilar VPS** (Hetzner: €5/mes)
2. **Instalar OSRM** con Docker
3. **Procesar datos** de Argentina (2-4 horas)
4. **Modificar wrapper** para usar OSRM

---

## Mi Recomendación

**OpenRouteService** por:
- Plan gratuito generoso (suficiente para tu caso)
- Implementación sencilla (similar a GraphHopper)
- Sin costo de infraestructura
- Datos de OpenStreetMap (correcciones rápidas)
- Solo €49/mes si necesitas más que el plan gratuito

¿Quieres que implemente OpenRouteService en lugar de GraphHopper?
