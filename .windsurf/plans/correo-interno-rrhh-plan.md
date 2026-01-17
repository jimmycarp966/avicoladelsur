# Plan: Sistema de Correo Interno para RRHH

## Resumen
Implementar un sistema de casillas de correo interno para permitir comunicación entre usuarios del sistema, especialmente para solicitar autorizaciones en RRHH (adelantos, licencias, etc.).

## Análisis del Estado Actual

### Estructura Existente
- **Tabla `usuarios`**: Contiene email, nombre, apellido, rol, activo
- **Roles del sistema**: admin, encargado_sucursal, almacenista, vendedor, tesorero
- **Módulo RRHH**: Empleados, asistencia, liquidaciones, adelantos, licencias
- **Sistema de notificaciones**: WhatsApp para clientes (no para usuarios internos)
- **Autenticación**: Supabase Auth con JWT

### Necesidades Identificadas
- Sistema de mensajería interna entre usuarios
- Workflow de autorizaciones (solicitar → aprobar/rechazar)
- Bandeja de entrada y enviados por usuario
- Notificaciones en tiempo real de nuevos mensajes
- Integración con procesos RRHH (adelantos, licencias)

## Diseño Propuesto

### 1. Base de Datos (Supabase)

#### Tabla: `mensajes_internos`
```sql
CREATE TABLE mensajes_internos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    de_empleado_id UUID REFERENCES rrhh_empleados(id) ON DELETE CASCADE,
    para_empleado_id UUID REFERENCES rrhh_empleados(id) ON DELETE CASCADE,
    asunto VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(50) DEFAULT 'general', -- 'general', 'autorizacion_adelanto', 'autorizacion_licencia', 'notificacion'
    estado VARCHAR(20) DEFAULT 'no_leido', -- 'no_leido', 'leido', 'archivado'
    prioridad VARCHAR(20) DEFAULT 'normal', -- 'baja', 'normal', 'alta', 'urgente'
    referencia_id UUID, -- ID de la entidad relacionada (adelanto, licencia, etc.)
    referencia_tipo VARCHAR(50), -- Tipo de entidad relacionada
    fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Índices
```sql
CREATE INDEX idx_mensajes_internos_para_empleado ON mensajes_internos(para_empleado_id, fecha_envio DESC);
CREATE INDEX idx_mensajes_internos_de_empleado ON mensajes_internos(de_empleado_id, fecha_envio DESC);
CREATE INDEX idx_mensajes_internos_estado ON mensajes_internos(para_empleado_id, estado);
CREATE INDEX idx_mensajes_internos_referencia ON mensajes_internos(referencia_id, referencia_tipo);
```

#### Políticas RLS
```sql
-- Empleados solo ven sus mensajes (enviados y recibidos)
CREATE POLICY "Empleados ven sus mensajes recibidos" ON mensajes_internos
    FOR SELECT USING (
        para_empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Empleados ven sus mensajes enviados" ON mensajes_internos
    FOR SELECT USING (
        de_empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Empleados pueden enviar mensajes" ON mensajes_internos
    FOR INSERT WITH CHECK (
        de_empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Empleados pueden marcar como leídos" ON mensajes_internos
    FOR UPDATE USING (
        para_empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

-- Admins ven todos los mensajes
CREATE POLICY "Admins ven todos los mensajes" ON mensajes_internos
    FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');

-- IMPORTANTE: No se permite eliminar mensajes (archivar solo cambia estado)
-- Los mensajes se conservan permanentemente para auditoría
```

### 2. Server Actions

#### `src/actions/mensajes-internos.actions.ts`

**Funciones principales:**
- `enviarMensajeInterno()` - Enviar mensaje a otro empleado
- `obtenerBandejaEntrada()` - Obtener mensajes recibidos
- `obtenerBandejaEnviados()` - Obtener mensajes enviados
- `marcarComoLeido()` - Marcar mensaje como leído
- `archivarMensaje()` - Archivar mensaje (solo cambia estado a 'archivado')
- `obtenerContadorNoLeidos()` - Contador de mensajes no leídos
- `enviarSolicitudAutorizacion()` - Enviar solicitud de autorización específica

**IMPORTANTE: No hay función de eliminar mensajes**
- Los mensajes se conservan permanentemente para auditoría
- Solo se puede archivar (cambiar estado a 'archivado')
- Los archivados no aparecen en la bandeja principal pero siguen accesibles

### 3. Componentes UI

#### Selector de Destinatarios

**¿Quiénes pueden recibir mensajes?**
- **Solo empleados registrados** (tabla `rrhh_empleados`)
- Solo empleados con usuario_id asignado y activo pueden recibir mensajes
- Esto incluye: todos los empleados que tienen cuenta de autenticación

**Cómo funciona el selector:**
```typescript
// Información mostrada en el selector:
{
  empleado_id: string,
  nombre_completo: string,   // "Juan Pérez" (de usuarios)
  legajo: string,            // "1234"
  sucursal: string,          // "Sucursal Alberdi"
  categoria: string,         // "Vendedor"
  activo: boolean            // Solo empleados activos
}
```

**Características del selector:**
- Buscador por nombre, legajo, sucursal o categoría
- Filtro por sucursal (solo empleados de una sucursal específica)
- Filtro por categoría (solo vendedores, solo almacenistas, etc.)
- Autocompletado mientras se escribe
- Muestra legajo y sucursal del empleado
- Solo muestra empleados activos

**Destinatarios sugeridos según contexto:**
- Para autorización de adelanto: Empleados con rol admin o encargado de sucursal
- Para autorización de licencia: Empleados con rol admin o encargado de sucursal
- Para notificación de liquidación: El empleado específico
- Para mensajes generales: Cualquier empleado activo

#### Estructura de páginas
```
src/app/(admin)/(dominios)/mensajes/
├── page.tsx                    # Bandeja de entrada principal
├── enviados/page.tsx           # Bandeja de enviados
├── nuevo/page.tsx              # Componer nuevo mensaje
├── [id]/page.tsx               # Ver mensaje individual
└── components/
    ├── bandeja-entrada.tsx     # Tabla de mensajes recibidos
    ├── bandeja-enviados.tsx    # Tabla de mensajes enviados
    ├── nuevo-mensaje-form.tsx  # Formulario nuevo mensaje
    ├── mensaje-detalle.tsx     # Vista detalle mensaje
    └── contador-mensajes.tsx   # Badge contador no leídos
```

#### Componentes principales
- **BandejaEntrada**: Lista de mensajes recibidos con filtros (estado, tipo, prioridad)
- **BandejaEnviados**: Lista de mensajes enviados
- **NuevoMensajeForm**: Formulario para enviar mensaje con selector de destinatario
- **MensajeDetalle**: Vista completa del mensaje con historial de respuestas
- **ContadorMensajes**: Badge en el menú con contador de mensajes no leídos

### 4. Integración con RRHH

#### Automatización de solicitudes
- **Adelantos**: Al crear adelanto → enviar mensaje automático a admin/encargado
- **Licencias**: Al solicitar licencia → enviar mensaje automático a admin/encargado
- **Liquidaciones**: Al calcular liquidación → enviar notificación al empleado
- **Evaluaciones**: Al completar evaluación → enviar notificación al empleado

#### Tipos de mensajes especiales
- `autorizacion_adelanto`: Solicitud de aprobación de adelanto
- `autorizacion_licencia`: Solicitud de aprobación de licencia
- `notificacion_liquidacion`: Notificación de liquidación generada
- `notificacion_evaluacion`: Notificación de evaluación completada

### 5. Notificaciones en Tiempo Real

#### Opciones de implementación
1. **Supabase Realtime**: Suscripciones a cambios en `mensajes_internos`
2. **Polling**: Consulta periódica cada 30-60 segundos
3. **Push Notifications**: Notificaciones push del navegador

#### Implementación recomendada: Supabase Realtime
```typescript
// Suscripción a nuevos mensajes
const channel = supabase
  .channel('mensajes_internos')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'mensajes_internos',
      filter: `para_empleado_id=eq.${empleadoId}`
    },
    (payload) => {
      // Mostrar notificación toast
      toast.success('Nuevo mensaje recibido')
      // Actualizar contador
      refetchContador()
    }
  )
  .subscribe()
```

### 6. Integración con Menú Principal

#### Agregar badge de notificaciones
```tsx
// En el componente de navegación
<Badge count={contadorNoLeidos}>
  <Button variant="ghost">
    <Mail className="h-5 w-5" />
  </Button>
</Badge>
```

## Plan de Implementación

### Fase 1: Base de Datos (Migración)
1. Crear migración SQL con tabla `mensajes_internos`
2. Crear índices para performance
3. Configurar políticas RLS
4. Probar permisos con diferentes roles

### Fase 2: Server Actions
1. Crear archivo `src/actions/mensajes-internos.actions.ts`
2. Implementar funciones CRUD básicas
3. Implementar función de contador no leídos
4. Implementar función de solicitud de autorización
5. Agregar validaciones Zod

### Fase 3: UI - Bandeja de Entrada
1. Crear página principal `/mensajes`
2. Crear componente `BandejaEntrada` con tabla
3. Agregar filtros por estado, tipo, prioridad
4. Implementar paginación
5. Agregar acciones rápidas (marcar leído, archivar)

### Fase 4: UI - Nuevo Mensaje
1. Crear página `/mensajes/nuevo`
2. Crear formulario con selector de destinatario
3. Agregar selector de tipo y prioridad
4. Implementar envío de mensaje
5. Validar destinatario activo

### Fase 5: UI - Bandeja Enviados
1. Crear página `/mensajes/enviados`
2. Crear componente `BandejaEnviados`
3. Mostrar historial de mensajes enviados

### Fase 6: UI - Detalle Mensaje
1. Crear página `/mensajes/[id]`
2. Mostrar mensaje completo
3. Implementar función de respuesta
4. Mostrar historial de acciones

### Fase 7: Integración RRHH
1. Modificar `crearAdelantoAction` para enviar mensaje automático
2. Modificar `solicitarLicenciaAction` para enviar mensaje automático
3. Modificar `calcularLiquidacionAction` para enviar notificación
4. Modificar `crearEvaluacionAction` para enviar notificación

### Fase 8: Notificaciones en Tiempo Real
1. Configurar Supabase Realtime
2. Implementar suscripción a nuevos mensajes
3. Agregar notificaciones toast
4. Actualizar contador en tiempo real

### Fase 9: Integración Menú
1. Agregar badge de contador en navegación
2. Agregar enlace a mensajes en menú principal
3. Configurar permisos de acceso

### Fase 10: Testing
1. Probar envío de mensajes entre usuarios
2. Probar workflow de autorizaciones
3. Probar notificaciones en tiempo real
4. Probar permisos RLS
5. Probar integración con RRHH

## Consideraciones Técnicas

### Seguridad
- Validar que destinatario exista y esté activo
- Implementar rate limiting para evitar spam
- Sanitizar contenido de mensajes
- Usar RLS para asegurar privacidad

### Performance
- Índices en columnas frecuentemente consultadas
- Paginación en listados
- Caching de contador no leídos
- Optimizar queries con joins

### UX
- Indicador visual de mensajes no leídos
- Preview de mensaje en bandeja
- Búsqueda rápida por asunto/remitente
- Filtros por tipo y prioridad
- Acciones rápidas desde bandeja

### Escalabilidad
- Preparado para futuras extensiones (adjuntos, respuestas múltiples)
- Soporte para mensajes masivos (broadcast)
- Integración con sistema de notificaciones push

## Archivos a Crear/Modificar

### Nuevos archivos
- `supabase/migrations/20250116_sistema_correo_interno.sql`
- `src/actions/mensajes-internos.actions.ts`
- `src/lib/schemas/mensajes-internos.schema.ts`
- `src/app/(admin)/(dominios)/mensajes/page.tsx`
- `src/app/(admin)/(dominios)/mensajes/enviados/page.tsx`
- `src/app/(admin)/(dominios)/mensajes/nuevo/page.tsx`
- `src/app/(admin)/(dominios)/mensajes/[id]/page.tsx`
- `src/app/(admin)/(dominios)/mensajes/components/bandeja-entrada.tsx`
- `src/app/(admin)/(dominios)/mensajes/components/bandeja-enviados.tsx`
- `src/app/(admin)/(dominios)/mensajes/components/nuevo-mensaje-form.tsx`
- `src/app/(admin)/(dominios)/mensajes/components/mensaje-detalle.tsx`
- `src/app/(admin)/(dominios)/mensajes/components/contador-mensajes.tsx`

### Archivos a modificar
- `src/actions/rrhh.actions.ts` - Agregar envío de mensajes automáticos
- `src/types/domain.types.ts` - Agregar tipos de mensajes
- `src/components/navigation/main-nav.tsx` - Agregar badge contador
- `middleware.ts` - Agregar ruta `/mensajes` (acceso a todos los usuarios autenticados)

## Próximos Pasos

1. **Confirmar requisitos** con el usuario
2. **Aprobar plan** de implementación
3. **Iniciar Fase 1**: Crear migración de base de datos
4. **Continuar con fases** secuenciales
5. **Testing exhaustivo** en cada fase
