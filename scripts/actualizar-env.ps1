# Script para actualizar .env.local con las credenciales de Twilio
# Uso: .\scripts\actualizar-env.ps1

Write-Host "⚙️  Actualizando .env.local con credenciales de Twilio..." -ForegroundColor Cyan
Write-Host ""

# Generar token aleatorio para Botpress
$bytes = New-Object Byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$botpressToken = [System.BitConverter]::ToString($bytes) -replace '-', ''
$botpressToken = $botpressToken.Substring(0, 32).ToLower()

# Credenciales de Twilio
$accountSid = "ACd27123ff100aaa78a7bcadb10eac2f0a"
$authToken = "daa2272544d8e082fc16776d9356744d"
$whatsappNumber = "+14155238886"

# Verificar si .env.local existe
if (Test-Path ".env.local") {
    Write-Host "✅ .env.local encontrado" -ForegroundColor Green
    
    # Leer contenido actual
    $envContent = Get-Content ".env.local" -Raw
    
    # Verificar si ya tiene las variables de Twilio
    if ($envContent -match "TWILIO_ACCOUNT_SID") {
        Write-Host "⚠️  Las variables de Twilio ya existen en .env.local" -ForegroundColor Yellow
        $sobrescribir = Read-Host "¿Quieres sobrescribirlas? (s/n)"
        if ($sobrescribir -ne "s") {
            Write-Host "Operación cancelada." -ForegroundColor Yellow
            exit 0
        }
        
        # Eliminar líneas existentes de Twilio
        $envContent = $envContent -replace "(?m)^TWILIO_.*\r?\n?", ""
        $envContent = $envContent -replace "(?m)^BOTPRESS_WEBHOOK_TOKEN.*\r?\n?", ""
    }
    
    # Agregar nuevas variables
    $twilioVars = @"

# ========================================
# Twilio / WhatsApp Bot (Configurado automáticamente)
# ========================================
TWILIO_ACCOUNT_SID=$accountSid
TWILIO_AUTH_TOKEN=$authToken
TWILIO_WHATSAPP_NUMBER=$whatsappNumber
BOTPRESS_WEBHOOK_TOKEN=$botpressToken
"@
    
    $envContent = $envContent.TrimEnd() + "`n" + $twilioVars
    Set-Content ".env.local" -Value $envContent -NoNewline
    
    Write-Host "✅ Variables agregadas a .env.local" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env.local no existe, creando..." -ForegroundColor Yellow
    
    $envContent = @"
# ========================================
# Supabase
# ========================================
NEXT_PUBLIC_SUPABASE_URL=https://tvijhnglmryjmrstfvbv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2aWpobmdsbXJ5am1yc3RmdmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0Njg2MTYsImV4cCI6MjA3ODA0NDYxNn0.4IoAdWby0BVK90ZeZJjSz1RslmPGq2LieFD4svGEGmU
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2aWpobmdsbXJ5am1yc3RmdmJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ2ODYxNiwiZXhwIjoyMDc4MDQ0NjE2fQ.hkmKipZklOSQuqWb9IptiSawt3TdnxqlZcilNbmB2Jc

# ========================================
# Twilio / WhatsApp Bot
# ========================================
TWILIO_ACCOUNT_SID=$accountSid
TWILIO_AUTH_TOKEN=$authToken
TWILIO_WHATSAPP_NUMBER=$whatsappNumber
BOTPRESS_WEBHOOK_TOKEN=$botpressToken
"@
    
    Set-Content ".env.local" -Value $envContent -NoNewline
    Write-Host "✅ .env.local creado" -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📋 Variables configuradas:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "TWILIO_ACCOUNT_SID=" -NoNewline -ForegroundColor Gray
Write-Host $accountSid -ForegroundColor Green
Write-Host "TWILIO_AUTH_TOKEN=" -NoNewline -ForegroundColor Gray
Write-Host $authToken -ForegroundColor Green
Write-Host "TWILIO_WHATSAPP_NUMBER=" -NoNewline -ForegroundColor Gray
Write-Host $whatsappNumber -ForegroundColor Green
Write-Host "BOTPRESS_WEBHOOK_TOKEN=" -NoNewline -ForegroundColor Gray
Write-Host $botpressToken -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ ¡Configuración completada!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Activa el WhatsApp Sandbox de Twilio" -ForegroundColor White
Write-Host "  2. Inicia ngrok: ngrok http 3000" -ForegroundColor White
Write-Host "  3. Configura el webhook en Twilio" -ForegroundColor White
Write-Host "  4. Inicia tu servidor: npm run dev" -ForegroundColor White
Write-Host "  5. Prueba desde WhatsApp" -ForegroundColor White
Write-Host ""

