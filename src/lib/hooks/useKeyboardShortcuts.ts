'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export type KeyboardShortcut = {
  key?: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  fn?: number // F1-F12
  action: () => void
  description?: string
  preventDefault?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const shortcutsRef = useRef(shortcuts)

  // Actualizar referencias cuando cambian los shortcuts
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:33',message:'handleKeyDown ejecutado',data:{key:event.key,ctrlKey:event.ctrlKey,targetTag:event.target?.tagName,isEnabled:enabled},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});

      if (!enabled) return

      // Validar que event.key existe
      if (!event.key) {
        return
      }

      // Ignorar si está escribiendo en un input, textarea o contenteditable
      const target = event.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:45',message:'Verificación de typing',data:{isTyping,targetTag:target.tagName,targetId:target.id},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});

      // Permitir siempre las teclas de función (F1-F12) y atajos con Ctrl
      const isFunctionKey = event.key.startsWith('F') && /^F\d+$/.test(event.key)
      const isCtrlShortcut = event.ctrlKey || event.metaKey
      const isShiftShortcut = event.shiftKey
      const isAltShortcut = event.altKey

      // Si está escribiendo, solo permitir teclas de función y atajos con modificadores
      // NO buscar shortcuts cuando está escribiendo sin modificadores
      if (isTyping && !isFunctionKey && !isCtrlShortcut && !isShiftShortcut && !isAltShortcut) {
        fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:54',message:'Está escribiendo y no es atajo con modificador, ignorando shortcut',data:{key:event.key,isTyping},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
        // Cuando está escribiendo sin modificadores, simplemente retornar y dejar que el input maneje la tecla
        return
      }

      // Buscar el shortcut que coincide
      for (const shortcut of shortcutsRef.current) {
        let matches = false

        // Manejar teclas de función (F1-F12)
        if (shortcut.fn !== undefined) {
          const fnKey = `F${shortcut.fn}`
          const fnCode = `F${shortcut.fn}`
          // Verificar tanto event.key como event.code para compatibilidad
          matches = 
            event.key === fnKey || 
            event.code === fnCode ||
            event.key === `F${shortcut.fn}` ||
            (event.key.startsWith('F') && parseInt(event.key.slice(1)) === shortcut.fn)
        } else {
          // Manejar teclas normales - validar que tanto event.key como shortcut.key existan
          if (!event.key || !shortcut.key) {
            continue
          }

          const keyMatches =
            event.key.toLowerCase() === shortcut.key.toLowerCase() ||
            !!(event.code && event.code.toLowerCase() === shortcut.key.toLowerCase())

          const ctrlMatches = shortcut.ctrl === undefined || shortcut.ctrl === event.ctrlKey
          const shiftMatches = shortcut.shift === undefined || shortcut.shift === event.shiftKey
          const altMatches = shortcut.alt === undefined || shortcut.alt === event.altKey
          const metaMatches = shortcut.meta === undefined || shortcut.meta === event.metaKey

          matches = keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches
        }

        if (matches) {
          fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:114',message:'Shortcut encontrado y ejecutándose',data:{shortcutKey:shortcut.key,shortcutCtrl:shortcut.ctrl,eventKey:event.key,eventCtrl:event.ctrlKey,description:shortcut.description},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});

          if (shortcut.preventDefault !== false) {
            event.preventDefault()
            event.stopPropagation()
          }
          shortcut.action()
          break
        }
      }
    },
    [enabled]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, enabled])
}

// Hook para atajos de navegación comunes
export function useNavigationShortcuts() {
  const router = useRouter()
  const pathname = usePathname()

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'h',
      ctrl: true,
      action: () => router.push('/dashboard'),
      description: 'Ir al Dashboard',
    },
    {
      key: 'n',
      ctrl: true,
      shift: true,
      action: () => {
        // Detectar contexto y navegar a "nuevo" según la ruta actual
        if (pathname.includes('/clientes')) {
          router.push('/ventas/clientes/nuevo')
        } else if (pathname.includes('/productos')) {
          router.push('/almacen/productos/nuevo')
        } else if (pathname.includes('/presupuestos')) {
          router.push('/ventas/presupuestos/nuevo')
        } else if (pathname.includes('/pedidos')) {
          router.push('/almacen/pedidos/nuevo')
        } else if (pathname.includes('/lotes')) {
          router.push('/almacen/lotes/nuevo')
        } else if (pathname.includes('/vehiculos')) {
          router.push('/reparto/vehiculos/nuevo')
        } else if (pathname.includes('/rutas')) {
          router.push('/reparto/rutas/nueva')
        }
      },
      description: 'Crear nuevo (según contexto)',
    },
    {
      key: 'Escape',
      action: () => router.back(),
      description: 'Volver atrás',
      preventDefault: false,
    },
  ]

  useKeyboardShortcuts({ shortcuts })
}

// Hook para atajos de función (F1-F12)
export function useFunctionKeyShortcuts() {
  const router = useRouter()

  const shortcuts: KeyboardShortcut[] = [
    {
      fn: 1,
      action: () => router.push('/dashboard'),
      description: 'Dashboard',
    },
    {
      fn: 2,
      action: () => router.push('/almacen/productos'),
      description: 'Productos',
    },
    {
      fn: 3,
      action: () => router.push('/ventas/clientes'),
      description: 'Clientes',
    },
    {
      fn: 4,
      action: () => router.push('/ventas/presupuestos'),
      description: 'Presupuestos',
    },
    {
      fn: 5,
      action: () => router.push('/almacen/pedidos'),
      description: 'Pedidos',
    },
    {
      fn: 6,
      action: () => router.push('/reparto/rutas'),
      description: 'Rutas',
    },
    {
      fn: 7,
      action: () => router.push('/reparto/monitor'),
      description: 'Monitor GPS',
    },
    {
      fn: 8,
      action: () => router.push('/tesoreria/cajas'),
      description: 'Tesorería',
    },
    {
      fn: 9,
      action: () => router.push('/almacen/lotes'),
      description: 'Lotes',
    },
    {
      fn: 10,
      action: () => router.push('/reparto/planificacion'),
      description: 'Planificación',
    },
    {
      fn: 11,
      action: () => router.push('/ventas/listas-precios'),
      description: 'Listas de Precios',
    },
    {
      fn: 12,
      action: () => {
        // Mostrar ayuda de atajos
        const event = new CustomEvent('show-keyboard-shortcuts')
        window.dispatchEvent(event)
      },
      description: 'Ayuda de Atajos',
    },
  ]

  useKeyboardShortcuts({ shortcuts })
}

