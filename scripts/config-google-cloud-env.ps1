# Script para configurar variables de entorno de Google Cloud en .env.local

$projectId = "project-b64fce45-52f8-4dc4-b20"
$region = "southamerica-east1"

Write-Host "Configurando variables de entorno de Google Cloud..." -ForegroundColor Cyan

# Leer .env.local si existe
$envFile = ".env.local"
$envContent = @()

if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    Write-Host "Archivo .env.local encontrado" -ForegroundColor Green
} else {
    Write-Host "Archivo .env.local no encontrado, se creara uno nuevo" -ForegroundColor Yellow
}

# Variables de Google Cloud a agregar/actualizar
$googleCloudVars = @{
    "GOOGLE_CLOUD_PROJECT_ID" = $projectId
    "GOOGLE_CLOUD_REGION" = $region
    "GOOGLE_OPTIMIZATION_API_ENABLED" = "true"
    "GOOGLE_SPEECH_TO_TEXT_ENABLED" = "true"
    "GOOGLE_VERTEX_AI_ENABLED" = "true"
    "GOOGLE_AUTOML_ENABLED" = "true"
    "GOOGLE_DIALOGFLOW_PROJECT_ID" = $projectId
    "GOOGLE_DIALOGFLOW_LANGUAGE_CODE" = "es-AR"
    "GOOGLE_SPEECH_TO_TEXT_LANGUAGE_CODE" = "es-AR"
    "GOOGLE_DOCUMENT_AI_PROJECT_ID" = $projectId
    "GOOGLE_DOCUMENT_AI_LOCATION" = "us"
    "GOOGLE_VERTEX_AI_LOCATION" = "us-central1"
    "GOOGLE_AUTOML_LOCATION" = "us-central1"
    "GOOGLE_GEMINI_MODEL" = "gemini-3-pro-preview"
    "GOOGLE_GEMINI_LOCATION" = "us-central1"
}

# Crear nuevo contenido
$newContent = @()
$varsToAdd = $googleCloudVars.Clone()
$inGoogleCloudSection = $false
$googleCloudSectionAdded = $false

foreach ($line in $envContent) {
    $trimmedLine = $line.Trim()
    
    # Detectar inicio de sección de Google Cloud
    if ($trimmedLine -like "# Google Cloud*") {
        $inGoogleCloudSection = $true
        $googleCloudSectionAdded = $true
        $newContent += $line
        continue
    }
    
    # Si estamos en la sección de Google Cloud y encontramos otra sección, salir
    if ($inGoogleCloudSection -and $trimmedLine -like "# *" -and $trimmedLine -notlike "# Google Cloud*") {
        $inGoogleCloudSection = $false
    }
    
    # Si estamos en la sección de Google Cloud, actualizar variables
    if ($inGoogleCloudSection -and $trimmedLine -like "*=*") {
        $parts = $trimmedLine -split "=", 2
        if ($parts.Length -eq 2) {
            $varName = $parts[0].Trim()
            if ($varsToAdd.ContainsKey($varName)) {
                $newContent += "$varName=$($varsToAdd[$varName])"
                $varsToAdd.Remove($varName)
                continue
            }
        }
    }
    
    # Mantener la línea original
    $newContent += $line
}

# Si no había sección de Google Cloud, agregarla al final
if (-not $googleCloudSectionAdded) {
    $newContent += ""
    $newContent += "# Google Cloud Configuration"
}

# Agregar variables faltantes
foreach ($var in $varsToAdd.GetEnumerator() | Sort-Object Name) {
    $newContent += "$($var.Key)=$($var.Value)"
}

# Escribir el archivo
$newContent | Set-Content $envFile -Encoding UTF8

Write-Host "Variables de entorno actualizadas en .env.local" -ForegroundColor Green
Write-Host ""
Write-Host "Variables configuradas:" -ForegroundColor Cyan
foreach ($var in $googleCloudVars.GetEnumerator() | Sort-Object Name) {
    $key = $var.Key
    $value = $var.Value
    Write-Host "  $key=$value" -ForegroundColor Gray
}
