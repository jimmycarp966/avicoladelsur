# 📁 Scripts SQL de Supabase

Esta carpeta contiene todos los scripts SQL necesarios para configurar y mantener la base de datos de Supabase del proyecto Avícola del Sur ERP.

---

## 📋 Archivos Disponibles

### 1. `database-schema.sql`
**Propósito:** Script principal que crea toda la estructura de la base de datos.

**Contiene:**
- ✅ Extensiones necesarias (uuid-ossp, postgis)
- ✅ Todas las tablas del sistema (productos, clientes, vehículos, usuarios, etc.)
- ✅ Relaciones y foreign keys
- ✅ Funciones SQL para operaciones complejas
- ✅ Configuración de RLS (Row Level Security)
- ✅ Políticas de seguridad básicas
- ✅ Datos de ejemplo para desarrollo

**Cuándo ejecutarlo:** 
- Primera vez que configuras el proyecto
- Cuando necesitas recrear toda la base de datos desde cero

**Cómo ejecutarlo:**
1. Ve a Supabase Dashboard → SQL Editor
2. Copia y pega todo el contenido
3. Click en "Run"

---

### 2. `setup-complete.sql`
**Propósito:** Script automatizado que configura el usuario admin y las políticas RLS.

**Contiene:**
- ✅ Vinculación del usuario de autenticación con la tabla `usuarios`
- ✅ Creación del usuario administrador
- ✅ Configuración completa de políticas RLS
- ✅ Verificaciones de configuración

**Cuándo ejecutarlo:**
- Después de crear un usuario en Supabase Authentication
- Cuando tengas problemas de "Usuario no encontrado en el sistema"
- Para resetear políticas de seguridad

**Cómo ejecutarlo:**
1. Asegúrate de haber creado el usuario `admin@avicoladelsur.com` en Authentication
2. Ve a Supabase Dashboard → SQL Editor
3. Copia y pega todo el contenido
4. Click en "Run"

---

### 3. `fix-user-auth.sql`
**Propósito:** Script para vincular manualmente un usuario de autenticación con la tabla usuarios.

**Contiene:**
- ✅ Query para insertar usuario vinculado con auth.users
- ✅ Instrucciones para hacerlo manualmente si hay problemas

**Cuándo ejecutarlo:**
- Solo si `setup-complete.sql` no funciona
- Para crear usuarios adicionales manualmente

---

### 4. `fix-rls-policies.sql`
**Propósito:** Script para corregir o recrear las políticas de seguridad RLS.

**Contiene:**
- ✅ Políticas RLS para la tabla usuarios
- ✅ Opción para desactivar RLS temporalmente (desarrollo)

**Cuándo ejecutarlo:**
- Si tienes errores de permisos
- Para ajustar políticas de seguridad

---

## 🚀 Guía de Configuración Inicial

### Paso 1: Crear Proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Anota tus credenciales (URL y API Keys)

### Paso 2: Ejecutar Schema Principal
```sql
-- Ejecuta: database-schema.sql
```

### Paso 3: Crear Usuario de Autenticación
1. Ve a Authentication → Users
2. Click en "Add User"
3. Email: `admin@avicoladelsur.com`
4. Password: `Admin123!` (o la que prefieras)
5. ✅ Marca "Auto Confirm User"

### Paso 4: Vincular Usuario y Configurar RLS
```sql
-- Ejecuta: setup-complete.sql
```

### Paso 5: Configurar Variables de Entorno
Actualiza el archivo `.env.local` con tus credenciales.

---

## 🔧 Troubleshooting

### Error: "Usuario no encontrado en el sistema"
**Solución:** Ejecuta `setup-complete.sql`

### Error: "Row Level Security Policy violation"
**Solución:** Ejecuta `fix-rls-policies.sql`

### Error: "Invalid login credentials"
**Solución:** 
1. Verifica que el usuario existe en Authentication
2. Verifica que la contraseña es correcta
3. Asegúrate de haber marcado "Auto Confirm User"

### Error: Syntax error en INSERT
**Solución:** Asegúrate de usar la última versión de los scripts

---

## 📝 Notas Importantes

- ⚠️ **NUNCA** ejecutes estos scripts en producción sin respaldo
- ✅ Siempre revisa los scripts antes de ejecutarlos
- 🔐 Los datos de ejemplo son solo para desarrollo
- 📚 Consulta `SUPABASE_SETUP.md` en la raíz para más detalles

---

## 🔄 Actualizado
- Última actualización: 7 de Noviembre, 2025
- Versión: 1.0

