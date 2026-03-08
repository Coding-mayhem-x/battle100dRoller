param(
  [int] $UpdateMs = 150,
  [switch] $NoSummary,
  [switch] $RandomSeed,
  [int] $Count = 20
)

#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Resolve paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir
$runner    = Join-Path $scriptDir 'run-scenarios.mjs'
$report    = Join-Path $repoRoot 'reports/results.md'

if (-not (Test-Path $runner)) { Write-Error "Runner not found: $runner"; exit 1 }

# Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Error 'Node.js is required but was not found in PATH.'; exit 1 }
$nodePath = $node.Source

Write-Host 'Running scenario tests (spinner shows activity)' -ForegroundColor Cyan
Write-Host "  runner: $runner"

# Temp logs
$outFile = Join-Path $env:TEMP ("scenarios-out-" + [guid]::NewGuid().ToString() + '.log')
$errFile = Join-Path $env:TEMP ("scenarios-err-" + [guid]::NewGuid().ToString() + '.log')

# Launch process with redirected output
$argLine = '"' + $runner + '"'
if ($Count -gt 0) { $argLine += ' --count ' + $Count }
if ($RandomSeed) { $argLine += ' --random-seed' }

$proc = Start-Process -FilePath $nodePath -ArgumentList $argLine -WorkingDirectory $repoRoot -PassThru -NoNewWindow -RedirectStandardOutput $outFile -RedirectStandardError $errFile

# Spinner
$frames = @('|','/','-','\')
$i = 0
$start = Get-Date
while (-not $proc.HasExited) {
  $elapsed = (Get-Date) - $start
  $label = '[' + $frames[$i % $frames.Count] + '] Running... ' + $elapsed.ToString('mm\:ss')
  Write-Host -NoNewLine "`r$label"
  Start-Sleep -Milliseconds $UpdateMs
  $i++
}
Write-Host -NoNewLine "`r[OK] Done in "; Write-Host ((Get-Date) - $start).ToString('mm\:ss')

$exitCode = [int]$proc.ExitCode
$stdout = ''
if (Test-Path $outFile) { $tmp = Get-Content -Raw -Encoding UTF8 $outFile; if ($null -ne $tmp) { $stdout = $tmp.Trim() } }
$stderr = ''
if (Test-Path $errFile) { $tmp2 = Get-Content -Raw -Encoding UTF8 $errFile; if ($null -ne $tmp2) { $stderr = $tmp2.Trim() } }
if ($stdout) { Write-Host $stdout }
if ($stderr) { Write-Warning $stderr }
if ($exitCode -ne 0) { Write-Error "Runner exited with code $exitCode"; exit $exitCode }

if (Test-Path $report) {
  Write-Host "Report generated: $report" -ForegroundColor Green
  if (-not $NoSummary) {
    Write-Host ''
    Write-Host 'Quick summary:' -ForegroundColor Yellow
    $lines = Get-Content -Encoding UTF8 $report
    for ($idx = 0; $idx -lt $lines.Count; $idx++) {
      if ($lines[$idx] -match '^### ') {
        $header = $lines[$idx]
        $j = $idx + 1
        $atk = $null; $def = $null
        while ($j -lt $lines.Count -and ($lines[$j] -notmatch '^### ')) {
          if (-not $atk -and $lines[$j] -like '- Attacker wins:*') { $atk = $lines[$j] }
          if (-not $def -and $lines[$j] -like '- Defender wins:*') { $def = $lines[$j] }
          $j++
        }
        if ($atk -or $def) {
          Write-Host "  $header" -ForegroundColor Cyan
          if ($atk) { Write-Host "    $atk" }
          if ($def) { Write-Host "    $def" }
        }
        $idx = $j - 1
      }
    }
  }
} else {
  Write-Warning "Runner completed but the report was not found at: $report"
}
