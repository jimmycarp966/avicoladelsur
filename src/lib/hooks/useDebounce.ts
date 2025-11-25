import { useState, useEffect } from 'react'

/**
 * Hook personalizado para debouncing de valores
 * @param value - Valor a debounce
 * @param delay - Delay en milisegundos (default: 300ms)
 * @returns Valor debounced
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

