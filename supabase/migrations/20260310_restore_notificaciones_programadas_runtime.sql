-- ===========================================
-- MIGRACION: Restaurar runtime de notificaciones programadas
-- Fecha: 2026-03-10
-- Objetivo: crear el esquema minimo que el cron y recordatorios esperan
-- en produccion (tablas + RPCs + RLS + recarga de schema cache).
-- ===========================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cliente_preferencias_notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo varchar(50) NOT NULL,
  habilitado boolean NOT NULL DEFAULT true,
  frecuencia_maxima integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_cliente_tipo UNIQUE (cliente_id, tipo),
  CONSTRAINT chk_tipo_notificacion CHECK (
    tipo IN ('estado_pedido', 'recordatorio_compra', 'promocion', 'entrega_cercana', 'alerta_pago')
  ),
  CONSTRAINT chk_frecuencia_maxima CHECK (frecuencia_maxima >= 1 AND frecuencia_maxima <= 10)
);

CREATE TABLE IF NOT EXISTS public.notificaciones_programadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo varchar(50) NOT NULL,
  mensaje text NOT NULL,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  programada_para timestamptz NOT NULL,
  enviada boolean NOT NULL DEFAULT false,
  enviada_at timestamptz,
  error_envio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_tipo_notificacion_prog CHECK (
    tipo IN ('estado_pedido', 'recordatorio_compra', 'promocion', 'entrega_cercana', 'alerta_pago')
  )
);

CREATE INDEX IF NOT EXISTS idx_cliente_preferencias_cliente
  ON public.cliente_preferencias_notificaciones(cliente_id);

CREATE INDEX IF NOT EXISTS idx_notificaciones_programadas_cliente
  ON public.notificaciones_programadas(cliente_id);

CREATE INDEX IF NOT EXISTS idx_notificaciones_programadas_pendientes
  ON public.notificaciones_programadas(enviada, programada_para)
  WHERE enviada = false;

CREATE OR REPLACE FUNCTION public.upsert_cliente_preferencia_notificacion(
  p_cliente_id uuid,
  p_tipo varchar(50),
  p_habilitado boolean DEFAULT true,
  p_frecuencia_maxima integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preferencia public.cliente_preferencias_notificaciones;
BEGIN
  IF p_tipo NOT IN ('estado_pedido', 'recordatorio_compra', 'promocion', 'entrega_cercana', 'alerta_pago') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de notificacion invalido');
  END IF;

  INSERT INTO public.cliente_preferencias_notificaciones (
    cliente_id,
    tipo,
    habilitado,
    frecuencia_maxima,
    updated_at
  )
  VALUES (
    p_cliente_id,
    p_tipo,
    p_habilitado,
    p_frecuencia_maxima,
    now()
  )
  ON CONFLICT (cliente_id, tipo)
  DO UPDATE SET
    habilitado = EXCLUDED.habilitado,
    frecuencia_maxima = EXCLUDED.frecuencia_maxima,
    updated_at = now()
  RETURNING * INTO v_preferencia;

  RETURN jsonb_build_object('success', true, 'preferencia', row_to_json(v_preferencia));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cliente_preferencias_notificaciones(
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preferencias jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(cp)), '[]'::jsonb)
  INTO v_preferencias
  FROM public.cliente_preferencias_notificaciones cp
  WHERE cp.cliente_id = p_cliente_id;

  RETURN jsonb_build_object('success', true, 'preferencias', v_preferencias);
END;
$$;

