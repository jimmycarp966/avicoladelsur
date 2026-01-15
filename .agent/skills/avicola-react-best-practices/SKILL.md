---
name: avicola-react-best-practices
description: React and Next.js 16 performance optimization for Avícola del Sur ERP. Server Components, Server Actions, shadcn/ui, Tailwind CSS, Zustand, React Hook Form, Zod, TanStack Table. Use when writing, reviewing, or refactoring React/Next.js code for the ERP system.
---

# Avícola del Sur - React Best Practices

Performance optimization guide for React 19 and Next.js 16 in the Avícola del Sur ERP system.

## Stack Específico

- **Framework**: Next.js 16 (App Router, Server Actions)
- **Frontend**: React 19, TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **Estado**: Zustand (mínimo: sesión, notificaciones)
- **Formularios**: React Hook Form + Zod
- **Tablas**: TanStack Table
- **Backend**: Server Actions + Supabase

## When to Apply

Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing Server Actions
- Working with shadcn/ui components
- Optimizing performance of Monitor GPS, NavigationView
- Refactoring existing React/Next.js code

## Core Principles

### 1. Server Components First

```typescript
// ✅ Server Component (default)
export default async function PedidosPage() {
  const pedidos = await getPedidos(); // Server-side data fetching
  return <PedidosTable pedidos={pedidos} />;
}

// ❌ Client Component (only when needed)
'use client';
export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  useEffect(() => {
    fetch('/api/pedidos').then(r => r.json()).then(setPedidos);
  }, []);
  return <PedidosTable pedidos={pedidos} />;
}
```

### 2. Server Actions for Mutations

```typescript
// ✅ Server Action
'use server';
export async function crearPresupuesto(formData: FormData) {
  const validated = crearPresupuestoSchema.parse(formData);
  const result = await supabase.rpc('fn_crear_presupuesto', validated);
  revalidatePath('/almacen/presupuestos');
  return result;
}

// ❌ API Route (avoid)
export async function POST(req: Request) {
  const body = await req.json();
  const result = await supabase.rpc('fn_crear_presupuesto', body);
  return Response.json(result);
}
```

### 3. Lazy Load Heavy Components

```typescript
// ✅ Lazy load MonitorMap
const MonitorMap = dynamic(() => import('@/components/reparto/MonitorMap'), {
  loading: () => <MapSkeleton />,
  ssr: false // Google Maps only client-side
});

// ✅ Lazy load NavigationView
const NavigationView = dynamic(() => import('@/components/reparto/NavigationView'), {
  loading: () => <NavigationSkeleton />,
  ssr: false
});
```

### 4. Suspense for Data Fetching

```typescript
// ✅ Suspense boundary
export default async function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const [pedidos, rutas] = await Promise.all([
    getPedidosHoy(),
    getRutasActivas()
  ]);
  return <Dashboard pedidos={pedidos} rutas={rutas} />;
}
```

### 5. Zustand for Minimal Global State

```typescript
// ✅ Zustand store (solo sesión y notificaciones)
interface AppState {
  user: User | null;
  notifications: Notification[];
  setUser: (user: User | null) => void;
  addNotification: (notification: Notification) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  notifications: [],
  setUser: (user) => set({ user }),
  addNotification: (notification) =>
    set((state) => ({ notifications: [...state.notifications, notification] }))
}));

// ❌ No usar Zustand para datos de negocio
// ❌ Los datos de negocio deben venir de Server Actions
```

### 6. React Hook Form + Zod

```typescript
// ✅ Formulario con validación
const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid(),
  items: z.array(z.object({
    producto_id: z.string().uuid(),
    cantidad: z.number().min(0.1)
  }))
});

export function CrearPresupuestoForm() {
  const form = useForm<CrearPresupuestoInput>({
    resolver: zodResolver(crearPresupuestoSchema)
  });

  const onSubmit = async (data: CrearPresupuestoInput) => {
    await crearPresupuestoAction(data);
  };

  return <Form {...form} onSubmit={form.handleSubmit(onSubmit)} />;
}
```

### 7. TanStack Table for Lists

```typescript
// ✅ TanStack Table con paginación
export function PedidosTable({ pedidos }: { pedidos: Pedido[] }) {
  const table = useReactTable({
    data: pedidos,
    columns: pedidosColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <TableHead key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map(cell => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

## Performance Optimization

### Eliminating Waterfalls

```typescript
// ❌ Waterfall (sequencial)
export default async function Page() {
  const pedidos = await getPedidos();
  const clientes = await getClientes(); // Espera a getPedidos
  return <Dashboard pedidos={pedidos} clientes={clientes} />;
}

