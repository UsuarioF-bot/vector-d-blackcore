#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$Root = Get-Location
$Dist = Join-Path $Root 'dist'
$LauncherDir = Join-Path $Root 'launcher'
$Pnpm = Join-Path $Root 'tools\pnpm.exe'
$NodeVersion = '22.22.0'
$NodeDir = Join-Path $Root "release\node-v$NodeVersion-win-x64"
$NodeExe = Join-Path $NodeDir 'node.exe'
$NpmCmd = Join-Path $NodeDir 'npm.cmd'

Write-Host ''
Write-Host '========================================'
Write-Host '  VET-MIS - Build ejecutable'
Write-Host '========================================'
Write-Host ''

if (-not (Test-Path $Pnpm)) {
    Write-Host 'Descargando pnpm portable...'
    New-Item -ItemType Directory -Force -Path (Join-Path $Root 'tools') | Out-Null
    Invoke-WebRequest -Uri 'https://github.com/pnpm/pnpm/releases/download/v10.12.4/pnpm-win-x64.exe' -OutFile $Pnpm -UseBasicParsing
}

function Ensure-EmbeddedNode {
    if ((Test-Path $NodeExe) -and (Test-Path $NpmCmd)) { return }

    Write-Host "Descargando Node.js $NodeVersion win-x64..."
    $nodeZip = Join-Path $Root 'release\node-win.zip'
    $tmpDir = Join-Path $Root 'release\node-tmp'
    New-Item -ItemType Directory -Force -Path (Join-Path $Root 'release') | Out-Null
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $nodeZip -UseBasicParsing
    if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
    Expand-Archive -Path $nodeZip -DestinationPath $tmpDir -Force
    $extracted = Join-Path $tmpDir "node-v$NodeVersion-win-x64"
    if (Test-Path $NodeDir) { Remove-Item $NodeDir -Recurse -Force }
    Move-Item $extracted $NodeDir -Force
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $nodeZip -Force -ErrorAction SilentlyContinue
}

function Test-StagingReady {
    param([string]$StagingPath)

    $errors = @()
    $expressPath = Join-Path $StagingPath 'server\node_modules\express\package.json'
    if (-not (Test-Path $expressPath)) {
        $errors += 'Falta server/node_modules/express'
    }

    $sqliteNode = Get-ChildItem (Join-Path $StagingPath 'server\node_modules\better-sqlite3') -Recurse -Filter 'better_sqlite3.node' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $sqliteNode) {
        $errors += 'Falta better_sqlite3.node (recompilar con Node embebido)'
    }

    $canvasNode = Get-ChildItem (Join-Path $StagingPath 'server\node_modules\canvas') -Recurse -Filter '*.node' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $canvasNode) {
        Write-Host '  Aviso: canvas nativo no encontrado; PDF con graficos puede fallar'
    }

    if ($errors.Count -gt 0) {
        throw ($errors -join '; ')
    }
}

Ensure-EmbeddedNode

Write-Host '[1/6] Instalando dependencias del workspace...'
& $Pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install fallo' }

Write-Host '[2/6] Compilando frontend...'
& $Pnpm --filter vet-mis-client run build
if ($LASTEXITCODE -ne 0) { throw 'vite build fallo' }

Write-Host '[3/6] Preparando staging...'
$Staging = Join-Path $Root ("release\staging-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$serverDst = Join-Path $Staging 'server'
New-Item -ItemType Directory -Force -Path (Join-Path $Staging 'runtime') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Staging 'client') | Out-Null
New-Item -ItemType Directory -Force -Path $serverDst | Out-Null

Copy-Item $NodeExe (Join-Path $Staging 'runtime\node.exe') -Force
Copy-Item (Join-Path $Root 'client\dist') (Join-Path $Staging 'client\dist') -Recurse -Force

$serverSrc = Join-Path $Root 'server'
Get-ChildItem $serverSrc -Force | Where-Object {
    $_.Name -notin @('node_modules') -and $_.Name -notlike '*.db'
} | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $serverDst $_.Name) -Recurse -Force
}

Write-Host '[4/6] Instalando dependencias de produccion con Node embebido...'
$prevPath = $env:PATH
$env:PATH = "$NodeDir;$env:PATH"
Push-Location $serverDst
try {
    & $NpmCmd install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install en staging fallo' }
} finally {
    Pop-Location
    $env:PATH = $prevPath
}

Test-StagingReady -StagingPath $Staging

Write-Host '[5/6] Creando bundle.zip...'
$BundleZip = Join-Path $LauncherDir 'bundle.zip'
if (Test-Path $BundleZip) { Remove-Item $BundleZip -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$compression = [System.IO.Compression.CompressionLevel]::Fastest
[System.IO.Compression.ZipFile]::CreateFromDirectory($Staging, $BundleZip, $compression, $false)

Write-Host '[6/6] Compilando VET-MIS.exe...'
$GoCmd = Get-Command go -ErrorAction SilentlyContinue
$GoExe = if ($GoCmd) { $GoCmd.Source } else { $null }
if (-not $GoExe) {
    $GoDir = Join-Path $Root 'tools\go'
    $GoExe = Join-Path $GoDir 'bin\go.exe'
    if (-not (Test-Path $GoExe)) {
        Write-Host 'Descargando Go portable para compilar el launcher...'
        $goZip = Join-Path $Root 'release\go.zip'
        $goVer = '1.22.5'
        Invoke-WebRequest -Uri "https://go.dev/dl/go$goVer.windows-amd64.zip" -OutFile $goZip -UseBasicParsing
        Expand-Archive -Path $goZip -DestinationPath (Join-Path $Root 'release') -Force
        $extracted = Join-Path $Root 'release\go'
        if (-not (Test-Path $extracted)) {
            $extracted = Get-ChildItem (Join-Path $Root 'release') -Directory | Where-Object { $_.Name -like 'go*' } | Select-Object -First 1 -ExpandProperty FullName
        }
        if (Test-Path (Join-Path $Root 'tools\go')) { Remove-Item (Join-Path $Root 'tools\go') -Recurse -Force }
        Move-Item $extracted (Join-Path $Root 'tools\go') -Force
        Remove-Item $goZip -Force -ErrorAction SilentlyContinue
        $GoExe = Join-Path $GoDir 'bin\go.exe'
    }
}
if (-not (Test-Path $GoExe)) {
    throw 'No se pudo obtener Go para compilar el launcher'
}

New-Item -ItemType Directory -Force -Path $Dist | Out-Null
Push-Location $LauncherDir
& $GoExe build -ldflags '-H windowsgui -s -w' -o (Join-Path $Dist 'VET-MIS.exe') .
Pop-Location

$sizeMb = [math]::Round((Get-Item (Join-Path $Dist 'VET-MIS.exe')).Length / 1MB, 1)
Write-Host ''
Write-Host "Listo: $Dist\VET-MIS.exe ($sizeMb MB)"
Write-Host "Staging conservado en: $Staging"
Write-Host ''
