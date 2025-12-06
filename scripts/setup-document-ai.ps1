# Script para crear Document AI Processors

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$projectId = "project-b64fce45-52f8-4dc4-b20"
$location = "us"

Write-Host "Configurando Document AI Processors..." -ForegroundColor Cyan

# Verificar si Document AI API está habilitada
Write-Host "Verificando Document AI API..." -ForegroundColor Yellow
$apiEnabled = gcloud services list --enabled --filter="name:documentai.googleapis.com" --format="value(name)" 2>$null

if (-not $apiEnabled) {
    Write-Host "Habilitando Document AI API..." -ForegroundColor Yellow
    gcloud services enable documentai.googleapis.com --project=$projectId
}

# Obtener access token
$accessToken = gcloud auth print-access-token

# Crear Processor para Facturas
Write-Host "Creando Processor para Facturas..." -ForegroundColor Yellow

$facturasProcessorUrl = "https://us-documentai.googleapis.com/v1/projects/$projectId/locations/$location/processors"

$facturasBody = @{
    displayName = "Facturas Proveedores"
    type = "INVOICE_PROCESSOR"
} | ConvertTo-Json

try {
    $facturasResponse = Invoke-RestMethod -Uri $facturasProcessorUrl -Method POST -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } -Body $facturasBody -ErrorAction Stop
    
    $facturasProcessorId = $facturasResponse.name -replace ".*/processors/", ""
    Write-Host "Processor de Facturas creado: $facturasProcessorId" -ForegroundColor Green
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorResponse -and $errorResponse.error.message -like "*already exists*" -or $_.Exception.Response.StatusCode -eq 409) {
        Write-Host "El processor de Facturas ya existe. Obteniendo ID..." -ForegroundColor Yellow
        
        # Listar processors existentes
        $listUrl = "https://us-documentai.googleapis.com/v1/projects/$projectId/locations/$location/processors"
        $processors = Invoke-RestMethod -Uri $listUrl -Method GET -Headers @{
            "Authorization" = "Bearer $accessToken"
        }
        
        $facturasProcessor = $processors.processors | Where-Object { $_.displayName -like "*Factura*" -or $_.type -eq "INVOICE_PROCESSOR" } | Select-Object -First 1
        if ($facturasProcessor) {
            $facturasProcessorId = $facturasProcessor.name -replace ".*/processors/", ""
            Write-Host "Processor de Facturas encontrado: $facturasProcessorId" -ForegroundColor Green
        } else {
            Write-Host "No se encontró processor de Facturas. Debes crearlo manualmente." -ForegroundColor Yellow
            $facturasProcessorId = ""
        }
    } else {
        Write-Host "Error al crear processor de Facturas: $_" -ForegroundColor Red
        Write-Host "Por favor, crea el processor manualmente desde: https://console.cloud.google.com/ai/document-ai" -ForegroundColor Yellow
        $facturasProcessorId = ""
    }
}

# Crear Processor para Remitos
Write-Host "Creando Processor para Remitos..." -ForegroundColor Yellow

$remitosBody = @{
    displayName = "Remitos Entrega"
    type = "FORM_PARSER_PROCESSOR"
} | ConvertTo-Json

try {
    $remitosResponse = Invoke-RestMethod -Uri $facturasProcessorUrl -Method POST -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } -Body $remitosBody -ErrorAction Stop
    
    $remitosProcessorId = $remitosResponse.name -replace ".*/processors/", ""
    Write-Host "Processor de Remitos creado: $remitosProcessorId" -ForegroundColor Green
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorResponse -and $errorResponse.error.message -like "*already exists*" -or $_.Exception.Response.StatusCode -eq 409) {
        Write-Host "El processor de Remitos ya existe. Obteniendo ID..." -ForegroundColor Yellow
        
        # Listar processors existentes
        $listUrl = "https://us-documentai.googleapis.com/v1/projects/$projectId/locations/$location/processors"
        $processors = Invoke-RestMethod -Uri $listUrl -Method GET -Headers @{
            "Authorization" = "Bearer $accessToken"
        }
        
        $remitosProcessor = $processors.processors | Where-Object { $_.displayName -like "*Remito*" -or $_.type -eq "FORM_PARSER_PROCESSOR" } | Select-Object -First 1
        if ($remitosProcessor) {
            $remitosProcessorId = $remitosProcessor.name -replace ".*/processors/", ""
            Write-Host "Processor de Remitos encontrado: $remitosProcessorId" -ForegroundColor Green
        } else {
            Write-Host "No se encontró processor de Remitos. Debes crearlo manualmente." -ForegroundColor Yellow
            $remitosProcessorId = ""
        }
    } else {
        Write-Host "Error al crear processor de Remitos: $_" -ForegroundColor Red
        Write-Host "Por favor, crea el processor manualmente desde: https://console.cloud.google.com/ai/document-ai" -ForegroundColor Yellow
        $remitosProcessorId = ""
    }
}

# Actualizar .env.local
if ($facturasProcessorId -or $remitosProcessorId) {
    Write-Host "Actualizando .env.local..." -ForegroundColor Yellow
    $envFile = ".env.local"
    $envContent = Get-Content $envFile
    $newContent = @()
    
    foreach ($line in $envContent) {
        if ($line -like "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=*" -and $facturasProcessorId) {
            $newContent += "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=$facturasProcessorId"
        } elseif ($line -like "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=*" -and $remitosProcessorId) {
            $newContent += "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=$remitosProcessorId"
        } else {
            $newContent += $line
        }
    }
    
    # Agregar si no existen
    $facturasSet = $false
    $remitosSet = $false
    foreach ($line in $newContent) {
        if ($line -like "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=*") { $facturasSet = $true }
        if ($line -like "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=*") { $remitosSet = $true }
    }
    
    $finalContent = @()
    $added = $false
    foreach ($line in $newContent) {
        $finalContent += $line
        if ($line -like "GOOGLE_DOCUMENT_AI_LOCATION=*" -and -not $added) {
            if (-not $facturasSet -and $facturasProcessorId) {
                $finalContent += "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=$facturasProcessorId"
            }
            if (-not $remitosSet -and $remitosProcessorId) {
                $finalContent += "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=$remitosProcessorId"
            }
            $added = $true
        }
    }
    
    if (-not $added) {
        if (-not $facturasSet -and $facturasProcessorId) {
            $finalContent += "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=$facturasProcessorId"
        }
        if (-not $remitosSet -and $remitosProcessorId) {
            $finalContent += "GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=$remitosProcessorId"
        }
    }
    
    $finalContent | Set-Content $envFile -Encoding UTF8
    Write-Host "Variables actualizadas en .env.local" -ForegroundColor Green
}

Write-Host ""
Write-Host "Document AI Processors configurados!" -ForegroundColor Green