// ✅ Parallel (Promise.all)
export default async function Page() {
  const [pedidos, clientes] = await Promise.all([
    getPedidos(),
    getClientes()
  ]);
  return <Dashboard pedidos={pedidos} clientes={clientes} />;
}
```

### Re-render Optimization

```typescript
// ✅ useCallback para handlers pasados a hijos
export function PedidoCard({ pedido, onActualizar }: PedidoCardProps) {
  const handleActualizar = useCallback(() => {
    onActualizar(pedido.id);
  }, [pedido.id, onActualizar]);

  return <button onClick={handleActualizar}>Actualizar</button>;
}

// ✅ useMemo para cálculos costosos
export function PedidosResumen({ pedidos }: { pedidos: Pedido[] }) {
  const total = useMemo(() =>
    pedidos.reduce((sum, p) => sum + p.total, 0),
    [pedidos]
  );

  return <div>Total: ${total}</div>;
}
```

### Bundle Size Optimization

```typescript
// ✅ Dynamic imports para componentes pesados
const MonitorMap = dynamic(() => import('@/components/reparto/MonitorMap'), {
  loading: () => <MapSkeleton />,
  ssr: false
});

// ✅ Importaciones directas, no barrel files
import { Button } from '@/components/ui/button'; // ✅
// import { Button, Input, Card } from '@/components/ui'; // ❌
```

## Server Actions Best Practices

### Validation First

```typescript
'use server';
export async function crearPresupuesto(formData: FormData) {
  // 1. Validar entrada
  const validated = crearPresupuestoSchema.parse(formData);

  // 2. Verificar stock FIFO
  const stockDisponible = await verificarStockFIFO(validated.items);
  if (!stockDisponible) {
    throw new Error('Stock insuficiente');
  }

  // 3. Ejecutar RPC atómica
  const result = await supabase.rpc('fn_crear_presupuesto', validated);

  // 4. Revalidar caché
  revalidatePath('/almacen/presupuestos');
  revalidatePath('/ventas/presupuestos');

  return result;
}
```

### Error Handling

```typescript
'use server';
export async function crearPresupuesto(formData: FormData) {
  try {
    const validated = crearPresupuestoSchema.parse(formData);
    const result = await supabase.rpc('fn_crear_presupuesto', validated);
    revalidatePath('/almacen/presupuestos');
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Validación fallida', details: error.errors };
    }
    console.error('Error al crear presupuesto:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}
```

## Component Patterns

### shadcn/ui Components

```typescript
// ✅ Usar componentes shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PedidoForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo Pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Buscar cliente..." />
        <Button>Crear Pedido</Button>
      </CardContent>
    </Card>
  );
}
```

### Tailwind CSS Styling

```typescript
// ✅ Estilos con Tailwind CSS
export function PedidoCard({ pedido }: { pedido: Pedido }) {
  return (
    <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-semibold text-lg">{pedido.numero_pedido}</h3>
      <p className="text-sm text-gray-600">{pedido.cliente.nombre}</p>
      <p className="text-lg font-bold text-green-600">${pedido.total}</p>
    </div>
  );
}
```

## Module-Specific Guidelines

### Monitor GPS

```typescript
// ✅ Server Component para datos
export default async function MonitorPage() {
  const rutas = await getRutasActivas();
  return <MonitorContent rutas={rutas} />;
}

// ✅ Client Component para Google Maps
'use client';
export function MonitorContent({ rutas }: { rutas: Ruta[] }) {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <MonitorMap rutas={rutas} />
    </Suspense>
  );
}
```

### NavigationView

```typescript
// ✅ Client Component para navegación
'use client';
export function NavigationView({ ruta }: { ruta: Ruta }) {
  const [instrucciones, setInstrucciones] = useState<Instruccion[]>([]);

  useEffect(() => {
    cargarInstrucciones(ruta).then(setInstrucciones);
  }, [ruta]);

  return <NavigationUI instrucciones={instrucciones} />;
}
```

## Anti-Patterns to Avoid

❌ Client Components cuando Server Components funcionan
❌ API Routes cuando Server Actions son suficientes
❌ Zustand para datos de negocio (usar Server Actions)
❌ useEffect para data fetching (usar Server Components)
❌ Prop drilling (usar Server Actions o Zustand mínimo)
❌ Direct Supabase client en componentes (usar Server Actions)

## Quick Reference

| Need | Pattern |
|------|---------|
| Data fetching | Server Component + async/await |
| Mutations | Server Action + revalidatePath |
| Global state | Zustand (solo sesión, notificaciones) |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| UI components | shadcn/ui + Tailwind CSS |
| Heavy components | dynamic() + Suspense |
| Performance | Promise.all, useMemo, useCallback |

## Related Skills

- **erp-produccion-stock** - FIFO patterns
- **erp-reparto** - GPS tracking patterns
- **erp-tesoreria** - Conciliación patterns
- **systematic-debugging** - Debugging Server Actions
