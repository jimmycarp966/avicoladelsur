# 👥 Asignación de Usuarios a Sucursales

## 📋 Resumen

Los usuarios se asignan a sucursales a través de la tabla `rrhh_empleados`. Cada empleado tiene un `usuario_id` (que referencia a `usuarios`) y un `sucursal_id` (que referencia a `sucursales`).

---

## 🔗 Relación Usuario → Empleado → Sucursal

```
usuarios (tabla de autenticación)
    ↓ (usuario_id)
rrhh_empleados (tabla de empleados)
    ↓ (sucursal_id)
sucursales (tabla de sucursales)
```

### Estructura de Tablas

```sql
-- Tabla usuarios (autenticación)
usuarios (
    id UUID PRIMARY KEY,
    email VARCHAR(255),
    nombre VARCHAR(255),
    rol VARCHAR(50),  -- admin, vendedor, almacenista, etc.
    ...
)

-- Tabla empleados (RRHH)
rrhh_empleados (
    id UUID PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),  -- ← Conexión con usuario
    sucursal_id UUID REFERENCES sucursales(id),  -- ← Asignación a sucursal
    legajo VARCHAR(20),
    nombre VARCHAR(255),
    ...
)

-- Tabla sucursales
sucursales (
    id UUID PRIMARY KEY,
    nombre VARCHAR(255),
    direccion TEXT,
    ...
)
```

---

## 🛠️ Métodos de Asignación

### 1. **Asignación Manual por SQL** (Recomendado para casos específicos)

Usa el script `scripts/asignar-usuario-especifico.sql`:

```sql
-- Edita estos valores:
DO $$
DECLARE
    v_usuario_email TEXT := 'vendedor@ejemplo.com';  -- Email del usuario
    v_empleado_legajo TEXT := 'EMP001';              -- Legajo del empleado
    v_usuario_id UUID;
    v_empleado_id UUID;
BEGIN
    -- Buscar usuario
    SELECT id INTO v_usuario_id
    FROM usuarios
    WHERE email = v_usuario_email;

    -- Buscar empleado
    SELECT id INTO v_empleado_id
    FROM rrhh_empleados
    WHERE legajo = v_empleado_legajo;

    -- Asignar
    UPDATE rrhh_empleados
    SET usuario_id = v_usuario_id
    WHERE id = v_empleado_id;
END $$;
```

### 2. **Asignación desde la UI de RRHH** (Recomendado para uso diario)

1. Ve a `/rrhh/empleados`
2. Busca el empleado que quieres asignar
3. Edita el empleado
4. En el formulario, selecciona:
   - **Usuario**: El usuario de Supabase Auth que quieres asignar
   - **Sucursal**: La sucursal donde trabaja el empleado
5. Guarda los cambios

### 3. **Asignación Masiva por SQL**

Si necesitas asignar múltiples usuarios:

```sql
-- Ejemplo: Asignar usuarios a empleados por email
UPDATE rrhh_empleados e
SET usuario_id = u.id
FROM usuarios u
WHERE u.email = LOWER(e.nombre || '.' || e.apellido || '@empresa.com')
  AND e.usuario_id IS NULL;
```

---

## 🔍 Verificar Asignaciones Actuales

### Ver todos los empleados con sus usuarios y sucursales:

```sql
SELECT 
    e.legajo,
    e.nombre || ' ' || e.apellido AS empleado,
    u.email AS usuario_email,
    u.rol AS usuario_rol,
    s.nombre AS sucursal
FROM rrhh_empleados e
LEFT JOIN usuarios u ON u.id = e.usuario_id
LEFT JOIN sucursales s ON s.id = e.sucursal_id
WHERE e.activo = true
ORDER BY s.nombre, e.nombre;
```

### Ver empleados sin usuario asignado:

```sql
SELECT 
    legajo,
    nombre || ' ' || apellido AS empleado,
    sucursal_id
FROM rrhh_empleados
WHERE usuario_id IS NULL
  AND activo = true;
```

### Ver empleados sin sucursal asignada:

```sql
SELECT 
    legajo,
    nombre || ' ' || apellido AS empleado,
    usuario_id
FROM rrhh_empleados
WHERE sucursal_id IS NULL
  AND activo = true;
```

---

## ⚠️ Reglas y Validaciones

### 1. **Un usuario solo puede estar asignado a UN empleado**
- No puedes asignar el mismo `usuario_id` a múltiples empleados
- Si intentas hacerlo, obtendrás un error

### 2. **Un empleado solo puede tener UN usuario**
- Cada empleado tiene un solo `usuario_id`
- Si necesitas cambiar, primero desasigna el anterior

### 3. **Un empleado puede cambiar de sucursal**
- Solo actualiza el `sucursal_id` en `rrhh_empleados`
- El usuario mantiene el mismo `usuario_id`

### 4. **Los admins pueden acceder a todas las sucursales**
- Si el usuario tiene rol `admin`, puede ver todas las sucursales
- Puede cambiar de sucursal usando el parámetro `?sid=` en la URL

