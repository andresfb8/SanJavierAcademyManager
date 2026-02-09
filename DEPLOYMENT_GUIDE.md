# Guía de Deployment - Firebase Functions

## Error común: onPlayerStatusChange deployment failed

### Soluciones en orden de probabilidad:

### 1. **Problema de Billing/Permisos (Más común)**
Firebase Functions v2 requiere billing habilitado y permisos específicos.

**Solución:**
```bash
# Habilita los APIs necesarios
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable eventarc.googleapis.com
```

### 2. **Respuesta a la pregunta de container cleanup**
Cuando Firebase pregunte: "How many days do you want to keep container images?"
- **Escribe:** `90`
- **Presiona:** Enter

Esto mantiene imágenes por 90 días (balancea costo vs seguridad).

### 3. **Deploy solo Hosting y Firestore (sin Functions)**
Si las Functions siguen fallando, puedes deployar el resto:
```bash
firebase deploy --except functions
```

### 4. **Deploy Functions específicas**
Intenta deployar solo las que funcionan:
```bash
# Deploy solo billing functions
firebase deploy --only functions:generateMonthlyReceiptsScheduled,functions:generateMonthlyReceiptsCallable
```

### 5. **Ver logs detallados del error**
```bash
# Ver logs de la función
firebase functions:log --only onPlayerStatusChange --limit 50
```

### 6. **Deploy con más tiempo de timeout**
```bash
# Deploy con timeout extendido
firebase deploy --force --debug
```

## ✅ **Deployment Completo Recomendado:**

```bash
# 1. Asegúrate de estar en main
git checkout main

# 2. Build local
npm run build
cd functions && npm run build && cd ..

# 3. Deploy todo (responde 90 a la pregunta de cleanup)
firebase deploy

# Si falla, intenta sin functions primero
firebase deploy --except functions

# Luego deploy solo functions
firebase deploy --only functions
```

## 📊 **Verificación Post-Deployment:**

```bash
# Ver estado de las functions
firebase functions:list

# Ver logs en tiempo real
firebase functions:log --follow

# Test de la app
# Abre: https://san-javieracademy-manager.web.app
```
