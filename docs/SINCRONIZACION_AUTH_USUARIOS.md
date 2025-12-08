# 🔄 Sincronización Automática: auth.users ↔ usuarios

## 📋 Resumen

El sistema mantiene sincronización automática entre la tabla de autenticación de Supabase (`auth.users`) y la tabla de usuarios de la aplicación (`usuarios`). Esto asegura que:

1. **Todos los usuarios que pueden iniciar sesión** están sincronizados
2. **Los empleados solo pueden vincularse** con usuarios que tienen cuenta de autenticación
3. **La creación de usuarios** se sincroniza automáticamente

## 🔧 Cómo Funciona

### 1. Trigger Automático

Cuando se crea o actualiza un usuario en `auth.users`, un trigger automático (`sync_user_from_auth()`) sincroniza los datos a la tabla `usuarios`:

```sql
-- Trigger que se ejecuta automáticamente
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_from_auth();
```

### 2. Flujo de Creación de Usuario

**Opción A: Crear desde el sistema (recomendado)**
1. Admin crea usuario desde `/admin/usuarios` usando `registerUser()`
2. Se crea primero en `auth.users` (con contraseña)
3. Se crea automáticamente en `usuarios` con el mismo ID
4. El usuario puede iniciar sesión inmediatamente

**Opción B: Crear desde Supabase Dashboard**
1. Admin crea usuario manualmente en Authentication > Users
2. El trigger `sync_user_from_auth()` crea automáticamente el registro en `usuarios`
3. Se debe completar el registro en `usuarios` con datos adicionales (rol, nombre, etc.)

### 3. Vinculación con Empleados

Cuando se crea un empleado y se le asigna un "Usuario del Sistema":

1. **Validación**: El sistema verifica que:
   - El usuario existe en la tabla `usuarios`
   - El usuario está activo
   - El usuario no está ya asignado a otro empleado
   - El usuario tiene cuenta de autenticación (implícito si está en `usuarios`)

2. **Vinculación**: Se crea el registro en `rrhh_empleados` con `usuario_id`

3. **Resultado**: El empleado puede iniciar sesión usando las credenciales del usuario asignado

## 📝 Campos Sincronizados

| Campo | Origen | Destino | Notas |
|-------|--------|---------|-------|
| `id` | `auth.users.id` | `usuarios.id` | Mismo UUID (clave primaria) |
| `email` | `auth.users.email` | `usuarios.email` | Sincronizado automáticamente |
| `nombre` | `auth.users.raw_user_meta_data->>'nombre'` | `usuarios.nombre` | Si no existe, usa parte del email |
| `apellido` | `auth.users.raw_user_meta_data->>'apellido'` | `usuarios.apellido` | Opcional |
| `rol` | `auth.users.raw_user_meta_data->>'rol'` | `usuarios.rol` | Default: 'vendedor' |
| `activo` | `auth.users.raw_user_meta_data->>'activo'` | `usuarios.activo` | Default: true |

## ⚠️ Importante

### Usuarios sin Cuenta de Autenticación

Si un usuario existe en la tabla `usuarios` pero **NO** tiene cuenta en `auth.users`:
- ❌ **NO puede iniciar sesión**
- ❌ **NO aparecerá** en el selector de "Usuario del Sistema" al crear empleados
- ⚠️ Es un estado inconsistente que debe corregirse

### Cómo Corregir Usuarios Desincronizados

1. **Opción 1: Crear cuenta de autenticación**
   - Ir a Supabase Dashboard > Authentication > Users
   - Crear usuario con el mismo email que está en `usuarios`
   - El trigger sincronizará automáticamente

2. **Opción 2: Eliminar y recrear**
   - Eliminar el registro de `usuarios`
   - Crear usuario completo desde `/admin/usuarios`

## 🔍 Verificación

### Verificar si un usuario tiene cuenta de autenticación

```sql
-- Función helper
SELECT usuario_tiene_auth('uuid-del-usuario');

-- Verificación manual
SELECT 
    u.id,
    u.email,
    u.nombre,
    CASE 
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = u.id) 
        THEN 'Sí tiene cuenta' 
        ELSE 'NO tiene cuenta' 
    END as tiene_auth
FROM usuarios u
WHERE u.id = 'uuid-del-usuario';
```

### Listar usuarios sin cuenta de autenticación

```sql
SELECT 
    u.id,
    u.email,
    u.nombre,
    u.rol,
    u.activo
FROM usuarios u
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = u.id
)
AND u.activo = true;
```

## 🚀 Migración

La migración `20250101_sincronizar_auth_usuarios.sql` incluye:

1. ✅ Función `sync_user_from_auth()` - Sincroniza usuarios
2. ✅ Trigger `on_auth_user_created` - Se ejecuta al crear usuario
3. ✅ Trigger `on_auth_user_updated` - Se ejecuta al actualizar email
4. ✅ Función `usuario_tiene_auth()` - Verifica si tiene cuenta de auth

## 📚 Referencias

- **Archivo de migración**: `supabase/migrations/20250101_sincronizar_auth_usuarios.sql`
- **Acción de creación**: `src/actions/auth.actions.ts::registerUser()`
- **Validación en empleados**: `src/actions/rrhh.actions.ts::crearEmpleadoAction()`
- **Formulario de empleados**: `src/app/(admin)/(dominios)/rrhh/empleados/nuevo/empleado-form.tsx`

