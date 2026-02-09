#!/bin/bash
# Script de Deployment Automático para San Javier Academy Manager
# Uso: ./deploy.sh

set -e

echo "🚀 Iniciando deployment automático..."
echo ""

# 1. Actualizar desde GitHub
echo "📥 Actualizando código desde GitHub..."
git fetch origin
git checkout main
git pull origin claude/ready-for-deployment-spvME
echo "✅ Código actualizado"
echo ""

# 2. Build de la aplicación React
echo "🔨 Compilando aplicación React..."
npm run build
echo "✅ React app compilada"
echo ""

# 3. Build de Firebase Functions
echo "🔨 Compilando Firebase Functions..."
cd functions
npm run build
cd ..
echo "✅ Functions compiladas"
echo ""

# 4. Deploy a Firebase
echo "🚀 Deploying a Firebase..."
echo "⚠️  Si pregunta 'How many days...', responde: 90"
echo ""

firebase deploy

echo ""
echo "✅ ¡Deployment completado exitosamente!"
echo ""
echo "🌐 Tu aplicación está disponible en:"
echo "   https://san-javieracademy-manager.web.app"
echo ""
