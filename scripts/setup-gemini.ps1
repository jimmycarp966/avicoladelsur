# Script para obtener API key de Gemini

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"

Write-Host "Configurando Gemini API..." -ForegroundColor Cyan

# Verificar si Generative Language API está habilitada
Write-Host "Verificando Generative Language API..." -ForegroundColor Yellow
$apiEnabled = gcloud services list --enabled --filter="name:generativelanguage.googleapis.com" --format="value(name)" 2>$null

if (-not $apiEnabled) {
    Write-Host "Habilitando Generative Language API..." -ForegroundColor Yellow
    gcloud services enable generativelanguage.googleapis.com --project=$projectId
}

Write-Host ""
Write-Host "Para obtener la API key de Gemini:" -ForegroundColor Yellow
Write-Host "1. Ve a: https://makersuite.google.com/app/apikey" -ForegroundColor Cyan
Write-Host "2. Haz clic en 'Create API Key'" -ForegroundColor Cyan
Write-Host "3. Selecciona tu proyecto: $projectId" -ForegroundColor Cyan
Write-Host "4. Copia la API key generada" -ForegroundColor Cyan
Write-Host ""
$apiKey = Read-Host "Pega la API key de Gemini aquí (o presiona Enter para omitir)"

if ($apiKey -and $apiKey.Trim() -ne "") {
    Write-Host "Actualizando .env.local..." -ForegroundColor Yellow
    $envFile = ".env.local"
    $envContent = Get-Content $envFile
    $newContent = @()
    $apiKeySet = $false
    
    foreach ($line in $envContent) {
        if ($line -like "GOOGLE_GEMINI_API_KEY=*") {
            $newContent += "GOOGLE_GEMINI_API_KEY=$apiKey"
            $apiKeySet = $true
        } else {
            $newContent += $line
        }
    }
    
    if (-not $apiKeySet) {
        $found = $false
        $finalContent = @()
        foreach ($line in $newContent) {
            $finalContent += $line
            if ($line -like "GOOGLE_GEMINI_MODEL=*" -and -not $found) {
                $finalContent += "GOOGLE_GEMINI_API_KEY=$apiKey"
                $found = $true
            }
        }
        if (-not $found) {
            $finalContent += "GOOGLE_GEMINI_API_KEY=$apiKey"
        }
        $newContent = $finalContent
    }
    
    $newContent | Set-Content $envFile -Encoding UTF8
    Write-Host "GOOGLE_GEMINI_API_KEY actualizado en .env.local" -ForegroundColor Green
} else {
    Write-Host "API key no proporcionada. Puedes configurarla manualmente más tarde." -ForegroundColor Yellow
    Write-Host "Agrega GOOGLE_GEMINI_API_KEY=tu-api-key en .env.local" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Gemini API configurado!" -ForegroundColor Green

