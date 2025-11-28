#!/bin/bash

# ===========================================
# Script de Demo: Rutas Optimizadas y Tracking
# ===========================================
# 
# Este script demuestra el flujo completo de:
# 1. Generación de rutas optimizadas (Google o local)
# 2. Simulación de tracking GPS
# 3. Verificación de alertas
#
# Requisitos:
# - Variables de entorno configuradas (.env.local)
# - Supabase corriendo y migraciones aplicadas
# - curl instalado
# ===========================================

set -e

BASE_URL="${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api"

echo "🚀 Demo: Rutas Optimizadas y Tracking"
echo "======================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar que el servidor esté corriendo
echo "📡 Verificando conexión con el servidor..."
if ! curl -s -f "${BASE_URL}" > /dev/null; then
    print_error "No se puede conectar a ${BASE_URL}"
    print_warning "Asegúrate de que el servidor Next.js esté corriendo (npm run dev)"
    exit 1
fi
print_success "Servidor conectado"

echo ""
echo "📋 Paso 1: Verificar migraciones aplicadas"
echo "-------------------------------------------"
print_warning "Asegúrate de haber ejecutado la migración 20251124_rutas_tracking.sql"
read -p "¿Las migraciones están aplicadas? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_error "Por favor, aplica las migraciones primero"
    exit 1
fi

echo ""
echo "📋 Paso 2: Crear ruta de prueba"
echo "-------------------------------------------"
print_warning "Para este demo, necesitas tener:"
print_warning "- Una ruta existente en rutas_reparto"
print_warning "- Pedidos asignados a esa ruta con coordenadas de clientes"
print_warning "Tip: al confirmar un presupuesto ahora se crea/actualiza la ruta diaria automáticamente (fecha + zona + turno)."
echo ""
read -p "Ingresa el ID de una ruta existente (o presiona Enter para usar demo): " RUTA_ID

if [ -z "$RUTA_ID" ]; then
    print_warning "Usando ruta de demo (necesitarás crear una manualmente)"
    RUTA_ID="demo-ruta-id"
fi

echo ""
echo "📋 Paso 3: Generar ruta optimizada (con Google)"
echo "-------------------------------------------"
echo "Intentando generar ruta con Google Directions API..."
RESPONSE=$(curl -s -X POST "${API_URL}/rutas/generar" \
    -H "Content-Type: application/json" \
    -d "{
        \"rutaId\": \"${RUTA_ID}\",
        \"usarGoogle\": true
    }")

if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Ruta optimizada con Google Directions"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
    print_warning "Google Directions no disponible o falló, usando fallback local"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

echo ""
echo "📋 Paso 4: Generar ruta optimizada (fallback local)"
echo "-------------------------------------------"
RESPONSE=$(curl -s -X POST "${API_URL}/rutas/generar" \
    -H "Content-Type: application/json" \
    -d "{
        \"rutaId\": \"${RUTA_ID}\",
        \"usarGoogle\": false
    }")

if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Ruta optimizada con algoritmo local (Nearest Neighbor + 2-opt)"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
    print_error "Error al generar ruta local"
    echo "$RESPONSE"
    exit 1
fi

echo ""
echo "📋 Paso 5: Simular tracking GPS"
echo "-------------------------------------------"
print_warning "Simulando 5 ubicaciones GPS cada 5 segundos..."
echo ""

# Coordenadas de ejemplo (Monteros, Tucumán)
LAT_BASE=-27.1671
LNG_BASE=-65.4995

for i in {1..5}; do
    LAT=$(echo "$LAT_BASE + ($i * 0.001)" | bc)
    LNG=$(echo "$LNG_BASE + ($i * 0.001)" | bc)
    
    echo "📍 Enviando ubicación $i/5: lat=$LAT, lng=$LNG"
    
    RESPONSE=$(curl -s -X POST "${API_URL}/reparto/ubicacion" \
        -H "Content-Type: application/json" \
        -d "{
            \"repartidorId\": \"demo-repartidor-id\",
            \"vehiculoId\": \"demo-vehiculo-id\",
            \"lat\": $LAT,
            \"lng\": $LNG
        }")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Ubicación $i enviada correctamente"
    else
        print_warning "Error al enviar ubicación $i (puede ser por autenticación)"
        echo "$RESPONSE"
    fi
    
    if [ $i -lt 5 ]; then
        sleep 2
    fi
done

echo ""
echo "📋 Paso 6: Obtener ubicaciones actuales"
echo "-------------------------------------------"
RESPONSE=$(curl -s -X GET "${API_URL}/reparto/ubicaciones")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "📋 Paso 7: Obtener recorrido de ruta"
echo "-------------------------------------------"
RESPONSE=$(curl -s -X GET "${API_URL}/rutas/${RUTA_ID}/recorrido")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "📋 Paso 8: Verificar alertas"
echo "-------------------------------------------"
RESPONSE=$(curl -s -X GET "${API_URL}/reparto/alertas")
if echo "$RESPONSE" | grep -q '"success":true'; then
    ALERTAS_COUNT=$(echo "$RESPONSE" | jq '.data | length' 2>/dev/null || echo "0")
    if [ "$ALERTAS_COUNT" -gt 0 ]; then
        print_warning "Se encontraron $ALERTAS_COUNT alertas"
        echo "$RESPONSE" | jq '.data' 2>/dev/null || echo "$RESPONSE"
    else
        print_success "No hay alertas activas"
    fi
else
    print_warning "No se pudieron obtener alertas (puede ser por autenticación)"
    echo "$RESPONSE"
fi

echo ""
echo "======================================"
print_success "Demo completada"
echo ""
echo "📝 Próximos pasos:"
echo "1. Abre /reparto/monitor en el navegador para ver el mapa en tiempo real"
echo "2. Abre /repartidor/ruta/[ruta_id] para ver la PWA con GPS tracker"
echo "3. Verifica las alertas en /reparto/alertas (si existe la página)"
echo ""
echo "🔧 Para probar con datos reales:"
echo "- Crea una ruta en /reparto/rutas"
echo "- Asigna pedidos con coordenadas de clientes"
echo "- Usa el ID de la ruta en este script"
echo ""

