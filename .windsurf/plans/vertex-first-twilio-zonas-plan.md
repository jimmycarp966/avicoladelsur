# Plan: Vertex-first + Twilio-only + Unificar zonas (Valles → Tafi del valle)

Este plan ajusta el bot para operar Twilio-only, unifica la zona duplicada "Valles" con "Tafi del valle" en Supabase sin romper referencias, y refactoriza el webhook a un enfoque Vertex-first (opción 1) con técnicas de venta controladas.

## Contexto / Hallazgos
- En DB existen 2 zonas activas: `Tafi del valle` y `Valles`.
- La tabla `localidades` está vacía; por eso `fn_obtener_localidades_activas()` devolvía vacío.
- Ya hay referencias a la zona "Valles" en `plan_rutas_semanal` (156 registros). En otras tablas con `zona_id` no se detectaron referencias (según conteos actuales), pero se verificará antes de mutar.
- En `clientes.zona_entrega` hay muchos registros `TAFI DEL VALLE` y otros; no hay `VALLES` exacto, pero se revisará si hay variantes.
- Verificado: la RPC `fn_asignar_pedido_a_ruta(uuid)` **no usa** `plan_rutas_semanal`; asigna/crea rutas por `zona_id + fecha_ruta + turno`, elige `vehiculo` y `repartidor` según disponibilidad/capacidad.

## Uso actual de “Planificación Semanal” en el frontend
- Se usa activamente en el módulo Admin de Reparto:
  - `src/app/(admin)/(dominios)/reparto/planificacion/semana/page.tsx` (lee `plan_rutas_semanal` y `zonas`)
  - `src/app/(admin)/(dominios)/reparto/planificacion/semana/calendario-semanal.tsx` (UI de grilla semana/turno)
  - `src/app/(admin)/(dominios)/reparto/planificacion/historial/page.tsx` (historial + lectura de `plan_rutas_semanal`)
- Lógica server (actions) asociada:
  - `src/actions/plan-rutas.actions.ts` (creación/eliminación/validación de plan semanal sobre `plan_rutas_semanal`)
- Alcance real en operaciones:
  - En el flujo de pedidos/rutas (Almacén → “Asignar a ruta” / “Generar automática”), se usa la RPC `fn_asignar_pedido_a_ruta` y **no depende** del plan semanal.
  - El plan semanal se usa en el módulo de planificación (UI) y aparece como fallback en flujos específicos (p.ej. transferencias) donde se requiere `vehiculo_id/repartidor_id`.

## Objetivos
1. **Twilio-only**: forzar que el bot use Twilio como proveedor de WhatsApp (sin botones/listas de Meta).
2. **Unificar Zonas**: que la única zona para ese caso quede como **"Tafi del valle"**.
3. **Vertex-first (opción 1)**: Vertex maneja la conversación; se conserva un mínimo hardcodeado de “pegamento” (webhook + compatibilidad + fallbacks).
4. **Técnicas de venta**: agregar upsell/cross-sell/bundles de forma no invasiva y sin alucinar stock/precios.

## Alcance de cambios (alto nivel)
### A) Twilio-only
- Configuración en Vercel:
  - Setear `WHATSAPP_PROVIDER=twilio`.
  - (Opcional) Setear `WHATSAPP_ENABLE_BUTTONS=false`.
  - (Recomendado) Remover variables `WHATSAPP_META_*` si existen para evitar auto-detección.
- Ajuste en código:
  - Asegurar que `getWhatsAppProvider()` respete `WHATSAPP_PROVIDER=twilio` y que `isWhatsAppMetaAvailable()` no habilite botones si proveedor != meta.
  - Validar que `sendBotResponse()` use Twilio en todos los casos.

### B) Unificar zona "Valles" → "Tafi del valle"
- Estrategia segura (sin perder integridad):
  1. Identificar `zona_id` de ambas zonas.
  2. Actualizar todas las FK (`zona_id`) que apunten a `Valles` para que apunten a `Tafi del valle`.
     - Incluye: `plan_rutas_semanal` (confirmado), y cualquier otra tabla con FK a `zonas`.
  3. Normalizar `clientes.zona_entrega` si hubiese valores textuales tipo "Valles" (o variantes) → "TAFI DEL VALLE".
  4. Finalmente:
     - Si no quedan referencias post-migración: borrar la fila `Valles`.
     - Si quedaran referencias inesperadas (FK): no borrar, dejar `activo=false` y revisar manualmente.
- Implementación: vía migración SQL en Supabase (`apply_migration`) para que quede auditable y reproducible.

### C) Vertex-first (opción 1)
- Mantener hardcode mínimo:
  - Parseo de webhooks Twilio.
  - Control de spam/timeouts y errores.
  - (Opcional) comandos técnicos: `cancelar`, `reiniciar`.
- Delegar a Vertex la parte conversacional:
  - Mensajes “hola/menu/ayuda/productos/deuda/estado” pasan por Vertex y se mantiene un fallback básico solo si Vertex falla.
  - El flujo de alta (nombre/dirección/zona) puede quedarse hardcodeado inicialmente (por seguridad), pero se prepara el camino para moverlo a tools.

### D) Técnicas de venta (sin ser invasivo)
- Ajustar `system-prompt` del agente:
  - Incluir reglas de venta consultiva: preguntar uso, recomendar combos, sugerir complementos.
  - No inventar stock/precios: si necesita stock/precio, usar tools.
  - Respetar negativa del cliente (“no gracias”) y no insistir.
  - Priorizar claridad operativa: confirmar cantidades/unidades/fecha/turno.

## Verificación / Pruebas
- **Local**:
  - `npm run build`
  - `npm run dev` + `npm run test:bot:webhook`
  - Probar alta de cliente y selección de zona.
- **Vercel + Twilio**:
  - Verificar webhook responde y que no intenta usar Meta.
  - Probar conversaciones: presupuesto, saldo, reclamo.
- **DB**:
  - Query post-migración: no quedan referencias a `zonas.id` de "Valles".
  - `Valles` queda inactiva o eliminada (según decisión).

## Riesgos y mitigaciones
- **Riesgo**: unificar zonas puede afectar planificación histórica.
  - Mitigación: migración actualiza FK de forma consistente; preferir `activo=false` en lugar de borrar.
- **Riesgo**: “solo Vertex” sin herramientas podría alucinar.
  - Mitigación: Vertex-first (opción 1) mantiene guardrails y tools para operaciones.

## Decisiones confirmadas
1. Si luego de migrar no quedan referencias a `Valles`, se **borra** `Valles`.
2. "Valles" y "Tafi del valle" son **100% lo mismo** (misma logística).
