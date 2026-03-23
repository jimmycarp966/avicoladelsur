-- Fix: asegurar que append_bot_session_message agregue un elemento al JSON array
CREATE OR REPLACE FUNCTION append_bot_session_message(
  p_session_id VARCHAR,
  p_message JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE bot_sessions
  SET messages = COALESCE(messages, '[]'::jsonb) || jsonb_build_array(p_message),
      updated_at = NOW()
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;
;
