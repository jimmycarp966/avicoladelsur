#!/bin/bash

# Demo completo del módulo de Sucursales
# Ejecutar: ./scripts/demo-sucursales.sh

set -e

BASE_URL="http://localhost:3000"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función de logging
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] INFO: $1${NC}"
}

# Función para hacer requests HTTP
make_request() {
    local method=$1
    local url=$2
    local data=$3

    if [ -n "$data" ]; then
        curl -s -X "$method" "$BASE_URL$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\nHTTP_STATUS:%{http_code}"
    else
        curl -s -X "$method" "$BASE_URL$url" \
            -w "\nHTTP_STATUS:%{http_code}"
    fi
}

# Verificar que el servicio esté corriendo
check_service() {
    log "Verificando que el servicio esté disponible..."
    if curl -s --head --fail "$BASE_URL" > /dev/null 2>&1; then
        log "✅ Servicio disponible"
        return 0
    else
        error "Servicio no disponible en $BASE_URL"
        error "Asegúrate de ejecutar: npm run dev"
        exit 1
    fi
}

# Demo paso a paso
demo_step_1_crear_sucursal() {
    log "=== PASO 1: Creando sucursal de prueba ==="

    local sucursal_data='{
        "nombre": "Sucursal Demo Norte",
        "direccion": "Av. Principal 123, Ciudad Norte",
        "telefono": "381-555-0100",
        "active": true
    }'

    info "Creando sucursal 'Sucursal Demo Norte'..."
    local response=$(make_request "POST" "/api/sucursales" "$sucursal_data")
    local status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_STATUS:/d')

    if [ "$status" -eq 200 ]; then
        local sucursal_id=$(echo "$body" | grep -o '"sucursalId":"[^"]*"' | cut -d'"' -f4)
        log "✅ Sucursal creada exitosamente. ID: $sucursal_id"
        echo "$sucursal_id"
    else
        error "Error creando sucursal: $body"
        return 1
    fi
}

demo_step_2_configurar_umbral() {
    local sucursal_id=$1
    log "=== PASO 2: Configurando umbral de stock bajo ==="

    local config_data='{
        "sucursalId": "'$sucursal_id'",
        "lowStockThresholdDefault": 3
    }'

    info "Configurando umbral de stock bajo en 3 unidades..."
    local response=$(make_request "POST" "/api/sucursales/settings" "$config_data")
    local status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

    if [ "$status" -eq 200 ]; then
        log "✅ Configuración guardada exitosamente"
    else
        local body=$(echo "$response" | sed '/HTTP_STATUS:/d')
        error "Error configurando umbral: $body"
        return 1
    fi
}

demo_step_3_ejecutar_evaluacion_stock() {
    log "=== PASO 3: Ejecutando evaluación de stock bajo ==="

    info "Ejecutando evaluación automática de stock..."
    local response=$(make_request "POST" "/api/sucursales/low-stock-run")
    local status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_STATUS:/d')

    if [ "$status" -eq 200 ]; then
        local total_alertas=$(echo "$body" | grep -o '"totalAlertas":[0-9]*' | cut -d: -f2)
        log "✅ Evaluación completada. Alertas creadas: $total_alertas"

        # Mostrar detalle por sucursal
        echo "$body" | grep -o '"sucursal":"[^"]*","exito":[^,]*,"alertas":[0-9]*' | while read -r line; do
            local sucursal=$(echo "$line" | sed 's/.*"sucursal":"\([^"]*\)".*/\1/')
            local alertas=$(echo "$line" | sed 's/.*"alertas":\([0-9]*\).*/\1/')
            info "  $sucursal: $alertas alertas"
        done
    else
        error "Error en evaluación: $body"
        return 1
    fi
}

