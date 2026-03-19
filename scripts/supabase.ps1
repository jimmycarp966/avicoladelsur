param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$supabaseWorkdir = Join-Path $repoRoot 'supabase'

$cliCandidates = @(
  'supabase',
  (Join-Path $env:USERPROFILE 'bin\supabase\supabase.exe')
)

$supabaseCli = $null
foreach ($candidate in $cliCandidates) {
  if (Get-Command $candidate -ErrorAction SilentlyContinue) {
    $supabaseCli = $candidate
    break
  }
}

if (-not $supabaseCli) {
  throw "No se encontro la CLI de Supabase. Instala 'supabase' en el PATH o verifica C:\Users\$env:USERNAME\bin\supabase\supabase.exe"
}

& $supabaseCli --workdir $supabaseWorkdir @Args