---

## 🎯 Flujo de Trabajo Recomendado

### Para asignar un nuevo empleado a una sucursal:

1. **Crear usuario en Supabase Auth** (si no existe)
   - Ve a Supabase Dashboard → Authentication → Users
   - Crea el usuario con email y contraseña

2. **Crear registro en tabla `usuarios`**
   - Ve a `/rrhh/empleados/nuevo` o usa SQL:
   ```sql
   INSERT INTO usuarios (email, nombre, apellido, rol, activo)
   VALUES ('nuevo@ejemplo.com', 'Juan', 'Pérez', 'vendedor', true);
   ```

3. **Crear empleado en RRHH**
   - Ve a `/rrhh/empleados/nuevo`
   - Completa los datos del empleado
   - **Selecciona el usuario** del paso 2
   - **Selecciona la sucursal** donde trabajará

4. **Verificar acceso**
   - El empleado debe poder iniciar sesión
   - Debe ver solo su sucursal asignada (a menos que sea admin)

---

## 🔐 Roles y Permisos

### Roles disponibles:
- **`admin`**: Acceso total, puede ver todas las sucursales
- **`vendedor`**: Puede vender en su sucursal asignada
- **`almacenista`**: Puede gestionar inventario en su sucursal
- **`repartidor`**: Puede ver rutas y entregas
- **`tesorero`**: Puede gestionar cajas y movimientos

### Cómo funciona el acceso a sucursales:

```typescript
// El sistema busca la sucursal así:
1. Si el usuario es ADMIN:
   - Puede ver todas las sucursales
   - Puede cambiar de sucursal con ?sid= en la URL
   - Si no especifica, ve la primera sucursal activa

2. Si el usuario NO es ADMIN:
   - Solo ve su sucursal asignada (rrhh_empleados.sucursal_id)
   - No puede cambiar de sucursal
   - Si no tiene sucursal asignada, no puede acceder
```

---

## 🐛 Solución de Problemas

### Problema: "Usuario no tiene sucursal asignada"
**Solución**: Asigna una sucursal al empleado:
```sql
UPDATE rrhh_empleados
SET sucursal_id = 'UUID-de-la-sucursal'
WHERE usuario_id = 'UUID-del-usuario';
```

### Problema: "No puedo ver las ventas de mi sucursal"
**Solución**: Verifica que:
1. El empleado tenga `usuario_id` asignado
2. El empleado tenga `sucursal_id` asignado
3. El usuario tenga el rol correcto (`vendedor` o `admin`)

### Problema: "Quiero cambiar un empleado de sucursal"
**Solución**: Solo actualiza el `sucursal_id`:
```sql
UPDATE rrhh_empleados
SET sucursal_id = 'nueva-sucursal-uuid'
WHERE usuario_id = 'usuario-uuid';
```

---

## 📝 Scripts Útiles

Todos los scripts están en la carpeta `scripts/`:

- `asignar-usuario-empleado.sql`: Asignación automática básica
- `asignar-usuario-especifico.sql`: Asignación manual específica
- `verificar-importacion-empleados.sql`: Verificar asignaciones

---

## ✅ Checklist de Asignación

- [ ] Usuario creado en Supabase Auth
- [ ] Registro en tabla `usuarios` con rol correcto
- [ ] Empleado creado en `rrhh_empleados`
- [ ] `usuario_id` asignado al empleado
- [ ] `sucursal_id` asignado al empleado
- [ ] Usuario puede iniciar sesión
- [ ] Usuario ve su sucursal correctamente
- [ ] Usuario puede realizar ventas (si es vendedor)

---

## 🎓 Ejemplo Completo

```sql
-- 1. Crear usuario en tabla usuarios
INSERT INTO usuarios (email, nombre, apellido, rol, activo)
VALUES ('maria.garcia@avicola.com', 'María', 'García', 'vendedor', true)
RETURNING id;

-- 2. Crear empleado y asignar usuario y sucursal
INSERT INTO rrhh_empleados (
    usuario_id,
    sucursal_id,
    legajo,
    nombre,
    apellido,
    fecha_ingreso,
    activo
)
VALUES (
    'UUID-del-usuario-del-paso-1',
    'UUID-de-la-sucursal',
    'EMP123',
    'María',
    'García',
    CURRENT_DATE,
    true
);

-- 3. Verificar
SELECT 
    e.legajo,
    e.nombre,
    u.email,
    s.nombre AS sucursal
FROM rrhh_empleados e
JOIN usuarios u ON u.id = e.usuario_id
JOIN sucursales s ON s.id = e.sucursal_id
WHERE e.legajo = 'EMP123';
```

---

## 📚 Referencias

- Tabla `rrhh_empleados`: `supabase/database-schema.sql`
- Función `getSucursalUsuario`: `src/lib/utils.ts`
- Scripts de asignación: `scripts/asignar-usuario-*.sql`
- UI de RRHH: `/rrhh/empleados`

