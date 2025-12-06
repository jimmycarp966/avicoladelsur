'use client'

import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts'

interface UseTableShortcutsOptions {
  onNew?: () => void
  onSearch?: () => void
  onDelete?: () => void
  onSelect?: () => void
  enabled?: boolean
}

/**
 * Hook para agregar atajos de teclado comunes en tablas
 * - Ctrl+N: Crear nuevo
 * - Ctrl+F: Buscar
 * - Delete: Eliminar seleccionado
 * - Enter: Seleccionar fila
 */
export function useTableShortcuts({
  onNew,
  onSearch,
  onDelete,
  onSelect,
  enabled = true,
}: UseTableShortcutsOptions) {
  const shortcuts: KeyboardShortcut[] = []

  if (onNew) {
    shortcuts.push({
      key: 'n',
      ctrl: true,
      action: onNew,
      description: 'Crear nuevo',
    })
  }

  if (onSearch) {
    shortcuts.push({
      key: 'f',
      ctrl: true,
      action: onSearch,
      description: 'Buscar',
    })
  }

  if (onDelete) {
    shortcuts.push({
      key: 'Delete',
      action: onDelete,
      description: 'Eliminar seleccionado',
    })
  }

  if (onSelect) {
    shortcuts.push({
      key: 'Enter',
      action: onSelect,
      description: 'Seleccionar fila',
    })
  }

  useKeyboardShortcuts({ shortcuts, enabled })
}