demo_step_4_ver_alertas() {
    local sucursal_id=$1
    log "=== PASO 4: Consultando alertas de la sucursal ==="

    info "Obteniendo alertas de stock de la sucursal..."
    local response=$(make_request "GET" "/api/sucursales/$sucursal_id/alerts")
    local status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_STATUS:/d')

    if [ "$status" -eq 200 ]; then
        local total=$(echo "$body" | grep -o '"total":[0-9]*' | cut -d: -f2)
        log "✅ Alertas obtenidas: $total"

        # Mostrar productos con alertas
        echo "$body" | grep -o '"nombre":"[^"]*","codigo":"[^"]*"' | while read -r line; do
            local nombre=$(echo "$line" | sed 's/.*"nombre":"\([^"]*\)".*/\1/')
            local codigo=$(echo "$line" | sed 's/.*"codigo":"\([^"]*\)".*/\1/')
            info "  📦 $nombre ($codigo)"
        done
    else
        error "Error obteniendo alertas: $body"
        return 1
    fi
}

demo_step_5_solicitar_transferencia() {
    local sucursal_id=$1
    log "=== PASO 5: Solicitando transferencia de productos ==="

    # Obtener primer producto con alerta
    local producto_id=$(curl -s "$BASE_URL/api/sucursales/$sucursal_id/alerts" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -z "$producto_id" ]; then
        warning "No hay productos con alertas para solicitar transferencia"
        return 0
    fi

    local transfer_data='{
        "productoId": "'$producto_id'",
        "cantidadSolicitada": 10,
        "motivo": "Reposición por venta alta - Demo"
    }'

    info "Solicitando transferencia de 10 unidades del producto..."
    local response=$(make_request "POST" "/api/sucursales/$sucursal_id/transfer-request" "$transfer_data")
    local status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

    if [ "$status" -eq 200 ]; then
        log "✅ Solicitud de transferencia creada exitosamente"
    else
        local body=$(echo "$response" | sed '/HTTP_STATUS:/d')
        error "Error solicitando transferencia: $body"
        return 1
    fi
}

demo_step_6_ver_solicitudes() {
    local sucursal_id=$1
    log "=== PASO 6: Consultando solicitudes de transferencia ==="

    info "Obteniendo solicitudes pendientes..."
    local response=$(make_request "GET" "/api/sucursales/$sucursal_id/transfer-request")
    local status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_STATUS:/d')

    if [ "$status" -eq 200 ]; then
        local total=$(echo "$body" | grep -o '"total":[0-9]*' | cut -d: -f2)
        log "✅ Solicitudes obtenidas: $total"

        if [ "$total" -gt 0 ]; then
            info "Solicitudes pendientes encontradas"
        else
            info "No hay solicitudes pendientes"
        fi
    else
        error "Error obteniendo solicitudes: $body"
        return 1
    fi
}

demo_cleanup() {
    log "=== LIMPIEZA: Eliminando datos de demo ==="
    warning "Nota: Los datos de demo permanecerán en la base de datos"
    warning "Para limpiar manualmente:"
    warning "  - Eliminar sucursal 'Sucursal Demo Norte'"
    warning "  - Las alertas y configuraciones se eliminarán automáticamente"
}

# Función principal
main() {
    log "🚀 Iniciando Demo del Módulo de Sucursales"
    log "========================================"

    check_service

    # Ejecutar pasos de demo
    local sucursal_id
    sucursal_id=$(demo_step_1_crear_sucursal)
    [ $? -eq 0 ] || exit 1

    demo_step_2_configurar_umbral "$sucursal_id"
    [ $? -eq 0 ] || exit 1

    demo_step_3_ejecutar_evaluacion_stock
    [ $? -eq 0 ] || exit 1

    demo_step_4_ver_alertas "$sucursal_id"
    [ $? -eq 0 ] || exit 1

    demo_step_5_solicitar_transferencia "$sucursal_id"
    [ $? -eq 0 ] || exit 1

    demo_step_6_ver_solicitudes "$sucursal_id"
    [ $? -eq 0 ] || exit 1

    demo_cleanup

    log "🎉 Demo completada exitosamente!"
    log ""
    log "📋 Próximos pasos recomendados:"
    log "  1. Acceder a /sucursal/dashboard para ver el dashboard"
    log "  2. Ver alertas en /sucursal/alerts"
    log "  3. Probar ventas desde /sucursal/ventas"
    log "  4. Revisar reportes en /sucursal/reportes"
    log ""
    log "📖 Para más información ver README.md"
}

# Ejecutar demo
main "$@"
