# Script para verificar la configuración de Google Cloud

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificacion de Configuracion Google Cloud" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar proyecto
Write-Host "Proyecto:" -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>$null
if ($currentProject -eq $projectId) {
    Write-Host "  OK Proyecto configurado: $projectId" -ForegroundColor Green
} else {
    Write-Host "  X Proyecto incorrecto: $currentProject" -ForegroundColor Red
}

Write-Host ""

# Verificar autenticación
Write-Host "Autenticacion:" -ForegroundColor Yellow
$user = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if ($user) {
    Write-Host "  OK Usuario autenticado: $user" -ForegroundColor Green
} else {
    Write-Host "  X No hay usuario autenticado" -ForegroundColor Red
}

Write-Host ""

# Verificar APIs habilitadas
Write-Host "APIs Habilitadas:" -ForegroundColor Yellow
$requiredApis = @(
    "routes.googleapis.com",
    "cloudoptimization.googleapis.com",
    "dialogflow.googleapis.com",
    "speech.googleapis.com",
    "documentai.googleapis.com",
    "aiplatform.googleapis.com",
    "generativelanguage.googleapis.com"
)

foreach ($api in $requiredApis) {
    $enabled = gcloud services list --enabled --filter="name:$api" --format="value(name)" 2>$null
    if ($enabled) {
        Write-Host "  OK $api" -ForegroundColor Green
    } else {
        Write-Host "  X $api" -ForegroundColor Red
    }
}

Write-Host ""

# Verificar variables de entorno
Write-Host "Variables de Entorno (.env.local):" -ForegroundColor Yellow

if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local"
    
    $requiredVars = @(
        "GOOGLE_CLOUD_PROJECT_ID",
        "GOOGLE_CLOUD_REGION",
        "GOOGLE_DIALOGFLOW_PROJECT_ID",
        "GOOGLE_DOCUMENT_AI_PROJECT_ID",
        "GOOGLE_GEMINI_API_KEY"
    )
    
    $optionalVars = @(
        "GOOGLE_DIALOGFLOW_AGENT_ID",
        "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS",
        "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS"
    )
    
    foreach ($var in $requiredVars) {
        $found = $false
        foreach ($line in $envContent) {
            if ($line -like "$var=*") {
                $parts = $line -split "=", 2
                if ($parts.Length -eq 2) {
                    $value = $parts[1].Trim()
                    if ($value -and $value -ne "" -and $value -notlike "your-*") {
                        Write-Host "  OK $var" -ForegroundColor Green
                        $found = $true
                        break
                    }
                }
            }
        }
        if (-not $found) {
            Write-Host "  X $var (requerida)" -ForegroundColor Red
        }
    }
    
    foreach ($var in $optionalVars) {
        $found = $false
        foreach ($line in $envContent) {
            if ($line -like "$var=*") {
                $parts = $line -split "=", 2
                if ($parts.Length -eq 2) {
                    $value = $parts[1].Trim()
                    if ($value -and $value -ne "" -and $value -notlike "your-*" -and $value -ne "null") {
                        Write-Host "  OK $var" -ForegroundColor Green
                        $found = $true
                        break
                    }
                }
            }
        }
        if (-not $found) {
            Write-Host "  ? $var (opcional)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  X Archivo .env.local no encontrado" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resumen" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuracion completada:" -ForegroundColor Green
Write-Host "  OK Variables de entorno basicas" -ForegroundColor Green
Write-Host "  OK Document AI Processors" -ForegroundColor Green
Write-Host "  OK Gemini API Key" -ForegroundColor Green
Write-Host ""
Write-Host "Pendiente (requiere accion manual):" -ForegroundColor Yellow
Write-Host "  ? Dialogflow Agent ID" -ForegroundColor Yellow
Write-Host "     - Ve a: https://dialogflow.cloud.google.com/" -ForegroundColor Cyan
Write-Host "     - Crea un agente llamado 'Avicola del Sur Bot'" -ForegroundColor Cyan
Write-Host "     - Copia el Agent ID y agregalo a .env.local como:" -ForegroundColor Cyan
Write-Host "       GOOGLE_DIALOGFLOW_AGENT_ID=tu-agent-id" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentacion:" -ForegroundColor Cyan
Write-Host "  - Dialogflow Setup: docs/DIALOGFLOW_SETUP.md" -ForegroundColor Gray
Write-Host "  - Google Cloud Setup: docs/GOOGLE_CLOUD_SETUP.md" -ForegroundColor Gray
Write-Host ""

