# Variables de Entorno - Vertex AI Bot

## Variables de Entorno para Vercel

### Supabase (Ya existentes)
```
NEXT_PUBLIC_SUPABASE_URL=https://tvijhnglmryjmrstfvbv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Vertex AI (Nuevas - Agregar en Vercel)
```
GOOGLE_CLOUD_PROJECT_ID=gen-lang-client-0184145853
GOOGLE_CLOUD_CREDENTIALS_BASE64=<service-account-key-base64>
```

### WhatsApp (Ya existentes)
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+14155238886
WHATSAPP_FROM_NUMBER=+14155238886
```

### Meta Business API (Opcional)
```
META_WHATSAPP_PHONE_ID=...
META_WHATSAPP_ACCESS_TOKEN=...
```

## Cómo obtener las credenciales de Vertex AI

### 1. Crear Service Account en Google Cloud
1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Navegar a **IAM & Admin** → **Service Accounts**
3. Crear nuevo service account con nombre: `vertex-avicola-bot`
4. Asignar roles:
   - `Vertex AI User`
   - `Cloud Functions Invoker`

### 2. Crear y descargar clave JSON
1. Click en el service account creado
2. Ir a **Keys** → **Add Key** → **Create new key**
3. Seleccionar **JSON**
4. Descargar el archivo `vertex-avicola-bot-key.json`

### 3. Convertir a Base64
```bash
# En Linux/Mac
base64 -i vertex-avicola-bot-key.json | tr -d '\n' > vertex-avicola-bot-key.base64

# En Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("vertex-avicola-bot-key.json")) | Out-File -Encoding ASCII vertex-avicola-bot-key.base64
```

### 4. Agregar en Vercel
1. Ir a [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleccionar el proyecto `avicola-erp`
3. Ir a **Settings** → **Environment Variables**
4. Agregar:
   - **Name**: `GOOGLE_CLOUD_CREDENTIALS_BASE64`
   - **Value**: Copiar el contenido del archivo `.base64`
   - **Environment**: Production, Preview, Development

## Verificación

### Test local
```bash
# Verificar que las variables estén cargadas
echo $GOOGLE_CLOUD_PROJECT_ID
echo $GOOGLE_CLOUD_CREDENTIALS_BASE64 | head -c 50
```

### Test en producción
```bash
# Verificar logs de Vercel
vercel logs --prod
```

## Troubleshooting

### Error: "Could not load the default credentials"
- Verificar que `GOOGLE_CLOUD_CREDENTIALS_BASE64` esté configurada
- Verificar que el base64 sea válido (sin saltos de línea)
- Verificar que el service account tenga los roles correctos

### Error: "Permission denied"
- Verificar que el service account tenga el rol `Vertex AI User`
- Verificar que el project ID sea correcto: `gen-lang-client-0184145853`

### Error: "Quota exceeded"
- Verificar la cuota de Vertex AI en Google Cloud Console
- Considerar aumentar el límite o usar un plan de pago
