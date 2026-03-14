param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $PassThruArgs
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptDir "bin/harness-maintenance.mjs") @PassThruArgs
exit $LASTEXITCODE
