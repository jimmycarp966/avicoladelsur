import { create } from 'zustand'
import { toast } from 'sonner'
import type { NotificationItem } from '@/types/domain.types'

export interface NotificationState {
  notifications: NotificationItem[]
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
    }

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
    }))

    // Mostrar toast automáticamente
    get().showToast(notification.type, notification.message || '', notification.title)
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }))
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }))
  },

  clearAll: () => {
    set({ notifications: [] })
  },

  showToast: (type, message, title) => {
    const toastMessage = title ? `${title}: ${message}` : message

    switch (type) {
      case 'success':
        toast.success(toastMessage)
        break
      case 'error':
        toast.error(toastMessage)
        break
      case 'warning':
        toast.warning(toastMessage)
        break
      case 'info':
        toast.info(toastMessage)
        break
    }
  },
}))
