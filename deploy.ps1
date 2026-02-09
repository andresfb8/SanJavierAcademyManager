# Script de Deployment Automático para San Javier Academy Manager
# Uso: .\deploy.ps1

Write-Host "🚀 Iniciando deployment automático..." -ForegroundColor Green
Write-Host ""

# 1. Actualizar desde GitHub
Write-Host "📥 Actualizando código desde GitHub..." -ForegroundColor Cyan
git fetch origin
git checkout main
git pull origin claude/ready-for-deployment-spvME

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al actualizar código" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Código actualizado" -ForegroundColor Green
Write-Host ""

# 2. Build de la aplicación React
Write-Host "🔨 Compilando aplicación React..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al compilar React app" -ForegroundColor Red
    exit 1
}

Write-Host "✅ React app compilada" -ForegroundColor Green
Write-Host ""

# 3. Build de Firebase Functions
Write-Host "🔨 Compilando Firebase Functions..." -ForegroundColor Cyan
Set-Location functions
npm run build
Set-Location ..

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al compilar Functions" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Functions compiladas" -ForegroundColor Green
Write-Host ""

# 4. Deploy a Firebase
Write-Host "🚀 Deploying a Firebase..." -ForegroundColor Cyan
Write-Host "⚠️  Si pregunta 'How many days...', responde: 90" -ForegroundColor Yellow
Write-Host ""

firebase deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error en deployment" -ForegroundColor Red
    Write-Host "💡 Intenta: firebase deploy --except functions" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ ¡Deployment completado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Tu aplicación está disponible en:" -ForegroundColor Cyan
Write-Host "   https://san-javieracademy-manager.web.app" -ForegroundColor White
Write-Host ""
