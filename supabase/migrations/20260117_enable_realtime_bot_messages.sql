-- Habilitar Realtime para la tabla bot_messages
-- Esto permite que el dashboard reciba actualizaciones en tiempo real

ALTER PUBLICATION supabase_realtime ADD TABLE bot_messages;
