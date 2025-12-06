# Script final para probar Dialogflow con el formato correcto

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"
$accessToken = gcloud auth print-access-token

Write-Host "Probando Dialogflow con el agente activo..." -ForegroundColor Cyan
Write-Host ""

# Crear session ID único
$sessionId = "test-session-$(Get-Date -Format 'yyyyMMddHHmmss')"

# Probar con el mensaje que funciona en la consola
$testMessage = "Hola"

Write-Host "Mensaje de prueba: $testMessage" -ForegroundColor Yellow
Write-Host "Session ID: $sessionId" -ForegroundColor Gray
Write-Host ""

# URL correcta para Dialogflow Essentials API v2
$apiUrl = "https://dialogflow.googleapis.com/v2/projects/$projectId/agent/sessions/$sessionId:detectIntent"

Write-Host "URL de la API: $apiUrl" -ForegroundColor Gray
Write-Host ""

# Body de la petición
$requestBody = @{
    queryInput = @{
        text = @{
            text = $testMessage
            languageCode = "es-AR"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "Enviando peticion..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } -Body $requestBody -ErrorAction Stop
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "EXITO! Dialogflow esta funcionando!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Respuesta del agente:" -ForegroundColor Cyan
    Write-Host "  Intencion: $($response.queryResult.intent.displayName)" -ForegroundColor Green
    Write-Host "  Confianza: $($response.queryResult.intentDetectionConfidence)" -ForegroundColor Green
    Write-Host "  Respuesta: $($response.queryResult.fulfillmentText)" -ForegroundColor Green
    Write-Host ""
    Write-Host "El agente esta correctamente configurado y funcionando!" -ForegroundColor Green
    
} catch {
    $statusCode = $null
    $errorDetails = ""
    
    try {
        $statusCode = $_.Exception.Response.StatusCode.value__
    } catch {}
    
    try {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorText = $reader.ReadToEnd()
        $errorDetails = $errorText
    } catch {}
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Error al conectar con Dialogflow" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Codigo de estado: $statusCode" -ForegroundColor Yellow
    
    if ($errorDetails) {
        Write-Host ""
        Write-Host "Detalles del error:" -ForegroundColor Yellow
        Write-Host $errorDetails -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "Posibles soluciones:" -ForegroundColor Cyan
    Write-Host "1. Verifica que el agente este en el proyecto: $projectId" -ForegroundColor Gray
    Write-Host "2. Verifica que tengas permisos de 'Dialogflow API User' o superior" -ForegroundColor Gray
    Write-Host "3. Asegurate de que Dialogflow API este habilitada" -ForegroundColor Gray
    Write-Host "4. Intenta usar Application Default Credentials:" -ForegroundColor Gray
    Write-Host "   gcloud auth application-default login" -ForegroundColor Gray
}

Write-Host ""

