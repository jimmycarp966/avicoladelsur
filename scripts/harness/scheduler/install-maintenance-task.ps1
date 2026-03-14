param(
  [string] $TaskName = "HarnessMaintenanceAvicola",
  [string] $DayOfWeek = "Monday",
  [string] $Time = "09:00",
  [string] $WorkingDirectory = ""
)

if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) {
  $WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
}

$scriptPath = Join-Path $WorkingDirectory "scripts/harness/harness-maintenance.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Maintenance script not found at $scriptPath"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File \"$scriptPath\" --non-interactive --create-branch=false"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $DayOfWeek -At $Time
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force
Write-Host "Scheduled task '$TaskName' created."
