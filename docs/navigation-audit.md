# 🧭 Auditoría del Menú Lateral (Admin)

Resumen del estado actual de las rutas dentro de `src/app/(admin)/(dominios)` y su visibilidad en el sidebar.

| Dominio | Ruta base | Subrutas clave detectadas | Rol/es objetivo | ¿En sidebar? | Observaciones |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `/dashboard` | — | admin, vendedor, almacenista | ✅ | Ítem principal ya presente. |
| Almacén | `/almacen` | `/productos`, `/lotes`, `/lotes/[id]/editar`, `/presupuestos-dia`, `/recepcion`, `/presupuesto/[id]/pesaje` | admin, almacenista | ⚠️ Parcial | Solo se listan Productos, Lotes y Presupuestos del día. Falta acceso rápido a Recepción y a los detalles operativos (pesaje). |
| Ventas | `/ventas` | `/presupuestos`, `/presupuestos/[id]/editar`, `/pedidos`, `/clientes` | admin, vendedor | ✅ | Cobertura completa de submódulos principales. |
| Reparto | `/reparto` | `/planificacion`, `/rutas`, `/rutas/[id]`, `/monitor`, `/vehiculos`, `/vehiculos/[id]/mantenimiento` | admin | ❌ Incompleto | Sidebar solo enlaza a Rutas y Vehículos. Faltan Planificación semanal y Monitor GPS. |
| Tesorería | `/tesoreria` | `/cajas`, `/movimientos`, `/cierre-caja`, `/tesoro`, `/gastos`, `/validar-rutas` | admin | ⚠️ Parcial | No existen accesos a Validar rutas ni al módulo Tesoro. Cierre de caja aparece pero sin agrupación clara. |
| Reportes | `/reportes` | — | admin | ✅ | Item presente, sin subrutas. |

Conclusiones:

1. **Reparto** es el módulo con más brechas: faltan Planificación semanal y Monitor GPS dentro del menú, lo que impide llegar al plan semanal directamente.
2. **Tesorería** requiere exponer Validación de rutas (paso crítico del flujo) y el submódulo Tesoro/Resumen, además de ordenar Cajas, Movimientos, Gastos y Cierres.
3. **Almacén** agradecería un acceso visible a Recepción (ingresos) o a los pesajes diarios si se desea cubrir el flujo completo.

## Propuesta de navegación objetivo

| Grupo | Item | Subitems | Roles | Icono sugerido |
| --- | --- | --- | --- | --- |
| General | Dashboard (`/dashboard`) | — | admin, vendedor, almacenista | `LayoutDashboard` |
| Almacén | Almacén (`/almacen`) | Productos, Lotes, Presupuestos del día, Recepción | admin, almacenista | `Package` |
| Ventas | Ventas (`/ventas`) | Presupuestos, Pedidos, Clientes | admin, vendedor | `ShoppingCart` |
| Reparto | Reparto (`/reparto`) | Planificación semanal, Rutas, Monitor GPS, Vehículos | admin | `Truck` (padre), `CalendarDays`, `Route`, `Radar`, `Bus` (hijos) |
| Tesorería | Tesorería (`/tesoreria`) | Cajas, Movimientos, Cierre de caja, Validar rutas, Tesoro, Gastos | admin | `DollarSign` (padre), `Wallet`, `ArrowLeftRight`, `ShieldCheck`, `Building`, `Receipt` |
| Reportes | Reportes (`/reportes`) | — | admin | `FileText` |

Notas:

- Reparto agrupa todo el flujo logístico: Planificación semanal (plan semanal), Monitor en vivo y gestión de rutas/vehículos.
- Tesorería incluye la validación de rutas (paso financiero) y el dashboard Tesoro, manteniendo Cajas/Movimientos/Gastos juntos.
- Se mantienen los roles actuales pero se documenta explícitamente qué submenús comparten el mismo check para simplificar lógica.

Esta tabla será la guía para reconfigurar `AdminSidebar`.
Se utilizará esta tabla como referencia para ajustar `AdminSidebar`.

