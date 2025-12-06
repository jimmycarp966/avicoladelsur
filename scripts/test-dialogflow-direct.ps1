# Script para probar Dialogflow directamente con diferentes métodos

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"
$accessToken = gcloud auth print-access-token

Write-Host "Probando diferentes metodos para acceder al agente..." -ForegroundColor Cyan
Write-Host ""

# Método 1: API v2 con session (método estándar para Essentials)
Write-Host "Metodo 1: API v2 con session (Dialogflow Essentials)" -ForegroundColor Yellow
$sessionId = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
$testUrl1 = "https://dialogflow.googleapis.com/v2/projects/$projectId/agent/sessions/$sessionId:detectIntent"

$body1 = @{
    queryInput = @{
        text = @{
            text = "Hola"
            languageCode = "es-AR"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $response1 = Invoke-RestMethod -Uri $testUrl1 -Method POST -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } -Body $body1 -ErrorAction Stop
    
    Write-Host "  OK Funciono! El agente esta activo" -ForegroundColor Green
    Write-Host "    Respuesta: $($response1.queryResult.fulfillmentText)" -ForegroundColor Cyan
} catch {
    $statusCode = $null
    try { $statusCode = $_.Exception.Response.StatusCode.value__ } catch {}
    
    if ($statusCode -eq 404) {
        Write-Host "  X Error 404: Agente no encontrado" -ForegroundColor Red
        
        # Intentar obtener más detalles del error
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorText = $reader.ReadToEnd()
            Write-Host "    Detalles: $errorText" -ForegroundColor Gray
        } catch {}
    } else {
        Write-Host "  ? Error: $_" -ForegroundColor Yellow
    }
}

Write-Host ""

# Método 2: Verificar si necesitamos usar el nombre del agente
Write-Host "Metodo 2: Verificando si el agente necesita nombre especifico" -ForegroundColor Yellow
Write-Host "  Nota: En Dialogflow Essentials, el agente se identifica por el Project ID" -ForegroundColor Gray
Write-Host "  Si el agente se llama 'NewAgent', puede que necesite estar activado" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Recomendaciones" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si el agente 'NewAgent' esta creado pero no responde:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Verifica en Dialogflow Console:" -ForegroundColor Cyan
Write-Host "   - Abre el agente 'NewAgent'" -ForegroundColor Gray
Write-Host "   - Ve a la pestaña 'Intents'" -ForegroundColor Gray
Write-Host "   - Asegurate de que haya al menos una intencion (puede ser 'Default Welcome Intent')" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Prueba manualmente:" -ForegroundColor Cyan
Write-Host "   - En Dialogflow Console, usa 'Try it now'" -ForegroundColor Gray
Write-Host "   - Escribe 'Hola' y verifica que responda" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Si funciona en la consola pero no en la API:" -ForegroundColor Cyan
Write-Host "   - Puede ser un problema de permisos del Service Account" -ForegroundColor Gray
Write-Host "   - O puede que el agente necesite ser 'publicado' o activado" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Verifica el Project ID:" -ForegroundColor Cyan
Write-Host "   - Asegurate de que el agente este en: $projectId" -ForegroundColor Gray
Write-Host "   - Si esta en otro proyecto, actualiza GOOGLE_DIALOGFLOW_PROJECT_ID" -ForegroundColor Gray
Write-Host ""

