'use client'

import { cn } from '@/lib/utils'

interface KeyboardHintProps {
  shortcut: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  className?: string
  showLabel?: boolean
}

/**
 * Componente para mostrar hints visuales de atajos de teclado
 * 
 * @example
 * <Label>
 *   Cliente *
 *   <KeyboardHint shortcut="C" />
 * </Label>
 */
export function KeyboardHint({
  shortcut,
  ctrl = false,
  shift = false,
  alt = false,
  className,
  showLabel = false,
}: KeyboardHintProps) {
  const keys: string[] = []
  
  if (ctrl) keys.push('Ctrl')
  if (shift) keys.push('Shift')
  if (alt) keys.push('Alt')
  keys.push(shortcut.toUpperCase())

  return (
    <span className={cn('inline-flex items-center gap-1 ml-2', className)}>
      {showLabel && <span className="text-xs text-muted-foreground">(</span>}
      <span className="text-xs text-muted-foreground">Presiona</span>
      <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
        {keys.join(' + ')}
      </kbd>
      {showLabel && <span className="text-xs text-muted-foreground">)</span>}
    </span>
  )
}

/**
 * Versión compacta del hint (solo muestra la tecla)
 */
export function KeyboardHintCompact({
  shortcut,
  ctrl = false,
  shift = false,
  alt = false,
  className,
}: Omit<KeyboardHintProps, 'showLabel'>) {
  const keys: string[] = []
  
  if (ctrl) keys.push('Ctrl')
  if (shift) keys.push('Shift')
  if (alt) keys.push('Alt')
  keys.push(shortcut.toUpperCase())

  return (
    <kbd className={cn(
      'px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded ml-1',
      className
    )}>
      {keys.join('+')}
    </kbd>
  )
}

