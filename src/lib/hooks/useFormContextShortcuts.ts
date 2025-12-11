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

  const keyboardShortcuts: KeyboardShortcut[] = shortcuts.map((shortcut) => {
    fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFormContextShortcuts.ts:43',message:'Mapeando shortcut',data:{key:shortcut.key,ctrl:shortcut.ctrl,fieldId:shortcut.fieldId,description:shortcut.description},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});

    return {
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
      description: shortcut.description || `Enfocar ${shortcut.fieldId}`
    }
  })

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
    // Hacer click para abrir el dropdown
    element.click()
    
    // Esperar a que se abra el dropdown y enfocar el input de búsqueda si existe
    // Usar múltiples intentos para asegurar que funcione
    const focusSearchInput = (attempts = 0) => {
      if (attempts > 10) return // Máximo 10 intentos (1 segundo)
      
      // Buscar el SelectContent que está abierto (visible)
      const selectContents = document.querySelectorAll('[role="listbox"]')
      let visibleContent: Element | null = null
      
      for (const content of selectContents) {
        // Verificar si está visible (no tiene display: none)
        const style = window.getComputedStyle(content as HTMLElement)
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          visibleContent = content
          break
        }
      }
      
      if (visibleContent) {
        // Buscar el input de búsqueda dentro del SelectContent
        // Puede estar en diferentes lugares según la estructura
        const searchInput = visibleContent.querySelector(
          'input[type="text"], input[placeholder*="Buscar"], input[placeholder*="buscar"], input[placeholder*="Buscar producto"], input[placeholder*="Buscar por código"]'
        ) as HTMLInputElement
        
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
          return
        }
      }
      
      // Si no se encontró, intentar de nuevo después de un breve delay
      setTimeout(() => focusSearchInput(attempts + 1), 100)
    }
    
    // Iniciar el proceso después de que el dropdown se abra
    setTimeout(() => focusSearchInput(), 50)
    return
  }

  // Intentar hacer focus directamente
  if (typeof (element as any).focus === 'function') {
    ;(element as any).focus()
  }
}


