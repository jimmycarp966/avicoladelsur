param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $PassThruArgs
)

# Template wrapper. Repositories should point this to their local runtime script.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptDir "../../scripts/harness/bin/harness-init.mjs") @PassThruArgs
