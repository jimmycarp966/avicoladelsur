// Re-export de todas las Server Actions
export * from './almacen.actions'
export * from './ventas.actions'
export * from './reparto.actions'
export * from './plan-rutas.actions'
export * from './tesoreria.actions'
export * from './gastos.actions'
export * from './presupuestos.actions'

// Función helper para crear notificaciones
export async function createNotification(data: {
  titulo: string
  mensaje: string
  tipo: 'info' | 'success' | 'warning' | 'error'
  usuario_id?: string | null
  metadata?: any
}) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { error } = await supabase.rpc('crear_notificacion', {
      p_tipo: data.tipo,
      p_titulo: data.titulo,
      p_mensaje: data.mensaje,
      p_datos: data.metadata || {},
      p_usuario_id: data.usuario_id
    })

    if (error) {
      console.error('Error creando notificación:', error)
    }
  } catch (error) {
    console.error('Error en createNotification:', error)
  }
}
