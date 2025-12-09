# Script para ejecutar la migración de conteos_stock
# Requiere: Variables de entorno NEXT_PUBLIC_SUPABASE_URL y una conexión de base de datos

Write-Host "Ejecutando migración de conteos_stock..." -ForegroundColor Cyan

$migrationFile = "supabase/migrations/20250116_fix_rls_conteos_stock.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "Error: No se encuentra el archivo de migración: $migrationFile" -ForegroundColor Red
    exit 1
}

# Leer el contenido del SQL
$sqlContent = Get-Content $migrationFile -Raw

Write-Host "`n=== Contenido de la migración ===" -ForegroundColor Yellow
Write-Host $sqlContent -ForegroundColor Gray
Write-Host "`n=== Fin del contenido ===" -ForegroundColor Yellow

Write-Host "`nPara ejecutar esta migración, tienes dos opciones:" -ForegroundColor Green
Write-Host "1. Ejecutar manualmente en el Dashboard de Supabase:" -ForegroundColor White
Write-Host "   - Ve a: https://app.supabase.com/project/[tu-proyecto]/sql" -ForegroundColor Cyan
Write-Host "   - Copia y pega el contenido del archivo: $migrationFile" -ForegroundColor Cyan
Write-Host "   - Haz clic en 'Run'" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Ejecutar usando npx supabase (si tienes el proyecto linkeado):" -ForegroundColor White
Write-Host "   npx supabase db push" -ForegroundColor Cyan
Write-Host ""

# Intentar ejecutar con npx supabase si está disponible
Write-Host "Intentando ejecutar con Supabase CLI..." -ForegroundColor Yellow

try {
    $env:SUPABASE_DB_URL = $env:NEXT_PUBLIC_SUPABASE_URL
    npx supabase@latest db push --include-all 2>&1 | Out-String
    Write-Host "Migración ejecutada exitosamente!" -ForegroundColor Green
} catch {
    Write-Host "No se pudo ejecutar automáticamente. Usa una de las opciones manuales arriba." -ForegroundColor Yellow
    Write-Host "Error: $_" -ForegroundColor Red
}

