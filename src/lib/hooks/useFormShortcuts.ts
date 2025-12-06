'use client'

import { useEffect, useRef } from 'react'
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts'

interface UseFormShortcutsOptions {
  onSubmit: (e?: React.FormEvent) => void | Promise<void>
  enabled?: boolean
  submitButtonRef?: React.RefObject<HTMLButtonElement | null>
}

/**
 * Hook para agregar atajos de teclado comunes en formularios
 * - Ctrl+S: Guardar/Enviar formulario
 * - Ctrl+Enter: Enviar formulario
 */
export function useFormShortcuts({ onSubmit, enabled = true, submitButtonRef }: UseFormShortcutsOptions) {
  const onSubmitRef = useRef(onSubmit)

  // Actualizar referencia cuando cambia onSubmit
  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 's',
      ctrl: true,
      action: async () => {
        if (submitButtonRef?.current) {
          submitButtonRef.current.click()
        } else {
          await onSubmitRef.current()
        }
      },
      description: 'Guardar formulario',
    },
    {
      key: 'Enter',
      ctrl: true,
      action: async () => {
        if (submitButtonRef?.current) {
          submitButtonRef.current.click()
        } else {
          await onSubmitRef.current()
        }
      },
      description: 'Enviar formulario',
    },
  ]

  useKeyboardShortcuts({ shortcuts, enabled })
}

