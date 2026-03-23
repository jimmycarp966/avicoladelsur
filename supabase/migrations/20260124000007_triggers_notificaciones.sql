-- ===========================================
-- MIGRACIÓN: Triggers para Notificaciones Proactivas
-- Fecha: 2026-01-24
-- Descripción: Triggers que programan notificaciones automáticas
--              cuando cambian estados de pedidos, rutas y otros eventos
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: Programar notificación de estado de pedido
-- ===========================================

CREATE OR REPLACE FUNCTION programar_notificacion_estado_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mensaje TEXT;
    v_datos JSONB;
    v_programada_para TIMESTAMPTZ;
BEGIN
    -- Solo proceder si el estado cambió realmente
    IF NEW.estado = OLD.estado THEN
        RETURN NEW;
    END IF;

    -- Definir mensajes según estado
    CASE NEW.estado
        WHEN 'confirmado' THEN
            v_mensaje := '✅ Tu pedido ha sido confirmado y está siendo preparado.';
            v_datos := jsonb_build_object(
                'numero', NEW.numero_pedido,
                'fecha_entrega', NEW.fecha_entrega_estimada,
                'total', NEW.total
            );
            -- Enviar en 5 minutos
            v_programada_para := NOW() + INTERVAL '5 minutes';

        WHEN 'preparando' THEN
            v_mensaje := '🏭 Tu pedido está siendo preparado en almacén.';
            v_datos := jsonb_build_object(
                'numero', NEW.numero_pedido
            );
            -- Enviar inmediatamente
            v_programada_para := NOW();

        WHEN 'enviado' THEN
            v_mensaje := '🚛 Tu pedido ha salido para entrega.';
            v_datos := jsonb_build_object(
                'numero', NEW.numero_pedido,
                'fecha_entrega', NEW.fecha_entrega_real
            );
            -- Enviar en 5 minutos
            v_programada_para := NOW() + INTERVAL '5 minutes';

        WHEN 'entregado' THEN
            v_mensaje := '📦 Tu pedido ha sido entregado exitosamente. ¡Gracias por tu compra!';
            v_datos := jsonb_build_object(
                'numero', NEW.numero_pedido
            );
            -- Enviar en 30 minutos (para dar tiempo de verificación)
            v_programada_para := NOW() + INTERVAL '30 minutes';

        WHEN 'cancelado' THEN
            v_mensaje := '❌ Tu pedido ha sido cancelado.';
            v_datos := jsonb_build_object(
                'numero', NEW.numero_pedido,
                'motivo', COALESCE(NEW.observaciones, 'No especificado')
            );
            -- Enviar inmediatamente
            v_programada_para := NOW();

        ELSE
            -- Otros estados no generan notificación
            RETURN NEW;
    END CASE;

    -- Insertar notificación programada usando RPC
    PERFORM programar_notificacion(
        p_cliente_id := NEW.cliente_id,
        p_tipo := 'estado_pedido',
        p_mensaje := v_mensaje,
        p_datos := v_datos,
        p_programada_para := v_programada_para
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION programar_notificacion_estado_pedido IS 'Trigger que programa notificaciones automáticas al cambiar estado de pedido';

-- ===========================================
-- TRIGGER: On estado de pedido cambiado
-- ===========================================

DROP TRIGGER IF EXISTS tr_pedido_estado_cambiado ON pedidos;

CREATE TRIGGER tr_pedido_estado_cambiado
    AFTER UPDATE OF estado ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION programar_notificacion_estado_pedido();

COMMENT ON TRIGGER tr_pedido_estado_cambiado ON pedidos IS 'Programa notificación al cambiar estado del pedido';

-- ===========================================
-- FUNCIÓN: Programar notificación de entrega cercana
-- ===========================================

CREATE OR REPLACE FUNCTION programar_notificacion_entrega_cercana()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mensaje TEXT;
    v_datos JSONB;
BEGIN
    -- Solo programar cuando ruta cambia a 'en_curso'
    IF NEW.estado = 'en_curso' AND OLD.estado != 'en_curso' THEN
        v_mensaje := '📍 ¡Atención! Tu pedido está en camino y llegará pronto.';
        v_datos := jsonb_build_object(
            'numero_ruta', NEW.numero_ruta,
            'vehiculo_id', NEW.vehiculo_id,
            'repartidor_id', NEW.repartidor_id
        );

        -- Programar para 30 minutos después (dar tiempo a repartidor a salir)
        PERFORM programar_notificacion(
            p_cliente_id := NULL, -- Se asignará en trigger de detalles_ruta
            p_tipo := 'entrega_cercana',
            p_mensaje := v_mensaje,
            p_datos := v_datos,
            p_programada_para := NOW() + INTERVAL '30 minutes'
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION programar_notificacion_entrega_cercana IS 'Trigger que programa notificación cuando ruta comienza';

-- ===========================================
-- TRIGGER: On estado de ruta cambiado
-- ===========================================

DROP TRIGGER IF EXISTS tr_ruta_estado_cambiado ON rutas_reparto;

CREATE TRIGGER tr_ruta_estado_cambiado
    AFTER UPDATE OF estado ON rutas_reparto
    FOR EACH ROW
    EXECUTE FUNCTION programar_notificacion_entrega_cercana();

COMMENT ON TRIGGER tr_ruta_estado_cambiado ON rutas_reparto IS 'Programa notificación cuando ruta comienza';

-- ===========================================
-- FUNCIÓN: Programar notificación de alerta de pago
-- ===========================================

CREATE OR REPLACE FUNCTION programar_alerta_pago_pendiente()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente RECORD;
    v_mensaje TEXT;
    v_datos JSONB;
    v_dias_vencidos INTEGER;
BEGIN
    -- Buscar clientes con saldo pendiente > 7 días y deuda > $1000
    FOR v_cliente IN
        SELECT DISTINCT c.id, c.nombre, c.whatsapp,
               COALESCE(cc.saldo, 0) as saldo,
               EXTRACT(DAY FROM (NOW() - COALESCE(MAX(cc.updated_at), NOW()))) as dias_vencidos
        FROM cuentas_corrientes cc
        INNER JOIN clientes c ON c.id = cc.cliente_id
        WHERE cc.saldo < -1000
          AND cc.updated_at < NOW() - INTERVAL '7 days'
          AND c.activo = true
          AND c.whatsapp IS NOT NULL
        GROUP BY c.id, c.nombre, c.whatsapp, cc.updated_at
    LOOP
        v_dias_vencidos := EXTRACT(DAY FROM (NOW() - COALESCE((SELECT MAX(updated_at) FROM cuentas_corrientes WHERE cliente_id = v_cliente.id), NOW())));

        v_mensaje := format('⚠ Tienes un saldo pendiente de $%s hace %s días. Por favor regulariza tu situación para continuar disfrutando de nuestros servicios.',
            ABS(v_cliente.saldo),
            v_dias_vencidos
        );

        v_datos := jsonb_build_object(
            'saldo', v_cliente.saldo,
            'dias_vencidos', v_dias_vencidos
        );

        -- Programar alerta para las 9am de mañana
        PERFORM programar_notificacion(
            p_cliente_id := v_cliente.id,
            p_tipo := 'alerta_pago',
            p_mensaje := v_mensaje,
            p_datos := v_datos,
            p_programada_para := DATE_TRUNC('day', NOW()) + INTERVAL '1 day 9 hours'
        );
    END LOOP;
END;
$$;

COMMENT ON FUNCTION programar_alerta_pago_pendiente IS 'Programa alertas de pago para clientes con deuda >7 días';

COMMIT;

-- ===========================================
-- VERIFICACIÓN
-- ===========================================

-- Verificar que las funciones fueron creadas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'programar_notificacion_estado_pedido') THEN
        RAISE NOTICE '✓ Función programar_notificacion_estado_pedido creada';
    ELSE
        RAISE EXCEPTION '✗ Error: Función programar_notificacion_estado_pedido no fue creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'programar_notificacion_entrega_cercana') THEN
        RAISE NOTICE '✓ Función programar_notificacion_entrega_cercana creada';
    ELSE
        RAISE EXCEPTION '✗ Error: Función programar_notificacion_entrega_cercana no fue creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'programar_alerta_pago_pendiente') THEN
        RAISE NOTICE '✓ Función programar_alerta_pago_pendiente creada';
    ELSE
        RAISE EXCEPTION '✗ Error: Función programar_alerta_pago_pendiente no fue creada';
    END IF;
END $$;

-- Verificar que los triggers fueron creados
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'tr_pedido_estado_cambiado'
    ) THEN
        RAISE NOTICE '✓ Trigger tr_pedido_estado_cambiado creado en tabla pedidos';
    ELSE
        RAISE EXCEPTION '✗ Error: Trigger tr_pedido_estado_cambiado no fue creado';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'tr_ruta_estado_cambiado'
    ) THEN
        RAISE NOTICE '✓ Trigger tr_ruta_estado_cambiado creado en tabla rutas_reparto';
    ELSE
        RAISE EXCEPTION '✗ Error: Trigger tr_ruta_estado_cambiado no fue creado';
    END IF;

    RAISE NOTICE '✓ Migración 20260124_triggers_notificaciones_completada con éxito';
END $$;
