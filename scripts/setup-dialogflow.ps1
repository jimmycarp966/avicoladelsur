# Script para crear y configurar Dialogflow Agent

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"
$agentName = "Avicola del Sur Bot"
$location = "global"
$languageCode = "es-AR"
$timeZone = "America/Argentina/Buenos_Aires"

Write-Host "Configurando Dialogflow Agent..." -ForegroundColor Cyan

# Verificar si Dialogflow API está habilitada
Write-Host "Verificando Dialogflow API..." -ForegroundColor Yellow
$apiEnabled = gcloud services list --enabled --filter="name:dialogflow.googleapis.com" --format="value(name)" 2>$null

if (-not $apiEnabled) {
    Write-Host "Habilitando Dialogflow API..." -ForegroundColor Yellow
    gcloud services enable dialogflow.googleapis.com --project=$projectId
}

# Crear el agente usando la API REST de Dialogflow
Write-Host "Creando agente Dialogflow..." -ForegroundColor Yellow

# Obtener access token
$accessToken = gcloud auth print-access-token

# URL de la API de Dialogflow
$apiUrl = "https://dialogflow.googleapis.com/v3/projects/$projectId/locations/$location/agents"

# Cuerpo de la solicitud
$agentBody = @{
    displayName = $agentName
    defaultLanguageCode = $languageCode
    timeZone = $timeZone
    enableStackdriverLogging = $true
    enableSpellCheck = $true
} | ConvertTo-Json

try {
    # Intentar crear el agente
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } -Body $agentBody -ErrorAction Stop
    
    $agentId = $response.name -replace ".*/agents/", ""
    Write-Host "Agente creado exitosamente!" -ForegroundColor Green
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
        # Buscar la línea GOOGLE_DIALOGFLOW_PROJECT_ID y agregar después
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
    
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorResponse -and $errorResponse.error.message -like "*already exists*") {
        Write-Host "El agente ya existe. Obteniendo Agent ID..." -ForegroundColor Yellow
        
        # Listar agentes existentes
        $listUrl = "https://dialogflow.googleapis.com/v3/projects/$projectId/locations/$location/agents"
        $agents = Invoke-RestMethod -Uri $listUrl -Method GET -Headers @{
            "Authorization" = "Bearer $accessToken"
        }
        
        if ($agents.agents -and $agents.agents.Count -gt 0) {
            $agentId = $agents.agents[0].name -replace ".*/agents/", ""
            Write-Host "Agent ID encontrado: $agentId" -ForegroundColor Green
            
            # Actualizar .env.local
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
        }
    } else {
        Write-Host "Error al crear agente: $_" -ForegroundColor Red
        Write-Host "Por favor, crea el agente manualmente desde: https://dialogflow.cloud.google.com/" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "Dialogflow Agent configurado exitosamente!" -ForegroundColor Green
Write-Host "Puedes configurar las intenciones manualmente desde: https://dialogflow.cloud.google.com/" -ForegroundColor Cyan

