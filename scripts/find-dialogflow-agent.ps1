# Script para encontrar el agente de Dialogflow

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"

Write-Host "Buscando agente de Dialogflow..." -ForegroundColor Cyan
Write-Host ""

# Obtener access token
$accessToken = gcloud auth print-access-token

# Probar diferentes locations
$locations = @("global", "us", "us-central1", "us-east1")

foreach ($location in $locations) {
    Write-Host "Probando location: $location" -ForegroundColor Yellow
    
    try {
        $listUrl = "https://dialogflow.googleapis.com/v3/projects/$projectId/locations/$location/agents"
        
        $response = Invoke-RestMethod -Uri $listUrl -Method GET -Headers @{
            "Authorization" = "Bearer $accessToken"
        } -ErrorAction Stop
        
        if ($response.agents -and $response.agents.Count -gt 0) {
            Write-Host "  OK Agentes encontrados en $location :" -ForegroundColor Green
            foreach ($agent in $response.agents) {
                $agentId = $agent.name -replace ".*/agents/", ""
                Write-Host "    - Nombre: $($agent.displayName)" -ForegroundColor Cyan
                Write-Host "      Agent ID: $agentId" -ForegroundColor Green
                Write-Host "      Nombre completo: $($agent.name)" -ForegroundColor Gray
                Write-Host ""
            }
        } else {
            Write-Host "  ? No hay agentes en $location" -ForegroundColor Gray
        }
    } catch {
        $statusCode = $null
        try {
            $statusCode = $_.Exception.Response.StatusCode.value__
        } catch {}
        
        if ($statusCode -eq 404) {
            Write-Host "  ? No encontrado en $location (404)" -ForegroundColor Gray
        } elseif ($statusCode -eq 403) {
            Write-Host "  ? Sin permisos para $location (403)" -ForegroundColor Gray
        } else {
            Write-Host "  ? Error en $location : $_" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "Probando con API v2 (Dialogflow Essentials)..." -ForegroundColor Yellow

# Probar con API v2 directamente
$sessionId = "test-session-$(Get-Date -Format 'yyyyMMddHHmmss')"
$testMessage = "Hola"

try {
    # API v2 para Dialogflow Essentials
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
        Write-Host "  OK Conexion exitosa con Dialogflow v2!" -ForegroundColor Green
        Write-Host "    El agente esta funcionando correctamente" -ForegroundColor Green
        Write-Host "    Intencion: $($detectResponse.queryResult.intent.displayName)" -ForegroundColor Cyan
        Write-Host "    Respuesta: $($detectResponse.queryResult.fulfillmentText)" -ForegroundColor Cyan
    }
} catch {
    $statusCode = $null
    try {
        $statusCode = $_.Exception.Response.StatusCode.value__
    } catch {}
    
    $errorStream = $null
    $errorBody = $null
    
    try {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBodyText = $reader.ReadToEnd()
        $errorBody = $errorBodyText | ConvertFrom-Json -ErrorAction SilentlyContinue
    } catch {}
    
    if ($statusCode -eq 404) {
        Write-Host "  X Agente no encontrado (404)" -ForegroundColor Red
        if ($errorBody -and $errorBody.error) {
            Write-Host "    Mensaje: $($errorBody.error.message)" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "Posibles causas:" -ForegroundColor Yellow
        Write-Host "  1. El agente no esta creado en este proyecto" -ForegroundColor Gray
        Write-Host "  2. El agente esta en otro proyecto" -ForegroundColor Gray
        Write-Host "  3. El agente necesita ser activado" -ForegroundColor Gray
    } elseif ($statusCode -eq 403) {
        Write-Host "  X Permisos insuficientes (403)" -ForegroundColor Red
        if ($errorBody -and $errorBody.error) {
            Write-Host "    Mensaje: $($errorBody.error.message)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ? Error: $_" -ForegroundColor Yellow
        if ($errorBody -and $errorBody.error) {
            Write-Host "    Detalles: $($errorBody.error.message)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resumen" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si el agente esta creado pero no se encuentra:" -ForegroundColor Yellow
Write-Host "  1. Verifica que este en el proyecto correcto: $projectId" -ForegroundColor Gray
Write-Host "  2. Ve a: https://dialogflow.cloud.google.com/" -ForegroundColor Cyan
Write-Host "  3. Selecciona el proyecto y verifica que el agente aparezca" -ForegroundColor Gray
Write-Host "  4. Si el agente esta en otro proyecto, actualiza GOOGLE_DIALOGFLOW_PROJECT_ID" -ForegroundColor Gray
Write-Host ""

