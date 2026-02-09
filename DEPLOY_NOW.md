# 🚀 Deployment Rápido - Un Solo Comando

## Para hacer deployment AHORA mismo:

### En Windows (PowerShell):
```powershell
.\deploy.ps1
```

### En Linux/Mac (Terminal):
```bash
./deploy.sh
```

---

## ✅ ¿Qué incluye este deployment?

1. **4 Fixes Críticas:**
   - ✅ Activación de usuarios cross-browser (Firestore)
   - ✅ UI de gestión de usuarios
   - ✅ Eventos del calendario clickeables
   - ✅ Exportación PDF de grupos

2. **Actualizaciones:**
   - ✅ Node.js 20 (Firebase compatible)
   - ✅ Firestore rules actualizadas
   - ✅ Firebase Functions v2

3. **Deployment completo:**
   - ✅ Hosting (aplicación web)
   - ✅ Firestore (base de datos)
   - ✅ Functions (lógica del servidor)

---

## 📋 Si el script automático falla:

### Opción 1: Deploy sin Functions
```bash
firebase deploy --except functions
```

### Opción 2: Deploy manual paso a paso
```bash
git checkout main
git pull origin claude/ready-for-deployment-spvME
npm run build
cd functions && npm run build && cd ..
firebase deploy
```

---

## 🆘 Troubleshooting

Ver **DEPLOYMENT_GUIDE.md** para soluciones detalladas de errores comunes.

---

## 🌐 URL de la aplicación:
https://san-javieracademy-manager.web.app
