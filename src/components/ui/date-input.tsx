'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from './input'
import { format, parse, isValid } from 'date-fns'

interface DateInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  name?: string
}

export function DateInput({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  className,
  id,
  name,
}: DateInputProps) {
  const [displayValue, setDisplayValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Convertir YYYY-MM-DD a DD/MM/YYYY para mostrar
  useEffect(() => {
    if (value) {
      try {
        const date = parse(value, 'yyyy-MM-dd', new Date())
        if (isValid(date)) {
          setDisplayValue(format(date, 'dd/MM/yyyy'))
        } else {
          setDisplayValue('')
        }
      } catch {
        setDisplayValue('')
      }
    } else {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, '') // Solo números

    // Limitar a 8 dígitos (DDMMYYYY)
    if (input.length > 8) {
      input = input.slice(0, 8)
    }

    // Formatear mientras se escribe
    let formatted = ''
    if (input.length > 0) {
      formatted = input.slice(0, 2)
      if (input.length > 2) {
        formatted += '/' + input.slice(2, 4)
      }
      if (input.length > 4) {
        formatted += '/' + input.slice(4, 8)
      }
    }

    setDisplayValue(formatted)

    // Convertir DD/MM/YYYY a YYYY-MM-DD para el onChange
    if (input.length === 8) {
      const day = parseInt(input.slice(0, 2), 10)
      const month = parseInt(input.slice(2, 4), 10)
      const year = parseInt(input.slice(4, 8), 10)

      // Validar fecha
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        try {
          const date = new Date(year, month - 1, day)
          if (
            date.getDate() === day &&
            date.getMonth() === month - 1 &&
            date.getFullYear() === year
          ) {
            const isoDate = format(date, 'yyyy-MM-dd')
            onChange?.(isoDate)
          }
        } catch {
          // Fecha inválida, no llamar onChange
        }
      }
    } else if (input.length === 0) {
      onChange?.('')
    }
  }

  const handleBlur = () => {
    // Si el valor no está completo, limpiarlo
    if (displayValue && displayValue.length < 10) {
      setDisplayValue('')
      onChange?.('')
    }
  }

  return (
    <Input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      maxLength={10}
    />
  )
}