CREATE OR REPLACE FUNCTION public.programar_notificacion(
  p_cliente_id uuid,
  p_tipo varchar(50),
  p_mensaje text,
  p_datos jsonb DEFAULT '{}'::jsonb,
  p_programada_para timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_habilitado boolean := true;
  v_frecuencia integer := 3;
  v_notificacion public.notificaciones_programadas;
  v_programada timestamptz := COALESCE(p_programada_para, now());
BEGIN
  IF p_tipo NOT IN ('estado_pedido', 'recordatorio_compra', 'promocion', 'entrega_cercana', 'alerta_pago') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de notificacion invalido');
  END IF;

  SELECT habilitado, frecuencia_maxima
  INTO v_habilitado, v_frecuencia
  FROM public.cliente_preferencias_notificaciones
  WHERE cliente_id = p_cliente_id
    AND tipo = p_tipo;

  IF FOUND AND NOT v_habilitado THEN
    RETURN jsonb_build_object('success', false, 'error', 'Notificacion deshabilitada para este cliente');
  END IF;

  IF EXTRACT(HOUR FROM v_programada) < 8 THEN
    v_programada := date_trunc('day', v_programada) + interval '8 hours';
  ELSIF EXTRACT(HOUR FROM v_programada) >= 20 THEN
    v_programada := date_trunc('day', v_programada) + interval '1 day 8 hours';
  END IF;

  INSERT INTO public.notificaciones_programadas (
    cliente_id,
    tipo,
    mensaje,
    datos,
    programada_para
  )
  VALUES (
    p_cliente_id,
    p_tipo,
    p_mensaje,
    p_datos,
    v_programada
  )
  RETURNING * INTO v_notificacion;

  RETURN jsonb_build_object(
    'success', true,
    'notificacion', row_to_json(v_notificacion),
    'ajustada_a_horario', v_programada != COALESCE(p_programada_para, now()),
    'frecuencia_maxima', v_frecuencia
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_notificaciones_pendientes(
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notificaciones jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_notificaciones
  FROM (
    SELECT *
    FROM public.notificaciones_programadas
    WHERE enviada = false
      AND programada_para <= now()
    ORDER BY programada_para ASC
    LIMIT p_limit
  ) AS t;

  RETURN jsonb_build_object(
    'success', true,
    'notificaciones', v_notificaciones,
    'total', COALESCE(jsonb_array_length(v_notificaciones), 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_notificacion_enviada(
  p_notificacion_id uuid,
  p_enviada boolean DEFAULT true,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notificacion public.notificaciones_programadas;
BEGIN
  UPDATE public.notificaciones_programadas
  SET
    enviada = p_enviada,
    enviada_at = CASE WHEN p_enviada THEN now() ELSE NULL END,
    error_envio = p_error,
    updated_at = now()
  WHERE id = p_notificacion_id
  RETURNING * INTO v_notificacion;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Notificacion no encontrada');
  END IF;

  RETURN jsonb_build_object('success', true, 'notificacion', row_to_json(v_notificacion));
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_historial_notificaciones(
  p_cliente_id uuid,
  p_dias integer DEFAULT 30,
  p_tipo varchar(50) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_historial jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_historial
  FROM (
    SELECT *
    FROM public.notificaciones_programadas
    WHERE cliente_id = p_cliente_id
      AND created_at >= now() - (p_dias || ' days')::interval
      AND (p_tipo IS NULL OR tipo = p_tipo)
    ORDER BY created_at DESC
  ) AS t;

  RETURN jsonb_build_object(
    'success', true,
    'historial', v_historial,
    'total', COALESCE(jsonb_array_length(v_historial), 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.contar_notificaciones_hoy(
  p_cliente_id uuid,
  p_tipo varchar(50)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
  INTO v_count
  FROM public.notificaciones_programadas
  WHERE cliente_id = p_cliente_id
    AND tipo = p_tipo
    AND date(coalesce(enviada_at, created_at)) = current_date;

  RETURN jsonb_build_object('success', true, 'count', v_count, 'tipo', p_tipo);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_notificaciones_antiguas(
  p_dias integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.notificaciones_programadas
  WHERE enviada = true
    AND created_at < now() - (p_dias || ' days')::interval;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'message', format('Se eliminaron %s notificaciones antiguas', v_deleted_count)
  );
END;
$$;

ALTER TABLE public.cliente_preferencias_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones_programadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cliente_preferencias_select_policy ON public.cliente_preferencias_notificaciones;
DROP POLICY IF EXISTS cliente_preferencias_insert_policy ON public.cliente_preferencias_notificaciones;
DROP POLICY IF EXISTS cliente_preferencias_update_policy ON public.cliente_preferencias_notificaciones;
DROP POLICY IF EXISTS cliente_preferencias_delete_policy ON public.cliente_preferencias_notificaciones;

CREATE POLICY cliente_preferencias_select_policy
  ON public.cliente_preferencias_notificaciones
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY cliente_preferencias_insert_policy
  ON public.cliente_preferencias_notificaciones
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY cliente_preferencias_update_policy
  ON public.cliente_preferencias_notificaciones
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY cliente_preferencias_delete_policy
  ON public.cliente_preferencias_notificaciones
  FOR DELETE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS notificaciones_programadas_select_policy ON public.notificaciones_programadas;
DROP POLICY IF EXISTS notificaciones_programadas_insert_policy ON public.notificaciones_programadas;
DROP POLICY IF EXISTS notificaciones_programadas_update_policy ON public.notificaciones_programadas;
DROP POLICY IF EXISTS notificaciones_programadas_delete_policy ON public.notificaciones_programadas;

CREATE POLICY notificaciones_programadas_select_policy
  ON public.notificaciones_programadas
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY notificaciones_programadas_insert_policy
  ON public.notificaciones_programadas
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY notificaciones_programadas_update_policy
  ON public.notificaciones_programadas
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY notificaciones_programadas_delete_policy
  ON public.notificaciones_programadas
  FOR DELETE
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';

COMMIT;
