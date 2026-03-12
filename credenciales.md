# Credenciales del Proyecto

Este archivo fue saneado para el repositorio publico.

No se deben commitear:

- claves de Supabase
- service role keys
- tokens de Twilio o Meta
- API keys de Google
- exports de variables de entorno

Usa estos destinos para valores reales:

- `.env.local` para desarrollo local
- variables de entorno del proveedor de deploy para preview/produccion
- gestores de secretos del proveedor cloud cuando aplique

Si en algun momento se subieron credenciales reales a Git, trata el incidente como compromiso:

1. Rota todas las claves afectadas.
2. Actualiza los secretos en Vercel/Supabase/Twilio/Google.
3. Reescribe el historial del repositorio para eliminar los valores antiguos.
4. Invalida cualquier token de larga vida que haya quedado expuesto.

Consulta [env.example](./env.example), [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) y [docs/WHATSAPP_META_SETUP.md](./docs/WHATSAPP_META_SETUP.md) para ejemplos seguros.
