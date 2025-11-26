# 🧑‍💼 Módulo RRHH - Recursos Humanos

## 📋 Resumen Ejecutivo

Módulo completo de Recursos Humanos implementado para Avícola del Sur ERP, que incluye gestión completa de empleados, asistencia, liquidaciones, evaluaciones y reportes. Implementa todas las reglas específicas solicitadas incluyendo límites de adelantos (30% del sueldo) y penalizaciones por faltas sin aviso.

## ✨ Características Principales

### 👥 **Gestión de Empleados**
- ✅ CRUD completo de empleados con datos personales y laborales
- ✅ Vinculación con usuarios del sistema
- ✅ Asignación por sucursal y categoría
- ✅ Legajos únicos y validaciones de DNI/CUIL
- ✅ Datos bancarios para pagos automáticos

### 📊 **Control de Asistencia**
- ✅ Registro manual y automático de asistencia
- ✅ Cálculo automático de retrasos por turno
- ✅ **Regla crítica**: 1 falta sin aviso = pérdida presentismo + jornal
- ✅ **Regla de retrasos**: >15 minutos = falta sin aviso
- ✅ Turnos configurables (mañana/tarde/noche)

### 💰 **Sistema de Liquidaciones**
- ✅ Cálculo automático mensual por empleado
- ✅ Incluye horas extras, turnos y producción por kg
- ✅ Descuentos automáticos de adelantos
- ✅ Workflow: Borrador → Calculada → Aprobada → Pagada
- ✅ Detalle desglosado de cada concepto

### 💸 **Gestión de Adelantos** ✅ **COMPLETAMENTE IMPLEMENTADO**
- ✅ **Página principal** (`/rrhh/adelantos`) con tabla interactiva y estadísticas
- ✅ **Formulario de creación** (`/rrhh/adelantos/nuevo`) con validación en tiempo real
- ✅ **Límite automático del 30% del sueldo básico** validado antes de aprobar
- ✅ **Adelantos en dinero o productos** con campos dinámicos según tipo
- ✅ **Workflow de aprobación** con botones de aprobar/rechazar desde la tabla
- ✅ **Control de porcentajes** por empleado/mes con reinicio automático
- ✅ **Función RPC** `fn_validar_limite_adelanto()` para validación atómica
- ✅ **Estadísticas en tiempo real**: Total, aprobados, pendientes, total aprobado
- ✅ **Distribución por tipo**: Visualización de adelantos en dinero vs productos
- ✅ **Tabla completa** con columnas: Empleado, Tipo, Monto/Valor, Producto, % Sueldo, Fecha, Estado, Aprobado Por

### 📋 **Licencias y Descansos**
- ✅ Tipos: Vacaciones, Enfermedad, Maternidad, Estudio, Otro
- ✅ Cálculo automático de días hábiles
- ✅ Workflow de aprobación
- ✅ Impacto en asistencia automática

### 🎯 **Evaluaciones de Desempeño**
- ✅ Por sucursal y período mensual
- ✅ 5 criterios: Puntualidad, Rendimiento, Actitud, Responsabilidad, Trabajo en Equipo
- ✅ Promedio automático calculado
- ✅ Comentarios cualitativos y objetivos
- ✅ Sistema de notificaciones integrado

### 📢 **Novedades RRHH**
- ✅ Comunicación interna por tipo: General, Sucursal, Categoría
- ✅ Sistema de prioridades (Urgente, Alta, Normal, Baja)
- ✅ Fechas de expiración automática
- ✅ Filtros por destinatarios

### 📈 **Reportes Avanzados**
- ✅ 6 tipos de reportes: Empleados, Liquidaciones, Adelantos, Evaluaciones, Asistencia, Licencias
- ✅ Filtros dinámicos por fechas, empleados, estados
- ✅ Exportación Excel/CSV automática
- ✅ Endpoint API `/api/rrhh/reportes`

## 🏗️ Arquitectura Implementada

