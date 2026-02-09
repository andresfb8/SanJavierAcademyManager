# Script de Deployment Automatico para San Javier Academy Manager
# Uso: .\deploy.ps1

Write-Host "[*] Iniciando deployment automatico..." -ForegroundColor Green
Write-Host ""

# 1. Actualizar desde GitHub
Write-Host "[1/4] Actualizando codigo desde GitHub..." -ForegroundColor Cyan
git fetch origin
git checkout main
git pull origin claude/ready-for-deployment-spvME

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error al actualizar codigo" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Codigo actualizado" -ForegroundColor Green
Write-Host ""

# 2. Build de la aplicacion React
Write-Host "[2/4] Compilando aplicacion React..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error al compilar React app" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] React app compilada" -ForegroundColor Green
Write-Host ""

# 3. Build de Firebase Functions
Write-Host "[3/4] Compilando Firebase Functions..." -ForegroundColor Cyan
Set-Location functions
npm run build
Set-Location ..

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error al compilar Functions" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Functions compiladas" -ForegroundColor Green
Write-Host ""

# 4. Deploy a Firebase
Write-Host "[4/4] Deploying a Firebase..." -ForegroundColor Cyan
Write-Host "[!] Si pregunta 'How many days...', responde: 90" -ForegroundColor Yellow
Write-Host ""

firebase deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error en deployment" -ForegroundColor Red
    Write-Host "[TIP] Intenta: firebase deploy --except functions" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[OK] Deployment completado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Tu aplicacion esta disponible en:" -ForegroundColor Cyan
Write-Host "   https://san-javieracademy-manager.web.app" -ForegroundColor White
Write-Host ""
