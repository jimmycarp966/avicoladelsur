-- ========================================================================
-- Habilitar Supabase Realtime para cobros en tiempo real
-- Tabla: detalles_ruta (para ver pagos registrados por repartidores)
-- ========================================================================

-- Habilitar Realtime en detalles_ruta
ALTER PUBLICATION supabase_realtime ADD TABLE detalles_ruta;

-- Habilitar Realtime en rutas_reparto (para ver cuando se completa una ruta)
ALTER PUBLICATION supabase_realtime ADD TABLE rutas_reparto;

-- Nota: Si las tablas ya están en la publicación, estos comandos pueden dar error.
-- En ese caso, se pueden ignorar.

COMMENT ON TABLE detalles_ruta IS 'Contiene los detalles de cada entrega en una ruta. Tiene Realtime habilitado para sincronización de pagos.';