### 📁 **Estructura de Archivos**
```
src/
├── app/(admin)/(dominios)/rrhh/
│   ├── empleados/           # ✅ CRUD empleados
│   │   └── nuevo/          # ✅ Formulario creación
│   ├── asistencia/          # ✅ Control asistencia
│   │   └── marcar/         # ✅ Formulario marcado
│   ├── liquidaciones/       # ✅ Cálculo sueldos
│   │   └── calcular/       # ✅ Calculadora masiva
│   ├── adelantos/           # ✅ Gestión adelantos
│   │   ├── nuevo/          # ✅ Formulario creación
│   │   └── adelantos-table-wrapper.tsx  # ✅ Wrapper acciones
│   ├── licencias/           # ✅ Licencias y descansos
│   │   └── nueva/          # ✅ Formulario creación
│   ├── evaluaciones/        # ✅ Evaluaciones desempeño
│   │   └── nueva/          # ✅ Formulario creación
│   ├── novedades/           # ✅ Comunicación interna
│   │   └── nueva/          # ✅ Formulario creación
│   └── reportes/            # ✅ Generador reportes
├── components/tables/
│   └── AdelantosTable.tsx   # ✅ Tabla interactiva adelantos
├── actions/rrhh.actions.ts  # ✅ Server Actions completas
├── lib/
│   ├── schemas/rrhh.schema.ts # ✅ Validaciones Zod
│   └── supabase/             # ✅ Funciones RPC
└── types/domain.types.ts    # ✅ Tipos TypeScript
```

### 🗄️ **Base de Datos**

#### **Nuevas Tablas (10)**
- `sucursales` - Gestión de sucursales
- `rrhh_categorias` - Categorías de empleados
- `rrhh_empleados` - Datos completos empleados
- `rrhh_novedades` - Comunicación interna
- `rrhh_asistencia` - Control diario asistencia
- `rrhh_licencias` - Licencias y descansos
- `rrhh_adelantos` - Adelantos en dinero/productos
- `rrhh_liquidaciones` - Cálculo sueldos mensual
- `rrhh_liquidacion_detalles` - Desglose liquidaciones
- `rrhh_descuentos` - Descuentos adicionales
- `rrhh_evaluaciones` - Evaluaciones desempeño

#### **Funciones RPC**
- `fn_calcular_liquidacion_mensual()` - Cálculo automático sueldos
- `fn_validar_limite_adelanto()` - Control 30% límite
- `fn_marcar_asistencia()` - Registro con reglas retrasos

### 🔐 **Seguridad y Roles**
- ✅ **RLS completo** por tabla con políticas específicas
- ✅ **Empleados ven solo su información**
- ✅ **Admins gestionan todo**
- ✅ **Validaciones preventivas** en Server Actions

## 🎯 **Reglas de Negocio Implementadas**

### **Asistencia Crítica**
1. **Faltas sin aviso**: Una sola = pérdida presentismo + jornal completo
2. **Retrasos**: >15 minutos tarde = falta sin aviso
3. **Turnos**: Mañana (hasta 15:00), Tarde (desde 15:00)

### **Adelantos Controlados**
1. **Límite 30%**: Del sueldo básico mensual por empleado
2. **Validación automática**: Antes de aprobar cualquier adelanto
3. **Control mensual**: Reinicio automático cada mes

### **Liquidaciones Automáticas**
1. **Cálculo mensual**: Basado en asistencia real
2. **Incluye**: Horas extras, producción por kg, adicionales
3. **Descuentos**: Adelantos y penalizaciones automáticas

### **Evaluaciones Estructuradas**
1. **Por sucursal**: Evaluaciones específicas por ubicación
2. **5 criterios**: Escala 1-5 con promedio automático
3. **Notificaciones**: Sistema integrado de avisos

## 🚀 **Navegación y UI**

### **Menú Principal**
```
RRHH
├── 👥 Empleados
├── ⏰ Asistencia
├── 💰 Liquidaciones
├── 💸 Adelantos
├── 📅 Licencias
├── 📊 Evaluaciones
├── 📢 Novedades
└── 📋 Reportes
```

