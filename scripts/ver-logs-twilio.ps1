# Script para ver logs de Twilio en tiempo real
# Uso: .\scripts\ver-logs-twilio.ps1

Write-Host "📊 Logs de Twilio en Tiempo Real" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Mostrando los últimos 20 mensajes..." -ForegroundColor Gray
Write-Host "Presiona Ctrl+C para salir" -ForegroundColor Yellow
Write-Host ""

# Ver logs de mensajes
twilio api:core:messages:list --limit 20

