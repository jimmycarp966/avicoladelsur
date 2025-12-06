'use client'

import { useEffect, useRef } from 'react'
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts'

export interface FormFieldShortcut {
  key: string
  fieldId?: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action?: () => void
  description?: string
}

interface UseFormContextShortcutsOptions {
  shortcuts: FormFieldShortcut[]
  enabled?: boolean
}

/**
 * Hook para agregar atajos de teclado contextuales a formularios
 * Permite enfocar campos específicos con teclas individuales
 * 
 * @example
 * useFormContextShortcuts({
 *   shortcuts: [
 *     { key: 'c', fieldId: 'cliente_id', description: 'Cliente' },
 *     { key: 'p', fieldId: 'producto_id', description: 'Producto' },
 *   ]
 * })
 */
export function useFormContextShortcuts({
  shortcuts,
  enabled = true,
}: UseFormContextShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts)

  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const keyboardShortcuts: KeyboardShortcut[] = shortcuts.map((shortcut) => ({
    key: shortcut.key,
    ctrl: shortcut.ctrl,
    shift: shortcut.shift,
    alt: shortcut.alt,
    action: () => {
      // Si hay una acción personalizada, ejecutarla
      if (shortcut.action) {
        shortcut.action()
        return
      }

      // Si no hay fieldId, no hacer nada
      if (!shortcut.fieldId) {
        return
      }

      // Buscar el elemento por ID
      const element = document.getElementById(shortcut.fieldId)
      if (!element) {
        // Intentar buscar por name o data-field-id
        const byName = document.querySelector(`[name="${shortcut.fieldId}"]`)
        const byDataId = document.querySelector(`[data-field-id="${shortcut.fieldId}"]`)
        const target = (byName || byDataId) as HTMLElement
        
        if (target) {
          focusElement(target)
        }
        return
      }

      focusElement(element)
    },
    description: shortcut.description || `Enfocar ${shortcut.fieldId}`,
  }))

  useKeyboardShortcuts({ shortcuts: keyboardShortcuts, enabled })
}

/**
 * Función helper para enfocar un elemento, manejando diferentes tipos
 */
function focusElement(element: HTMLElement) {
  // Si es un input o textarea, hacer focus normal
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus()
    element.select()
    return
  }

  // Si es un botón con role="combobox" (SelectTrigger), hacer click para abrir
  if (element instanceof HTMLButtonElement || element.getAttribute('role') === 'combobox') {
    element.click()
    
    // Esperar a que se abra el dropdown y enfocar el input de búsqueda si existe
    setTimeout(() => {
      const selectContent = document.querySelector('[role="listbox"]')
      if (selectContent) {
        const searchInput = selectContent.querySelector('input[type="text"], input[placeholder*="Buscar"], input[placeholder*="buscar"]')
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus()
          searchInput.select()
        }
      }
    }, 150)
    return
  }

  // Intentar hacer focus directamente
  if (typeof (element as any).focus === 'function') {
    ;(element as any).focus()
  }
}

