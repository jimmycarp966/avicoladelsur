# Script para encontrar Dialogflow Agent ID

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"
$location = "global"

Write-Host "Buscando Dialogflow Agent ID..." -ForegroundColor Cyan
Write-Host ""

# Método 1: Intentar obtener desde la API
Write-Host "Metodo 1: Intentando obtener desde la API..." -ForegroundColor Yellow

try {
    $accessToken = gcloud auth print-access-token 2>$null
    
    if ($accessToken) {
        $listUrl = "https://dialogflow.googleapis.com/v3/projects/$projectId/locations/$location/agents"
        
        $response = Invoke-RestMethod -Uri $listUrl -Method GET -Headers @{
            "Authorization" = "Bearer $accessToken"
        } -ErrorAction Stop
        
        if ($response.agents -and $response.agents.Count -gt 0) {
            Write-Host "Agentes encontrados:" -ForegroundColor Green
            foreach ($agent in $response.agents) {
                $agentId = $agent.name -replace ".*/agents/", ""
                Write-Host "  - Nombre: $($agent.displayName)" -ForegroundColor Cyan
                Write-Host "    Agent ID: $agentId" -ForegroundColor Green
                Write-Host "    Nombre completo: $($agent.name)" -ForegroundColor Gray
                Write-Host ""
            }
            
            # Usar el primer agente encontrado
            $firstAgent = $response.agents[0]
            $agentId = $firstAgent.name -replace ".*/agents/", ""
            
            Write-Host "Usando el primer agente: $($firstAgent.displayName)" -ForegroundColor Yellow
            Write-Host "Agent ID: $agentId" -ForegroundColor Green
            Write-Host ""
            
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
            exit 0
        } else {
            Write-Host "No se encontraron agentes en el proyecto." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Error al acceder a la API: $_" -ForegroundColor Red
    Write-Host ""
}

# Si no se encontró, dar instrucciones
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INSTRUCCIONES PARA ENCONTRAR EL AGENT ID" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Paso 1: Abre tu navegador y ve a:" -ForegroundColor Yellow
Write-Host "  https://dialogflow.cloud.google.com/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Paso 2: Selecciona el proyecto:" -ForegroundColor Yellow
Write-Host "  $projectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "Paso 3: Si ya tienes un agente creado:" -ForegroundColor Yellow
Write-Host "  a) Haz clic en el agente" -ForegroundColor Gray
Write-Host "  b) Haz clic en el icono de engranaje (Settings) en el menu lateral izquierdo" -ForegroundColor Gray
Write-Host "  c) En la pestaña 'General', busca 'Agent ID'" -ForegroundColor Gray
Write-Host "  d) Copia el ID (es un string largo, ejemplo: abc123def456...)" -ForegroundColor Gray
Write-Host ""
Write-Host "Paso 4: Si NO tienes un agente creado:" -ForegroundColor Yellow
Write-Host "  a) Haz clic en 'Create Agent' o 'Crear Agente'" -ForegroundColor Gray
Write-Host "  b) Completa:" -ForegroundColor Gray
Write-Host "     - Agent name: Avicola del Sur Bot" -ForegroundColor Gray
Write-Host "     - Default language: Spanish (Argentina)" -ForegroundColor Gray
Write-Host "     - Time zone: America/Argentina/Buenos_Aires" -ForegroundColor Gray
Write-Host "  c) Haz clic en 'Create'" -ForegroundColor Gray
Write-Host "  d) Despues de crear, sigue el Paso 3 para obtener el Agent ID" -ForegroundColor Gray
Write-Host ""
Write-Host "Paso 5: Una vez que tengas el Agent ID, ejecuta:" -ForegroundColor Yellow
Write-Host "  Agrega esta linea a .env.local:" -ForegroundColor Cyan
Write-Host "  GOOGLE_DIALOGFLOW_AGENT_ID=tu-agent-id-aqui" -ForegroundColor Gray
Write-Host ""
Write-Host "O ejecuta este script nuevamente despues de crear el agente." -ForegroundColor Yellow
Write-Host ""

