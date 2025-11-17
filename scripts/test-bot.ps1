# Script para probar el bot enviando un mensaje de prueba via Twilio CLI
# Uso: .\scripts\test-bot.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$Mensaje = "Hola, quiero probar el bot"
)

Write-Host "🧪 Probando Bot Vendedor" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Verificar que esté autenticado
$profiles = twilio profiles:list 2>&1
if ($profiles -match "No profiles") {
    Write-Host "❌ Twilio CLI no está autenticado" -ForegroundColor Red
    Write-Host "Ejecuta primero: .\scripts\setup-bot-automatico.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Twilio CLI autenticado" -ForegroundColor Green
Write-Host ""

# Pedir número de destino
Write-Host "Para probar el bot necesitas un número registrado en el Sandbox." -ForegroundColor Cyan
Write-Host ""
$numeroDestino = Read-Host "Ingresa tu número de WhatsApp (ej: +5491123456789)"

if ([string]::IsNullOrWhiteSpace($numeroDestino)) {
    Write-Host "❌ Número requerido" -ForegroundColor Red
    exit 1
}

# Enviar mensaje de prueba
Write-Host ""
Write-Host "Enviando mensaje de prueba..." -ForegroundColor Cyan
Write-Host "  De: whatsapp:+14155238886 (Twilio Sandbox)" -ForegroundColor Gray
Write-Host "  A: whatsapp:$numeroDestino" -ForegroundColor Gray
Write-Host "  Mensaje: '$Mensaje'" -ForegroundColor Gray
Write-Host ""

# Ejecutar comando de Twilio
$resultado = twilio api:core:messages:create `
    --from "whatsapp:+14155238886" `
    --to "whatsapp:$numeroDestino" `
    --body "$Mensaje" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Mensaje enviado correctamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "Revisa tu WhatsApp para ver la respuesta del bot." -ForegroundColor Cyan
} else {
    Write-Host "❌ Error al enviar mensaje:" -ForegroundColor Red
    Write-Host $resultado -ForegroundColor Red
    Write-Host ""
    Write-Host "Posibles causas:" -ForegroundColor Yellow
    Write-Host "  • El número no está registrado en el Sandbox" -ForegroundColor Gray
    Write-Host "  • El Sandbox no está activado" -ForegroundColor Gray
    Write-Host "  • Credenciales incorrectas" -ForegroundColor Gray
}

Write-Host ""

