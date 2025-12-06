# Script para configurar Dialogflow Agent ID manualmente

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configurar Dialogflow Agent ID" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para encontrar el Agent ID:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Ve a: https://dialogflow.cloud.google.com/" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Selecciona el proyecto: project-b64fce45-52f8-4dc4-b20" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Si ya tienes un agente:" -ForegroundColor Yellow
Write-Host "   - Haz clic en el nombre del agente en la lista" -ForegroundColor Gray
Write-Host "   - En el menu izquierdo, haz clic en el icono de engranaje (Settings)" -ForegroundColor Gray
Write-Host "   - En la pestaña 'General', busca 'Agent ID'" -ForegroundColor Gray
Write-Host "   - El Agent ID es un string largo (ejemplo: abc123def456ghi789...)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Si NO tienes un agente:" -ForegroundColor Yellow
Write-Host "   - Haz clic en 'Create Agent' o 'Crear Agente'" -ForegroundColor Gray
Write-Host "   - Nombre: Avicola del Sur Bot" -ForegroundColor Gray
Write-Host "   - Idioma: Spanish (Argentina)" -ForegroundColor Gray
Write-Host "   - Zona horaria: America/Argentina/Buenos_Aires" -ForegroundColor Gray
Write-Host "   - Haz clic en 'Create'" -ForegroundColor Gray
Write-Host "   - Luego sigue el paso 3 para obtener el Agent ID" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Ubicacion exacta del Agent ID:" -ForegroundColor Yellow
Write-Host "   - Una vez dentro del agente, en el menu izquierdo" -ForegroundColor Gray
Write-Host "   - Haz clic en 'Settings' (icono de engranaje)" -ForegroundColor Gray
Write-Host "   - Pestaña 'General'" -ForegroundColor Gray
Write-Host "   - Busca 'Agent ID' (esta debajo de 'Agent name')" -ForegroundColor Gray
Write-Host "   - Es un string largo, copialo completo" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$agentId = Read-Host "Pega el Agent ID aqui (o presiona Enter para omitir)"

if ($agentId -and $agentId.Trim() -ne "") {
    $agentId = $agentId.Trim()
    
    Write-Host ""
    Write-Host "Actualizando .env.local..." -ForegroundColor Yellow
    
    $envFile = ".env.local"
    $envContent = Get-Content $envFile
    $newContent = @()
    $agentIdSet = $false
    
    foreach ($line in $envContent) {
        if ($line -like "GOOGLE_DIALOGFLOW_AGENT_ID=*") {
            $newContent += "GOOGLE_DIALOGFLOW_AGENT_ID=$agentId"
            $agentIdSet = $true
        } else {
            $newContent += $line
        }
    }
    
    if (-not $agentIdSet) {
        $found = $false
        $finalContent = @()
        foreach ($line in $newContent) {
            $finalContent += $line
            if ($line -like "GOOGLE_DIALOGFLOW_PROJECT_ID=*" -and -not $found) {
                $finalContent += "GOOGLE_DIALOGFLOW_AGENT_ID=$agentId"
                $found = $true
            }
        }
        if (-not $found) {
            $finalContent += "GOOGLE_DIALOGFLOW_AGENT_ID=$agentId"
        }
        $newContent = $finalContent
    }
    
    $newContent | Set-Content $envFile -Encoding UTF8
    
    Write-Host ""
    Write-Host "GOOGLE_DIALOGFLOW_AGENT_ID actualizado exitosamente!" -ForegroundColor Green
    Write-Host "Agent ID configurado: $agentId" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Agent ID no proporcionado." -ForegroundColor Yellow
    Write-Host "Puedes agregarlo manualmente en .env.local:" -ForegroundColor Yellow
    Write-Host "GOOGLE_DIALOGFLOW_AGENT_ID=tu-agent-id" -ForegroundColor Gray
}

Write-Host ""

