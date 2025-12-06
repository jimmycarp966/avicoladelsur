# 📥 Instalar Google Cloud CLI en Windows

## Opción 1: Instalador Interactivo (Recomendado)

1. **Descargar el instalador:**
   - Ve a: https://cloud.google.com/sdk/docs/install
   - Descarga el instalador para Windows
   - O descarga directa: https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe

2. **Ejecutar el instalador:**
   - Ejecuta `GoogleCloudSDKInstaller.exe`
   - Sigue el asistente de instalación
   - Asegúrate de marcar "Run gcloud init" al finalizar

3. **Inicializar gcloud:**
   ```powershell
   gcloud init
   ```
   - Te pedirá autenticarte y seleccionar un proyecto

## Opción 2: Con Chocolatey (Si lo tienes instalado)

```powershell
choco install gcloudsdk
```

## Opción 3: Con PowerShell (Script de instalación)

```powershell
# Descargar e instalar automáticamente
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:TEMP\GoogleCloudSDKInstaller.exe")
Start-Process -FilePath "$env:TEMP\GoogleCloudSDKInstaller.exe" -Wait
```

## Verificar Instalación

Después de instalar, cierra y vuelve a abrir PowerShell, luego:

```powershell
gcloud --version
```

Si no funciona, puede que necesites agregar gcloud al PATH manualmente o reiniciar PowerShell.

## Autenticarse

Una vez instalado:

```powershell
gcloud auth login
```

Esto abrirá tu navegador para autenticarte con tu cuenta de Google Cloud.

---

**Después de instalar, vuelve a ejecutar el script de configuración:**
```powershell
.\scripts\setup-google-cloud.ps1
```

