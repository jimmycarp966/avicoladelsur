#!/bin/bash

# Script para evaluación automática de stock bajo en sucursales
# Ejecutar con cron: */10 * * * * /path/to/evaluacion-stock-sucursales.sh

# Configuración
API_URL="http://localhost:3000"  # Cambiar por URL de producción
LOG_FILE="/var/log/avicola-stock-evaluation.log"

# Función de logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
    echo "$1"
}

# Función para verificar si el servicio está disponible
check_service() {
    if curl -s --head --request GET "$API_URL/api/sucursales/low-stock-run" > /dev/null; then
        return 0
    else
        log "ERROR: Servicio no disponible en $API_URL"
        return 1
    fi
}

# Función principal
main() {
    log "=== Iniciando evaluación de stock bajo en sucursales ==="

    # Verificar servicio
    if ! check_service; then
        log "ERROR: No se puede conectar al servicio. Abortando."
        exit 1
    fi

    # Ejecutar evaluación
    log "Ejecutando evaluación de stock..."

    response=$(curl -s -X POST "$API_URL/api/sucursales/low-stock-run" \
        -H "Content-Type: application/json" \
        -w "\nHTTP_STATUS:%{http_code}")

    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    response_body=$(echo "$response" | sed '/HTTP_STATUS:/d')

    if [ "$http_status" -eq 200 ]; then
        # Parsear respuesta JSON (simplificado)
        total_alertas=$(echo "$response_body" | grep -o '"totalAlertas":[0-9]*' | cut -d: -f2)
        log "SUCCESS: Evaluación completada. Alertas creadas: $total_alertas"

        # Log detallado por sucursal
        echo "$response_body" | grep -o '"sucursal":"[^"]*","exito":[^,]*,"alertas":[0-9]*' | while read -r line; do
            sucursal=$(echo "$line" | sed 's/.*"sucursal":"\([^"]*\)".*/\1/')
            exito=$(echo "$line" | sed 's/.*"exito":\([^,]*\).*/\1/')
            alertas=$(echo "$line" | sed 's/.*"alertas":\([0-9]*\).*/\1/')

            if [ "$exito" = "true" ]; then
                log "  ✓ $sucursal: $alertas alertas creadas"
            else
                log "  ✗ $sucursal: Error en evaluación"
            fi
        done

    else
        log "ERROR: Falló la evaluación. HTTP $http_status"
        log "Respuesta: $response_body"
        exit 1
    fi

    log "=== Evaluación completada ==="
}

# Ejecutar solo si no hay otra instancia corriendo
LOCK_FILE="/tmp/evaluacion-stock-sucursales.lock"

if [ -f "$LOCK_FILE" ]; then
    # Verificar si el proceso todavía está corriendo
    if kill -0 "$(cat "$LOCK_FILE")" 2>/dev/null; then
        log "Otra instancia está ejecutándose. Abortando."
        exit 1
    else
        log "Lock file obsoleto encontrado. Removiendo."
        rm -f "$LOCK_FILE"
    fi
fi

# Crear lock file
echo $$ > "$LOCK_FILE"

# Asegurar que se remueva el lock file al salir
trap 'rm -f "$LOCK_FILE"' EXIT

# Ejecutar evaluación
main
