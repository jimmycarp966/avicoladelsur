# 👤 Usuario Repartidor - Configuración y Permisos

## 📋 Configuración Inicial

### Paso 1: Crear usuario en Supabase Auth
1. Ve al Dashboard de Supabase
2. Navega a **Authentication > Users**
3. Haz clic en **Add User**
4. Completa:
   - **Email**: `repartidor@avicoladelsur.com`
   - **Password**: (establece una contraseña segura)
   - **Auto Confirm User**: ✅ (marcar)

### Paso 2: Vincular con tabla usuarios
Ejecuta el script SQL `supabase/crear-usuario-repartidor.sql` en el SQL Editor de Supabase.

Este script:
- ✅ Vincula el usuario de Auth con la tabla `usuarios`
- ✅ Asigna el rol `repartidor`
- ✅ Activa el usuario
- ✅ Asigna un vehículo disponible (si existe)

### Paso 3: Verificar configuración
Ejecuta esta consulta para verificar:

```sql
SELECT 
    u.id, 
    u.email, 
    u.nombre, 
    u.apellido, 
    u.rol, 
    u.activo,
    u.vehiculo_asignado,
    v.patente as vehiculo_patente
FROM usuarios u
LEFT JOIN vehiculos v ON u.vehiculo_asignado = v.id
WHERE u.email = 'repartidor@avicoladelsur.com';
```

## 🔐 Credenciales de Acceso

- **Email**: `repartidor@avicoladelsur.com`
- **Password**: (la que configuraste en Supabase Auth)
- **URL de acceso**: `/repartidor` o `/repartidor/home`

## 👀 ¿Qué puede ver el usuario repartidor?

### 📱 Páginas Disponibles (PWA Móvil)

#### 1. **Dashboard** (`/repartidor/home`)
- ✅ Ruta activa del día
- ✅ Estadísticas de entregas (completadas/pendientes)
- ✅ Próximas entregas
- ✅ Gráficos de rendimiento personal
- ✅ Métricas de eficiencia

#### 2. **Entregas** (`/repartidor/entregas`)
- ✅ Lista de todas sus entregas del día
- ✅ Filtros por fecha y turno (mañana/tarde)
- ✅ Información completa de cada entrega:
  - Datos del cliente (nombre, teléfono, dirección)
  - Detalles del pedido
  - Estado de pago
  - Instrucciones especiales
- ✅ Estadísticas rápidas (total, completadas, por cobrar)

#### 3. **Hoja de Ruta** (`/repartidor/ruta/[ruta_id]`)
- ✅ Detalles completos de la ruta asignada
- ✅ Lista de entregas en orden optimizado
- ✅ GPS tracking en tiempo real
- ✅ Checklist de inicio/fin de ruta
- ✅ Registro de entregas con:
  - Firma digital del cliente
  - QR de verificación
  - Estado de pago
  - Foto de comprobante

#### 4. **Mapa de Ruta** (`/repartidor/ruta/[ruta_id]/mapa`)
- ✅ Visualización de la ruta en mapa
- ✅ Ubicación actual del repartidor
- ✅ Puntos de entrega marcados

#### 5. **Detalle de Entrega** (`/repartidor/ruta/[ruta_id]/entrega/[entrega_id]`)
- ✅ Información completa del cliente
- ✅ Detalles del pedido
- ✅ Registro de entrega
- ✅ Captura de firma
- ✅ Registro de pago

### 📊 Datos que puede ver (según políticas RLS)

#### ✅ **Puede ver:**
- **Sus propias rutas**: Solo rutas donde `repartidor_id = auth.uid()`
- **Entregas asignadas**: Solo entregas de sus rutas activas
- **Sus ubicaciones GPS**: Solo las ubicaciones que él mismo registra
- **Alertas de reparto**: Solo alertas relacionadas con sus rutas
- **Vehículo asignado**: El vehículo en `vehiculo_asignado`
- **Pedidos**: Solo los pedidos asignados a sus rutas
- **Clientes**: Solo clientes de pedidos en sus rutas
- **Productos**: Solo productos de pedidos en sus rutas

#### ❌ **NO puede ver:**
- Rutas de otros repartidores
- Pedidos no asignados a sus rutas
- Datos de otros usuarios
- Configuraciones del sistema
- Panel administrativo
- Reportes globales
- Gestión de inventario
- Gestión de clientes

### ⚙️ Acciones que puede realizar

#### ✅ **Puede hacer:**
1. **Registrar ubicación GPS**: Envío automático cada 5 segundos durante reparto activo
2. **Registrar entregas**: Con firma digital y QR de verificación
3. **Actualizar estado de pago**: 
   - "Ya pagó"
   - "Pendiente de pago"
   - "Pagará después"
4. **Completar checklist**: Inicio y fin de ruta
5. **Ver navegación GPS**: A la siguiente entrega
6. **Subir comprobantes**: Fotos de recibos o transferencias
7. **Registrar devoluciones**: Si es necesario

#### ❌ **NO puede hacer:**
- Crear o modificar rutas
- Asignar pedidos a rutas
- Modificar datos de clientes
- Modificar datos de productos
- Acceder al panel administrativo
- Ver reportes globales
- Gestionar inventario

## 🔒 Políticas de Seguridad (RLS)

El sistema implementa Row Level Security (RLS) estricto:

- **Rutas**: Solo puede ver/editar rutas donde es el repartidor asignado
- **Entregas**: Solo puede ver/editar entregas de sus rutas
- **Ubicaciones GPS**: Solo puede insertar sus propias ubicaciones
- **Pedidos**: Solo puede ver pedidos asignados a sus rutas
- **Clientes**: Solo puede ver clientes de pedidos en sus rutas

## 🚗 Vehículo Asignado

El repartidor necesita tener un vehículo asignado para:
- Ver sus rutas en `/repartidor/entregas`
- Registrar ubicaciones GPS
- Completar checklists de vehículo

Si el repartidor no tiene vehículo asignado, verá un mensaje:
> "No hay vehículo asignado. Contacta al administrador para asignar un vehículo"

Para asignar un vehículo, ejecuta:
```sql
UPDATE usuarios 
SET vehiculo_asignado = (SELECT id FROM vehiculos WHERE patente = 'ABC123' LIMIT 1)
WHERE email = 'repartidor@avicoladelsur.com';
```

## 📱 Características de la PWA Móvil

- ✅ **Diseño Mobile-First**: Optimizado para dispositivos móviles
- ✅ **Navegación inferior**: Barra de navegación fija en la parte inferior
- ✅ **GPS Tracking**: Funciona en segundo plano durante repartos
- ✅ **Offline**: Funcionalidad básica sin conexión
- ✅ **Instalable**: Se puede instalar como app nativa

## 🆘 Solución de Problemas

### El usuario no puede iniciar sesión
1. Verifica que el usuario existe en `auth.users`
2. Verifica que existe en la tabla `usuarios` con el mismo ID
3. Verifica que `activo = true`

### El usuario no ve rutas
1. Verifica que tiene un vehículo asignado
2. Verifica que hay rutas creadas con ese repartidor
3. Verifica que las rutas están en estado `planificada` o `en_curso`

### El usuario no puede registrar ubicaciones GPS
1. Verifica que tiene un vehículo asignado
2. Verifica que tiene una ruta activa
3. Verifica permisos de ubicación en el navegador

## 📝 Notas Importantes

- El usuario repartidor **NO** puede acceder a rutas administrativas
- Todas las acciones están registradas con el ID del usuario
- Las políticas RLS garantizan que solo vea sus propios datos
- El vehículo asignado es opcional pero recomendado para funcionalidad completa




