param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $PassThruArgs
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptDir "bin/harness-run-task.mjs") @PassThruArgs
exit $LASTEXITCODE
