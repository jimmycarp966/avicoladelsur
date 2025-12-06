# Script para obtener Dialogflow Agent ID

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"
$location = "global"

Write-Host "Obteniendo Dialogflow Agent ID..." -ForegroundColor Cyan

# Obtener access token
$accessToken = gcloud auth print-access-token

# URL para listar agentes
$listUrl = "https://dialogflow.googleapis.com/v3/projects/$projectId/locations/$location/agents"

try {
    $agents = Invoke-RestMethod -Uri $listUrl -Method GET -Headers @{
        "Authorization" = "Bearer $accessToken"
    }
    
    if ($agents.agents -and $agents.agents.Count -gt 0) {
        $agent = $agents.agents[0]
        $agentId = $agent.name -replace ".*/agents/", ""
        Write-Host "Agent encontrado: $($agent.displayName)" -ForegroundColor Green
        Write-Host "Agent ID: $agentId" -ForegroundColor Green
        
        # Actualizar .env.local
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
        Write-Host "GOOGLE_DIALOGFLOW_AGENT_ID actualizado en .env.local" -ForegroundColor Green
    } else {
        Write-Host "No se encontraron agentes. Debes crear uno manualmente." -ForegroundColor Yellow
        Write-Host "Ve a: https://dialogflow.cloud.google.com/" -ForegroundColor Cyan
        Write-Host "Crea un agente y luego ejecuta este script nuevamente." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error al obtener agentes: $_" -ForegroundColor Red
    Write-Host "Por favor, crea el agente manualmente desde: https://dialogflow.cloud.google.com/" -ForegroundColor Yellow
    Write-Host "Luego agrega GOOGLE_DIALOGFLOW_AGENT_ID=tu-agent-id en .env.local" -ForegroundColor Yellow
}

