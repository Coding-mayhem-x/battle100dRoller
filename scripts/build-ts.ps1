param(
  [switch] $VerboseLogs
)

#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Step($msg) { Write-Host $msg -ForegroundColor Yellow }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$src  = Join-Path $root 'src'
$dist = Join-Path $root 'dist'

# 1) Ensure Node + npm
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Error 'Node.js is required but not found in PATH.'; exit 1 }
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { Write-Error 'npm is required but not found in PATH.'; exit 1 }

# 2) Ensure package.json (ESM)
$pkgPath = Join-Path $root 'package.json'
if (-not (Test-Path $pkgPath)) {
  Write-Step 'Creating package.json (type: module)'
  $pkg = @"
{
  "name": "battleCalcOffline",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-bundle.mjs"
  }
}
"@
  Set-Content -Encoding UTF8 $pkgPath $pkg
}

# 3) Ensure tsconfig.json
$tscPath = Join-Path $root 'tsconfig.json'
if (-not (Test-Path $tscPath)) {
  Write-Step 'Creating tsconfig.json'
  $tscJson = @"
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "Node",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM"],
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
"@
  Set-Content -Encoding UTF8 $tscPath $tscJson
}

# 4) Install TypeScript locally if missing
$localTsc = Join-Path $root 'node_modules/.bin/tsc'
if (-not (Test-Path $localTsc)) {
  Write-Step 'Installing TypeScript locally (devDependency)'
  Push-Location $root
  npm install --no-audit --no-fund --save-dev typescript | Out-Null
  Pop-Location
}

# 5) Compile TS -> dist
Write-Step 'Compiling TypeScript -> dist'
Push-Location $root
npx tsc -p tsconfig.json
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Write-Error "TypeScript compilation failed with code $code"; exit $code }

# 6) Build non-module bundle for file:// usage
Write-Step 'Bundling dist/algorithm.js + dist/main.js -> dist/bundle.js'
$algo = Get-Content -Raw -Encoding UTF8 (Join-Path $dist 'algorithm.js')
$main = Get-Content -Raw -Encoding UTF8 (Join-Path $dist 'main.js')
$algo2 = [Regex]::Replace($algo, '^(export\s+)', '', 'Multiline')
$main2 = [Regex]::Replace($main, '^import\s+[^;]+;?\s*', '', 'Multiline')
$out  = '// Auto-generated bundle: algorithm + main (no modules)' + [Environment]::NewLine + '(function(){' + [Environment]::NewLine + $algo2 + [Environment]::NewLine + $main2 + [Environment]::NewLine + '})();' + [Environment]::NewLine
Set-Content -Encoding UTF8 (Join-Path $dist 'bundle.js') $out

Write-Info 'Build complete.'
Write-Host '  - dist/algorithm.js' -ForegroundColor Green
Write-Host '  - dist/main.js' -ForegroundColor Green
Write-Host '  - dist/bundle.js (file:// friendly)' -ForegroundColor Green
