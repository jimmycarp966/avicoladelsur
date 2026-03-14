'use client'

import { useEffect, useState } from 'react'
import { useNavigationShortcuts, useFunctionKeyShortcuts } from '@/lib/hooks/useKeyboardShortcuts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false)

  // Activar atajos de navegación
  useNavigationShortcuts()
  useFunctionKeyShortcuts()

  useEffect(() => {
    const handleShowHelp = () => {
      setShowHelp(true)
    }

    window.addEventListener('show-keyboard-shortcuts', handleShowHelp)
    return () => {
      window.removeEventListener('show-keyboard-shortcuts', handleShowHelp)
    }
  }, [])

  const shortcuts = [
    {
      category: 'Navegación Rápida',
      items: [
        { keys: ['F1'], description: 'Dashboard' },
        { keys: ['F2'], description: 'Productos' },
        { keys: ['F3'], description: 'Clientes' },
        { keys: ['F4'], description: 'Presupuestos' },
        { keys: ['F5'], description: 'Pedidos' },
        { keys: ['F6'], description: 'Rutas' },
        { keys: ['F7'], description: 'Monitor GPS' },
        { keys: ['F8'], description: 'Tesorería' },
        { keys: ['F9'], description: 'Lotes' },
        { keys: ['F10'], description: 'Planificación' },
        { keys: ['F11'], description: 'Listas de Precios' },
      ],
    },
    {
      category: 'Acciones Comunes',
      items: [
        { keys: ['Ctrl', 'H'], description: 'Ir al Dashboard' },
        { keys: ['Ctrl', 'Shift', 'N'], description: 'Crear nuevo (según contexto)' },
        { keys: ['Ctrl', 'S'], description: 'Guardar formulario' },
        { keys: ['Ctrl', 'Enter'], description: 'Enviar formulario' },
        { keys: ['Esc'], description: 'Volver atrás / Cerrar modal' },
      ],
    },
    {
      category: 'En Tablas',
      items: [
        { keys: ['Ctrl', 'F'], description: 'Buscar' },
        { keys: ['Enter'], description: 'Seleccionar fila' },
        { keys: ['Delete'], description: 'Eliminar seleccionado' },
      ],
    },
  ]

  return (
    <>
      {children}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Atajos de Teclado</DialogTitle>
            <DialogDescription>
              Utiliza estos atajos para navegar y operar el sistema más rápido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {shortcuts.map((category, idx) => (
              <div key={idx}>
                <h3 className="font-semibold text-sm mb-3 text-primary">{category.category}</h3>
                <div className="space-y-2">
                  {category.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm text-muted-foreground">{item.description}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((key, keyIdx) => (
                          <span key={keyIdx}>
                            <Badge
                              variant="outline"
                              className="font-mono text-xs px-2 py-1 min-w-[2.5rem] text-center"
                            >
                              {key}
                            </Badge>
                            {keyIdx < item.keys.length - 1 && (
                              <span className="mx-1 text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {idx < shortcuts.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Usa el botón de ayuda para ver este resumen de atajos
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

