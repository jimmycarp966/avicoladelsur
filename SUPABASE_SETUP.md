# 🗄️ Configuración de Supabase

Esta guía te ayudará a configurar completamente el proyecto de Supabase para Avícola del Sur ERP.

## 📋 Prerrequisitos

- Cuenta de [Supabase](https://supabase.com) (gratuita)
- Node.js y npm instalados

## 🚀 Configuración Paso a Paso

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Haz clic en "New Project"
3. Completa los datos:
   - **Name**: `avicola-del-sur-erp`
   - **Database Password**: Crea una contraseña segura
   - **Region**: Elige la más cercana a tu ubicación
4. Espera a que se cree el proyecto (puede tomar unos minutos)

### 2. Configurar Base de Datos

1. En el panel de Supabase, ve a **SQL Editor**
2. Abre una nueva consulta
3. Copia y pega todo el contenido del archivo `supabase/database-schema.sql`
4. Haz clic en **Run** para ejecutar el script

### 3. Configurar Autenticación

1. Ve a **Authentication** > **Settings**
2. Configura:
   - **Site URL**: `http://localhost:3000` (para desarrollo)
   - **Redirect URLs**: Agrega `http://localhost:3000/auth/callback`

### 4. Configurar Storage (Opcional)

1. Ve a **Storage** > **Create bucket**
2. Crea los siguientes buckets:
   - `firmas`: Para firmas digitales de entregas
   - `checklists`: Para fotos de checklists de vehículos
   - `productos`: Para imágenes de productos

### 5. Obtener Credenciales

1. Ve a **Settings** > **API**
2. Copia las siguientes credenciales:
   - **Project URL**
   - **anon/public key**
   - **service_role key** (mantén esto privado)

### 6. Configurar Variables de Entorno

1. Crea el archivo `.env.local` en la raíz del proyecto
2. Copia el contenido de `env.example` y completa con tus credenciales:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Botpress Configuration (opcional)
BOTPRESS_WEBHOOK_URL=
BOTPRESS_API_KEY=

# Twilio Configuration (opcional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 7. Generar Tipos de TypeScript

Una vez configurada la base de datos, genera los tipos de TypeScript:

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Generar tipos
npx supabase gen types typescript --project-id TU_PROJECT_ID --schema public > src/types/database.types.ts
```

### 8. Verificar Configuración

1. Ejecuta el proyecto:
   ```bash
   npm run dev
   ```

2. Verifica que puedas conectarte a Supabase sin errores

## 🔐 Políticas RLS (Row Level Security)

El esquema incluye políticas RLS básicas. Para producción, revisa y ajusta las políticas en **SQL Editor** > **RLS Policies**.

### Políticas por Rol

- **Admin**: Acceso total a todas las tablas
- **Vendedor**: Lectura de productos, gestión de clientes/pedidos/cotizaciones
- **Repartidor**: Solo pedidos asignados a sus rutas
- **Almacenista**: Gestión de stock y almacén

## 📊 Datos de Prueba

El script incluye datos de ejemplo para desarrollo:
- 1 usuario administrador
- 1 usuario vendedor
- 1 usuario repartidor
- 1 usuario almacenista
- 5 productos
- 2 clientes
- 2 vehículos

### Credenciales de Prueba

```
Admin: admin@avicoladelsur.com
Vendedor: vendedor@avicoladelsur.com
Repartidor: repartidor@avicoladelsur.com
Almacenista: almacenista@avicoladelsur.com
```

## 🔧 Solución de Problemas

### Error de Conexión
- Verifica que las variables de entorno estén correctas
- Asegúrate de que el proyecto de Supabase esté activo

### Error de RLS
- Revisa las políticas en Supabase Dashboard
- Verifica que el usuario esté autenticado

### Error de Tipos
- Regenera los tipos de TypeScript después de cambios en la BD
- Asegúrate de que `src/types/database.types.ts` esté actualizado

## 🚀 Próximos Pasos

Una vez configurado Supabase:

1. **Implementar autenticación** con los roles del sistema
2. **Crear layouts** para admin y repartidor
3. **Desarrollar componentes** de UI reutilizables
4. **Implementar funcionalidades** por módulos

## 📞 Soporte

Si tienes problemas con la configuración, revisa:
- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de RLS](https://supabase.com/docs/guides/auth/row-level-security)
- Los logs de la aplicación en el navegador/consola
