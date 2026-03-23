-- Migración: Habilitar Realtime para tablas específicas
-- Fecha: 2025-01-01
-- Descripción: Habilita Supabase Realtime para las tablas que requieren actualizaciones en tiempo real

-- IMPORTANTE: Esta migración solo crea las publicaciones necesarias.
-- Las políticas RLS ya deben estar configuradas para permitir las suscripciones según los roles.

-- Habilitar Realtime para ubicaciones de repartidores (GPS tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE ubicaciones_repartidores;

-- Habilitar Realtime para presupuestos (vista de almacén)
ALTER PUBLICATION supabase_realtime ADD TABLE presupuestos;

-- Habilitar Realtime para items de presupuestos (pesaje)
ALTER PUBLICATION supabase_realtime ADD TABLE presupuesto_items;

-- Habilitar Realtime para pedidos (dashboard y listas)
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;

-- Habilitar Realtime para entregas (estado de rutas)
ALTER PUBLICATION supabase_realtime ADD TABLE entregas;

-- Habilitar Realtime para rutas de reparto (estado de rutas)
ALTER PUBLICATION supabase_realtime ADD TABLE rutas_reparto;

-- Habilitar Realtime para detalles de ruta (progreso de entregas)
ALTER PUBLICATION supabase_realtime ADD TABLE detalles_ruta;

-- Habilitar Realtime para alertas de stock (notificaciones)
ALTER PUBLICATION supabase_realtime ADD TABLE alertas_stock;

-- Habilitar Realtime para movimientos de tesorería (caja en tiempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE tesoreria_movimientos;

-- Habilitar Realtime para cajas de tesorería (saldo actualizado)
ALTER PUBLICATION supabase_realtime ADD TABLE tesoreria_cajas;

-- Habilitar Realtime para transferencias entre sucursales (estado en tiempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE transferencias_stock;

-- Nota: La tabla 'notificaciones' ya debería estar habilitada si NotificationBell funciona correctamente
-- Si no está habilitada, ejecutar:
-- ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;

-- Verificar que las publicaciones se crearon correctamente
-- SELECT schemaname, tablename 
-- FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime' 
-- ORDER BY tablename;

