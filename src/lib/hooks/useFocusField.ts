'use client'

import { useEffect, useRef } from 'react'
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts'

interface UseFocusFieldOptions {
  fieldId: string
  shortcut?: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  enabled?: boolean
  onFocus?: () => void
}

/**
 * Hook para enfocar un campo de formulario con un atajo de teclado
 * Útil para campos de búsqueda, selects, inputs, etc.
 * 
 * @example
 * const inputRef = useFocusField({
 *   fieldId: 'cliente_id',
 *   shortcut: 'c',
 *   ctrl: false,
 *   onFocus: () => {
 *     // Abrir dropdown si es necesario
 *   }
 * })
 */
export function useFocusField({
  fieldId,
  shortcut = 'c',
  ctrl = false,
  shift = false,
  alt = false,
  enabled = true,
  onFocus,
}: UseFocusFieldOptions) {
  const fieldRef = useRef<HTMLElement>(null)
  const onFocusRef = useRef(onFocus)

  useEffect(() => {
    onFocusRef.current = onFocus
  }, [onFocus])

  const shortcuts: KeyboardShortcut[] = [
    {
      key: shortcut,
      ctrl,
      shift,
      alt,
      action: () => {
        const element = document.getElementById(fieldId) || fieldRef.current
        if (element) {
          // Intentar hacer focus
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.focus()
            element.select()
          } else if (element instanceof HTMLButtonElement || element.getAttribute('role') === 'combobox') {
            // Si es un botón o combobox (como SelectTrigger), hacer click para abrirlo
            const wasOpen = element.getAttribute('aria-expanded') === 'true'
            element.click()
            
            // Si estaba cerrado, esperar a que se abra y enfocar el input de búsqueda
            if (!wasOpen) {
              // Usar MutationObserver o polling para detectar cuando aparece el SelectContent
              let attempts = 0
              const maxAttempts = 10
              const checkForInput = () => {
                attempts++
                // Buscar el input de búsqueda dentro del SelectContent
                const selectContent = document.querySelector('[role="listbox"]')
                if (selectContent) {
                  const searchInput = selectContent.querySelector('input[type="text"], input[placeholder*="Buscar"], input[placeholder*="buscar"]')
                  if (searchInput instanceof HTMLInputElement) {
                    searchInput.focus()
                    searchInput.select()
                    return
                  }
                }
                
                // Si no encontramos el input y aún tenemos intentos, seguir buscando
                if (attempts < maxAttempts) {
                  setTimeout(checkForInput, 50)
                }
              }
              
              // Empezar a buscar después de un pequeño delay
              setTimeout(checkForInput, 100)
            } else {
              // Si ya estaba abierto, enfocar directamente
              setTimeout(() => {
                const selectContent = document.querySelector('[role="listbox"]')
                if (selectContent) {
                  const searchInput = selectContent.querySelector('input[type="text"], input[placeholder*="Buscar"], input[placeholder*="buscar"]')
                  if (searchInput instanceof HTMLInputElement) {
                    searchInput.focus()
                    searchInput.select()
                  }
                }
              }, 50)
            }
          } else {
            // Intentar hacer focus directamente
            ;(element as HTMLElement).focus()
          }
          
          // Ejecutar callback si existe
          if (onFocusRef.current) {
            onFocusRef.current()
          }
        }
      },
      description: `Enfocar campo ${fieldId}`,
    },
  ]

  useKeyboardShortcuts({ shortcuts, enabled })

  return fieldRef
}

