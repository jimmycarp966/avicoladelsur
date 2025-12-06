# ⌨️ Atajos de Teclado - Sistema Avícola del Sur

Este documento describe todos los atajos de teclado disponibles en el sistema para mejorar la productividad y velocidad de operación.

## 🚀 Navegación Rápida (Teclas de Función)

| Tecla | Acción | Descripción |
|-------|--------|-------------|
| **F1** | Dashboard | Ir al panel principal |
| **F2** | Productos | Ir a la gestión de productos |
| **F3** | Clientes | Ir a la gestión de clientes |
| **F4** | Presupuestos | Ir a la gestión de presupuestos |
| **F5** | Pedidos | Ir a la gestión de pedidos |
| **F6** | Rutas | Ir a la gestión de rutas |
| **F7** | Monitor GPS | Ir al monitor GPS en tiempo real |
| **F8** | Tesorería | Ir a la gestión de tesorería |
| **F9** | Lotes | Ir a la gestión de lotes |
| **F10** | Planificación | Ir a la planificación semanal de rutas |
| **F11** | Listas de Precios | Ir a la gestión de listas de precios |
| **F12** | Ayuda | Mostrar esta ayuda de atajos |

## 📝 Acciones Comunes

| Atajo | Acción | Descripción |
|-------|--------|-------------|
| **Ctrl + H** | Dashboard | Ir al dashboard principal |
| **Ctrl + Shift + N** | Crear Nuevo | Crear nuevo elemento según el contexto actual (cliente, producto, presupuesto, etc.) |
| **Ctrl + S** | Guardar | Guardar formulario actual (funciona en todos los formularios) |
| **Ctrl + Enter** | Enviar | Enviar formulario actual |
| **Esc** | Volver | Volver atrás o cerrar modal |

## 🔍 Atajos Contextuales en Formularios

Los atajos contextuales varían según el formulario en el que te encuentres. Cada campo importante tiene un atajo mnemotécnico basado en su primera letra.

### 📋 Formulario de Presupuesto

| Atajo | Acción | Descripción |
|-------|--------|-------------|
| **C** | Cliente | Enfocar campo de búsqueda de cliente |
| **P** | Producto | Enfocar primer campo de producto disponible |
| **A** | Agregar | Agregar nuevo producto al presupuesto |
| **L** | Lista de Precios | Enfocar selector de lista de precios |
| **F** | Fecha | Enfocar campo de fecha de entrega |
| **Z** | Zona | Enfocar selector de zona de entrega |
| **O** | Observaciones | Enfocar campo de observaciones |
| **Ctrl+S** | Guardar | Guardar presupuesto |

### 👤 Formulario de Cliente

| Atajo | Acción | Descripción |
|-------|--------|-------------|
| **C** | Código | Enfocar campo de código |
| **N** | Nombre | Enfocar campo de nombre |
| **T** | Teléfono | Enfocar campo de teléfono |
| **W** | WhatsApp | Enfocar campo de WhatsApp |
| **E** | Email | Enfocar campo de email |
| **D** | Dirección | Enfocar campo de dirección |
| **Z** | Zona | Enfocar selector de zona de entrega |
| **Ctrl+S** | Guardar | Guardar cliente |

### 📦 Formulario de Producto

| Atajo | Acción | Descripción |
|-------|--------|-------------|
| **C** | Código | Enfocar campo de código |
| **N** | Nombre | Enfocar campo de nombre |
| **D** | Descripción | Enfocar campo de descripción |
| **G** | Categoría | Enfocar campo de categoría |
| **V** | Precio Venta | Enfocar campo de precio de venta |
| **O** | Precio Costo | Enfocar campo de precio de costo |
| **U** | Unidad | Enfocar selector de unidad de medida |
| **S** | Stock Mínimo | Enfocar campo de stock mínimo |
| **Ctrl+S** | Guardar | Guardar producto |

> **Nota**: Los atajos de letras individuales (como "C" o "P") solo funcionan cuando NO estás escribiendo en un campo de texto. Si estás escribiendo, simplemente escribe normalmente. Los hints visuales junto a cada campo muestran el atajo disponible.

## 📊 Atajos en Tablas

| Atajo | Acción | Descripción |
|-------|--------|-------------|
| **Ctrl + F** | Buscar | Activar búsqueda en tabla |
| **Enter** | Seleccionar | Seleccionar fila actual |
| **Delete** | Eliminar | Eliminar elemento seleccionado |
| **Tab** | Navegar | Navegar entre elementos de la tabla (filas, botones, menús) |
| **↑↓** | Navegar Menú | Navegar entre opciones en menús dropdown (cuando está abierto) |
| **Enter** | Activar | Activar elemento seleccionado en menú dropdown |

## 💡 Consejos de Uso

1. **Presiona F12** en cualquier momento para ver la ayuda de atajos
2. Los atajos funcionan globalmente en todo el sistema
3. Los atajos de formulario (Ctrl+S, Ctrl+Enter) funcionan incluso cuando estás escribiendo en un campo
4. El botón de ayuda (ícono de interrogación) en el header también abre la ayuda de atajos

## 🔧 Implementación Técnica

El sistema de atajos está implementado usando:

- **Hook personalizado**: `useKeyboardShortcuts` para manejar eventos de teclado
- **Provider global**: `KeyboardShortcutsProvider` que envuelve toda la aplicación
- **Hooks específicos**:
  - `useNavigationShortcuts`: Atajos de navegación comunes
  - `useFunctionKeyShortcuts`: Atajos de teclas de función (F1-F12)
  - `useFormShortcuts`: Atajos para formularios (Ctrl+S, Ctrl+Enter)
  - `useFormContextShortcuts`: Atajos contextuales por formulario
  - `useTableShortcuts`: Atajos para tablas
  - `useFocusField`: Hook para enfocar campos específicos

## ⌨️ Navegación por Tab

Todos los componentes del sistema son navegables con la tecla **Tab**:

- **Tab**: Avanzar al siguiente elemento interactivo
- **Shift + Tab**: Retroceder al elemento anterior
- **Enter/Space**: Activar elemento seleccionado (botones, selects, etc.)
- **↑↓**: Navegar dentro de menús dropdown cuando están abiertos
- **Esc**: Cerrar menús y modales

### Componentes Mejorados

- ✅ **Select**: Navegable con Tab, se abre con Enter/Space
- ✅ **DropdownMenu**: Navegación con flechas y Tab
- ✅ **DataTable**: Navegación mejorada en filas y acciones
- ✅ **Formularios**: Todos los campos son navegables con Tab en orden lógico

## 📌 Notas Importantes

- Los atajos se desactivan automáticamente cuando estás escribiendo en campos de texto, excepto Ctrl+S y Ctrl+Enter
- Los atajos funcionan en todas las páginas del sistema administrativo
- La ayuda de atajos se puede abrir desde el botón de ayuda en el header o presionando F12