### **Páginas Implementadas**
- ✅ **Empleados** (`/rrhh/empleados`): Listado + CRUD completo con estadísticas
- ✅ **Asistencia** (`/rrhh/asistencia`): Control diario con estadísticas y marcado manual
- ✅ **Liquidaciones** (`/rrhh/liquidaciones`): Calculadora masiva + detalles con workflow completo
- ✅ **Adelantos** (`/rrhh/adelantos`): 
  - Listado completo con tabla interactiva
  - Estadísticas (total, aprobados, pendientes, total aprobado)
  - Distribución por tipo (dinero/productos)
  - Formulario para crear nuevos adelantos (`/rrhh/adelantos/nuevo`)
  - Aprobación/rechazo desde la tabla
  - Validación automática del límite del 30% del sueldo básico
- ✅ **Licencias** (`/rrhh/licencias`): Solicitudes con aprobación y cálculo automático de días
- ✅ **Evaluaciones** (`/rrhh/evaluaciones`): Formularios por sucursal con 5 criterios
- ✅ **Novedades** (`/rrhh/novedades`): Comunicación segmentada con prioridades
- ✅ **Reportes** (`/rrhh/reportes`): Generador con filtros múltiples y exportación

## 📊 **Estadísticas y KPIs**

### **Dashboard RRHH**
- 📈 **Empleados activos** por sucursal
- ⏱️ **Asistencia promedio** diaria
- 💰 **Total sueldos** pagados por período
- 📊 **Evaluaciones promedio** por sucursal
- 🚫 **Faltas sin aviso** del mes
- 💸 **Adelantos pendientes** de aprobación

### **Reportes Disponibles**
1. **Empleados**: Listado completo con datos laborales
2. **Liquidaciones**: Sueldos calculados por período
3. **Adelantos**: Historial con estados de aprobación
4. **Evaluaciones**: Resultados por empleado/sucursal
5. **Asistencia**: Control diario con estadísticas
6. **Licencias**: Historial de permisos y descansos

## 🔧 **Implementación Técnica**

### **Stack Tecnológico**
- ✅ **Next.js 15** con App Router
- ✅ **React 19** + TypeScript
- ✅ **Supabase** (Postgres + Auth + Storage)
- ✅ **Server Actions** para lógica crítica
- ✅ **Zod** para validaciones
- ✅ **Tailwind CSS** + shadcn/ui

### **Patrones Implementados**
- ✅ **Server-Side First**: Toda lógica crítica en servidor
- ✅ **Atomic Operations**: Transacciones para integridad
- ✅ **RLS Estricto**: Seguridad por fila y rol
- ✅ **Real-time**: Actualizaciones automáticas
- ✅ **Error Handling**: Mensajes user-friendly

## 📋 **Checklist de Funcionalidades**

### ✅ **Completado**
- [x] Gestión completa de empleados
- [x] Sistema de asistencia con reglas críticas
- [x] Liquidaciones automáticas mensuales
- [x] Control de adelantos con límite 30%
- [x] Licencias y descansos con aprobación
- [x] Evaluaciones por sucursal con 5 criterios
- [x] Novedades segmentadas por tipo
- [x] Reportes exportables (Excel/CSV)
- [x] Navegación integrada al sistema
- [x] Base de datos completa con índices
- [x] Funciones RPC optimizadas
- [x] Políticas RLS completas
- [x] UI/UX consistente con el ERP

### 🚀 **Próximas Mejoras Sugeridas**
- 📧 **Notificaciones por email** para evaluaciones
- 📱 **App móvil** para empleados (marcado asistencia)
- 🤖 **Recordatorios automáticos** de vencimientos
- 📊 **Dashboard ejecutivo** con KPIs avanzados
- 🔄 **Integración con sistemas** de nómina externos

## 🎉 **Estado: COMPLETAMENTE FUNCIONAL**

El módulo RRHH está **100% implementado y listo para producción**, siguiendo todas las reglas de negocio especificadas y manteniendo la consistencia con la arquitectura del ERP Avícola del Sur.

**¡Listo para gestionar todo el personal de manera eficiente y automatizada!** 🎯
