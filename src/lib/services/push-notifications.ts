'use client'

/**
 * Servicio de notificaciones push del navegador
 * Permite enviar notificaciones incluso cuando la aplicación no está abierta
 */

let permissionGranted = false

/**
 * Solicita permisos para notificaciones push
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    permissionGranted = permission === 'granted'
    return permissionGranted
  } catch (error) {
    console.error('Error solicitando permisos de notificación:', error)
    return false
  }
}

/**
 * Envía una notificación push
 */
export function sendPushNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null
  }

  if (!permissionGranted && Notification.permission !== 'granted') {
    return null
  }

  try {
    const notification = new Notification(title, {
      icon: '/images/logo-avicola.svg',
      badge: '/images/logo-avicola.svg',
      ...options,
    })

    // Cerrar automáticamente después de 5 segundos
    setTimeout(() => {
      notification.close()
    }, 5000)

    return notification
  } catch (error) {
    console.error('Error enviando notificación:', error)
    return null
  }
}

/**
 * Inicializa el servicio de notificaciones
 * Debe llamarse cuando el usuario inicia sesión
 */
export async function initializePushNotifications(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  // Solicitar permisos automáticamente al inicializar
  await requestNotificationPermission()
}

/**
 * Envía notificación para eventos críticos
 */
export function notifyCriticalEvent(
  type: 'nuevo_pedido' | 'stock_bajo' | 'transferencia_aprobada' | 'ruta_completada',
  data: any
): void {
  const notifications: Record<string, { title: string; body: string }> = {
    nuevo_pedido: {
      title: 'Nuevo Pedido',
      body: `Pedido ${data.numero || ''} asignado a tu ruta`,
    },
    stock_bajo: {
      title: 'Stock Bajo',
      body: `Producto ${data.producto || ''} está por debajo del umbral`,
    },
    transferencia_aprobada: {
      title: 'Transferencia Aprobada',
      body: `Transferencia ${data.numero || ''} ha sido aprobada`,
    },
    ruta_completada: {
      title: 'Ruta Completada',
      body: `Ruta ${data.numero || ''} ha sido completada`,
    },
  }

  const notification = notifications[type]
  if (notification) {
    sendPushNotification(notification.title, {
      body: notification.body,
      tag: type, // Evita duplicados
      requireInteraction: type === 'stock_bajo', // Requiere interacción para stock bajo
    })
  }
}

