const CENTRAL_SUCURSAL_ID = "00000000-0000-0000-0000-000000000001";
const ESTADOS_SOLICITUD_ABIERTA = ["solicitud_automatica", "pendiente"] as const;

type SupabaseLikeClient = {
  from: (table: string) => any;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

export interface ResultadoSyncStockBajo {
  success: boolean;
  sucursal_id: string;
  total_solicitudes: number;
  total_solicitudes_actualizadas: number;
  total_alertas: number;
  total_sin_cambios: number;
  resultados: Array<Record<string, unknown>>;
}

function calcularCantidadSugerida(stockMinimo: number, stockActual: number, stockOrigen: number) {
  const sugeridaBase = Math.max(stockMinimo - stockActual + stockMinimo * 0.5, 1);
  if (stockOrigen <= 0) return sugeridaBase;
  return Math.max(1, Math.min(sugeridaBase, stockOrigen));
}

async function obtenerStockTotalProducto(
  supabase: SupabaseLikeClient,
  sucursalId: string,
  productoId: string,
) {
  const { data, error } = await supabase
    .from("lotes")
    .select("cantidad_disponible")
    .eq("sucursal_id", sucursalId)
    .eq("producto_id", productoId)
    .eq("estado", "disponible");

  if (error) throw error;

  return (data || []).reduce(
    (total: number, lote: { cantidad_disponible?: number }) =>
      total + Number(lote?.cantidad_disponible || 0),
    0,
  );
}

async function obtenerStockMinimoProductoSucursal(
  supabase: SupabaseLikeClient,
  sucursalId: string,
  productoId: string,
) {
  const { data, error } = await supabase.rpc("fn_obtener_stock_minimo_producto_sucursal", {
    p_producto_id: productoId,
    p_sucursal_id: sucursalId,
  });

  if (error) throw error;
  return Number(data || 0);
}

async function obtenerProductosAChequear(
  supabase: SupabaseLikeClient,
  sucursalId: string,
  productoId?: string,
) {
  if (productoId) return [productoId];

  const [minimosResult, lotesResult] = await Promise.all([
    supabase
      .from("producto_sucursal_minimos")
      .select("producto_id")
      .eq("sucursal_id", sucursalId),
    supabase
      .from("lotes")
      .select("producto_id")
      .eq("sucursal_id", sucursalId)
      .eq("estado", "disponible"),
  ]);

  if (minimosResult.error) throw minimosResult.error;
  if (lotesResult.error) throw lotesResult.error;

  const productos = new Set<string>();

  for (const row of minimosResult.data || []) {
    if (row?.producto_id) productos.add(row.producto_id);
  }

  for (const row of lotesResult.data || []) {
    if (row?.producto_id) productos.add(row.producto_id);
  }

  return Array.from(productos);
}

export async function sincronizarSolicitudesAutomaticasStockBajo(
  supabase: SupabaseLikeClient,
  sucursalId: string,
  productoId?: string,
): Promise<ResultadoSyncStockBajo> {
  const resultados: Array<Record<string, unknown>> = [];
  let totalSolicitudes = 0;
  let totalSolicitudesActualizadas = 0;
  let totalAlertas = 0;
  let totalSinCambios = 0;

  const productos = await obtenerProductosAChequear(supabase, sucursalId, productoId);

  const { data: transferenciasAbiertas, error: abiertasError } = await supabase
    .from("transferencias_stock")
    .select("id, observaciones, fecha_solicitud")
    .eq("sucursal_destino_id", sucursalId)
    .eq("origen", "automatica")
    .in("estado", [...ESTADOS_SOLICITUD_ABIERTA])
    .order("fecha_solicitud", { ascending: false });

  if (abiertasError) throw abiertasError;

  const transferenciasAbiertasIds = (transferenciasAbiertas || []).map(
    (transferencia: { id: string }) => transferencia.id,
  );

  for (const productoIdActual of productos) {
    try {
      const [stockActual, stockMinimo, stockOrigen] = await Promise.all([
        obtenerStockTotalProducto(supabase, sucursalId, productoIdActual),
        obtenerStockMinimoProductoSucursal(supabase, sucursalId, productoIdActual),
        obtenerStockTotalProducto(supabase, CENTRAL_SUCURSAL_ID, productoIdActual),
      ]);

      if (stockMinimo <= 0) {
        resultados.push({
          producto_id: productoIdActual,
          accion: "sin_cambios",
          motivo: "stock_minimo_no_configurado",
          stock_actual: stockActual,
          stock_minimo: stockMinimo,
        });
        totalSinCambios += 1;
        continue;
      }

      if (stockActual >= stockMinimo) {
        resultados.push({
          producto_id: productoIdActual,
          accion: "sin_cambios",
          motivo: "stock_suficiente",
          stock_actual: stockActual,
          stock_minimo: stockMinimo,
        });
        totalSinCambios += 1;
        continue;
      }

      const cantidadSugerida = calcularCantidadSugerida(stockMinimo, stockActual, stockOrigen);

      let itemAbierto: any = null;
      if (transferenciasAbiertasIds.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from("transferencia_items")
          .select("id, transferencia_id, cantidad_solicitada, cantidad_sugerida, producto_id")
          .eq("producto_id", productoIdActual)
          .in("transferencia_id", transferenciasAbiertasIds)
          .limit(1)
          .maybeSingle();

        if (itemError) throw itemError;
        itemAbierto = itemData || null;
      }

      if (itemAbierto?.id) {
        const { error: updateItemError } = await supabase
          .from("transferencia_items")
          .update({
            cantidad_solicitada: cantidadSugerida,
            cantidad_sugerida: cantidadSugerida,
          })
          .eq("id", itemAbierto.id);

        if (updateItemError) throw updateItemError;

        const transferencia = (transferenciasAbiertas || []).find(
          (t: { id: string }) => t.id === itemAbierto.transferencia_id,
        );
        const observacionesPrevias = transferencia?.observaciones || "";
        const notaSync = `\n[SYNC_STOCK_BAJO] Ajuste automático cantidad sugerida=${cantidadSugerida} (stock ${stockActual}/${stockMinimo})`;

        const { error: updateTransferError } = await supabase
          .from("transferencias_stock")
          .update({
            observaciones: `${observacionesPrevias}${notaSync}`.trim(),
          })
          .eq("id", itemAbierto.transferencia_id);

        if (updateTransferError) throw updateTransferError;

        resultados.push({
          producto_id: productoIdActual,
          accion: "solicitud_actualizada",
          transferencia_id: itemAbierto.transferencia_id,
          cantidad_sugerida: cantidadSugerida,
          stock_actual: stockActual,
          stock_minimo: stockMinimo,
        });
        totalSolicitudesActualizadas += 1;
        continue;
      }

      const { data: crearResult, error: crearError } = await supabase.rpc(
        "fn_crear_solicitud_transferencia_automatica",
        {
          p_sucursal_destino_id: sucursalId,
          p_producto_id: productoIdActual,
          p_cantidad_sugerida: cantidadSugerida,
        },
      );

      if (crearError) throw crearError;

      const accion = crearResult?.accion || "sin_cambios";
      resultados.push({
        producto_id: productoIdActual,
        accion,
        ...crearResult,
      });

      if (accion === "solicitud_creada") {
        totalSolicitudes += 1;
      } else if (accion === "alerta_creada") {
        totalAlertas += 1;
      } else {
        totalSinCambios += 1;
      }
    } catch (error: any) {
      resultados.push({
        producto_id: productoIdActual,
        accion: "error",
        error: error?.message || "Error desconocido",
      });
    }
  }

  return {
    success: true,
    sucursal_id: sucursalId,
    total_solicitudes: totalSolicitudes,
    total_solicitudes_actualizadas: totalSolicitudesActualizadas,
    total_alertas: totalAlertas,
    total_sin_cambios: totalSinCambios,
    resultados,
  };
}

