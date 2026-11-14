# Запуск и автообновление КосмоЛаб напрямую из GitHub на Windows (порт 8086)
# Команда запуска в PowerShell:
# irm https://raw.githubusercontent.com/pavelb-coder/sim-kosmo/main/run-online.ps1 | iex

$ErrorActionPreference = "Stop"
$Port = if ($env:PORT) { $env:PORT } else { "8086" }
$TargetDir = Join-Path $HOME "sim-kosmo"
$RepoUrl = "https://github.com/pavelb-coder/sim-kosmo.git"
$ZipUrl = "https://github.com/pavelb-coder/sim-kosmo/archive/refs/heads/main.zip"

Write-Host "=== КосмоЛаб (sim-kosmo): загрузка/обновление из GitHub ===" -ForegroundColor Cyan

if (Get-Command git -ErrorAction SilentlyContinue) {
    if (Test-Path (Join-Path $TargetDir ".git")) {
        git -C $TargetDir pull --ff-only
    } else {
        if (Test-Path $TargetDir) { Remove-Item -Recurse -Force $TargetDir }
        git clone $RepoUrl $TargetDir
    }
} else {
    $TmpZip = Join-Path $env:TEMP "sim-kosmo-main.zip"
    $TmpExtract = Join-Path $env:TEMP "sim-kosmo-extract"
    Invoke-WebRequest -Uri $ZipUrl -OutFile $TmpZip
    if (Test-Path $TmpExtract) { Remove-Item -Recurse -Force $TmpExtract }
    Expand-Archive -Path $TmpZip -DestinationPath $TmpExtract -Force
    if (Test-Path $TargetDir) { Remove-Item -Recurse -Force $TargetDir }
    Move-Item -Path (Join-Path $TmpExtract "sim-kosmo-main") -Destination $TargetDir
}

Set-Location $TargetDir

if (Get-Command node -ErrorAction SilentlyContinue) {
    node server.js --port $Port --open
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    Start-Process "http://localhost:$Port"
    python -m http.server $Port --bind 0.0.0.0
} else {
    Write-Host "Node.js и Python не установлены — открываю онлайн-версию GitHub Pages..." -ForegroundColor Yellow
    Start-Process "https://pavelb-coder.github.io/sim-kosmo/"
}
