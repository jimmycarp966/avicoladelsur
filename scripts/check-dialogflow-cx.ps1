# Script para verificar si el agente está en Dialogflow CX

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"
$location = "global"

Write-Host "Verificando Dialogflow CX..." -ForegroundColor Cyan
Write-Host ""

$accessToken = gcloud auth print-access-token

# Probar con Dialogflow CX API
try {
    $cxUrl = "https://dialogflow.googleapis.com/v3/projects/$projectId/locations/$location/agents"
    
    $response = Invoke-RestMethod -Uri $cxUrl -Method GET -Headers @{
        "Authorization" = "Bearer $accessToken"
    } -ErrorAction Stop
    
    if ($response.agents -and $response.agents.Count -gt 0) {
        Write-Host "OK Agentes encontrados en Dialogflow CX:" -ForegroundColor Green
        foreach ($agent in $response.agents) {
            $agentId = $agent.name -replace ".*/agents/", ""
            Write-Host "  - $($agent.displayName)" -ForegroundColor Cyan
            Write-Host "    Agent ID: $agentId" -ForegroundColor Green
            Write-Host "    Nombre completo: $($agent.name)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "? No se encontraron agentes en Dialogflow CX" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Verificando si el problema es de permisos o configuracion..." -ForegroundColor Yellow
Write-Host ""

# Verificar permisos del usuario
Write-Host "Permisos del usuario actual:" -ForegroundColor Cyan
try {
    $iamUrl = "https://cloudresourcemanager.googleapis.com/v1/projects/$projectId:getIamPolicy"
    $iamResponse = Invoke-RestMethod -Uri $iamUrl -Method POST -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } -Body "{}" -ErrorAction Stop
    
    $userEmail = gcloud auth list --filter=status:ACTIVE --format="value(account)"
    Write-Host "  Usuario: $userEmail" -ForegroundColor Gray
    
    $hasDialogflowRole = $false
    foreach ($binding in $iamResponse.bindings) {
        if ($binding.members -contains "user:$userEmail") {
            if ($binding.role -like "*dialogflow*" -or $binding.role -like "*owner*" -or $binding.role -like "*editor*") {
                Write-Host "  OK Rol encontrado: $($binding.role)" -ForegroundColor Green
                $hasDialogflowRole = $true
            }
        }
    }
    
    if (-not $hasDialogflowRole) {
        Write-Host "  ? No se encontraron roles de Dialogflow especificos" -ForegroundColor Yellow
        Write-Host "    Esto puede ser normal si tienes rol de Owner o Editor general" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ? No se pudieron verificar permisos: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostico" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si el agente esta creado pero la API devuelve 404:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Verifica el proyecto en Dialogflow Console:" -ForegroundColor Cyan
Write-Host "   https://dialogflow.cloud.google.com/" -ForegroundColor Gray
Write-Host "   - Asegurate de que el agente este en: $projectId" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Verifica que el agente este activo:" -ForegroundColor Cyan
Write-Host "   - El agente debe aparecer en la lista de agentes" -ForegroundColor Gray
Write-Host "   - Debe tener al menos una intencion configurada" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Si el agente esta en Dialogflow CX (nueva version):" -ForegroundColor Cyan
Write-Host "   - Necesitamos actualizar el codigo para usar Dialogflow CX API" -ForegroundColor Gray
Write-Host "   - O crear un agente en Dialogflow Essentials (version antigua)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Prueba manualmente desde la consola:" -ForegroundColor Cyan
Write-Host "   - Ve a Dialogflow Console" -ForegroundColor Gray
Write-Host "   - Abre el agente" -ForegroundColor Gray
Write-Host "   - Usa 'Try it now' para probar que funciona" -ForegroundColor Gray
Write-Host ""

