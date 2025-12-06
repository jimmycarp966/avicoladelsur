# Script para probar la conexión con Dialogflow

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"
$location = "global"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Prueba de Conexion con Dialogflow" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Verificar autenticación
Write-Host "Paso 1: Verificando autenticacion..." -ForegroundColor Yellow
try {
    $accessToken = gcloud auth print-access-token 2>$null
    if ($accessToken) {
        Write-Host "  OK Token de acceso obtenido" -ForegroundColor Green
    } else {
        Write-Host "  X Error al obtener token de acceso" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  X Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Paso 2: Verificar que el proyecto tenga agentes
Write-Host "Paso 2: Verificando agentes en el proyecto..." -ForegroundColor Yellow
try {
    $listUrl = "https://dialogflow.googleapis.com/v3/projects/$projectId/locations/$location/agents"
    
    $response = Invoke-RestMethod -Uri $listUrl -Method GET -Headers @{
        "Authorization" = "Bearer $accessToken"
    } -ErrorAction Stop
    
    if ($response.agents -and $response.agents.Count -gt 0) {
        Write-Host "  OK Agentes encontrados: $($response.agents.Count)" -ForegroundColor Green
        foreach ($agent in $response.agents) {
            $agentId = $agent.name -replace ".*/agents/", ""
            Write-Host "    - $($agent.displayName) (ID: $agentId)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  ? No se encontraron agentes (esto es normal si acabas de crear el proyecto)" -ForegroundColor Yellow
        Write-Host "    Puedes crear un agente desde: https://dialogflow.cloud.google.com/" -ForegroundColor Gray
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403) {
        Write-Host "  ? Permisos insuficientes para listar agentes (esto es normal)" -ForegroundColor Yellow
        Write-Host "    La API puede funcionar igual con el Project ID" -ForegroundColor Gray
    } else {
        Write-Host "  X Error al listar agentes: $_" -ForegroundColor Red
    }
}

Write-Host ""

# Paso 3: Probar detección de intención (si hay un agente)
Write-Host "Paso 3: Probando deteccion de intencion..." -ForegroundColor Yellow

# Crear un session ID de prueba
$sessionId = "test-session-$(Get-Date -Format 'yyyyMMddHHmmss')"
$testMessage = "Hola"

try {
    # Usar API v2 para detectIntent
    $detectUrl = "https://dialogflow.googleapis.com/v2/projects/$projectId/agent/sessions/$sessionId:detectIntent"
    
    $requestBody = @{
        queryInput = @{
            text = @{
                text = $testMessage
                languageCode = "es-AR"
            }
        }
    } | ConvertTo-Json -Depth 10
    
    $detectResponse = Invoke-RestMethod -Uri $detectUrl -Method POST -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } -Body $requestBody -ErrorAction Stop
    
    if ($detectResponse.queryResult) {
        Write-Host "  OK Conexion exitosa con Dialogflow!" -ForegroundColor Green
        Write-Host "    Mensaje enviado: $testMessage" -ForegroundColor Gray
        Write-Host "    Intencion detectada: $($detectResponse.queryResult.intent.displayName)" -ForegroundColor Cyan
        Write-Host "    Confianza: $($detectResponse.queryResult.intentDetectionConfidence)" -ForegroundColor Cyan
        if ($detectResponse.queryResult.fulfillmentText) {
            Write-Host "    Respuesta: $($detectResponse.queryResult.fulfillmentText)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ? Respuesta recibida pero sin queryResult" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $null
    $errorMessage = $_.Exception.Message
    
    try {
        $statusCode = $_.Exception.Response.StatusCode.value__
    } catch {}
    
    try {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBodyText = $reader.ReadToEnd()
        $errorBody = $errorBodyText | ConvertFrom-Json -ErrorAction SilentlyContinue
    } catch {}
    
    if ($statusCode -eq 404) {
        Write-Host "  ? Agente no encontrado (puede que necesites crear uno)" -ForegroundColor Yellow
        Write-Host "    Ve a: https://dialogflow.cloud.google.com/" -ForegroundColor Cyan
        Write-Host "    Crea un agente y luego vuelve a probar" -ForegroundColor Gray
    } elseif ($statusCode -eq 403) {
        Write-Host "  ? Permisos insuficientes (esto puede ser normal)" -ForegroundColor Yellow
        Write-Host "    Verifica que Dialogflow API esté habilitada" -ForegroundColor Gray
        if ($errorBody -and $errorBody.error) {
            Write-Host "    Detalles: $($errorBody.error.message)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ? Error al probar deteccion" -ForegroundColor Yellow
        Write-Host "    Mensaje: $errorMessage" -ForegroundColor Gray
        if ($errorBody -and $errorBody.error) {
            Write-Host "    Detalles: $($errorBody.error.message)" -ForegroundColor Gray
        }
        Write-Host "    Nota: Esto puede ser normal si aun no has creado un agente" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resumen de la Prueba" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si ves 'OK Conexion exitosa', Dialogflow esta funcionando correctamente." -ForegroundColor Green
Write-Host "Si ves errores 403 o 404, puede ser normal si:" -ForegroundColor Yellow
Write-Host "  - Aun no has creado un agente en Dialogflow" -ForegroundColor Gray
Write-Host "  - Hay restricciones de permisos en tu proyecto" -ForegroundColor Gray
Write-Host ""
Write-Host "Para crear un agente:" -ForegroundColor Cyan
Write-Host "  https://dialogflow.cloud.google.com/" -ForegroundColor Cyan
Write-Host ""

