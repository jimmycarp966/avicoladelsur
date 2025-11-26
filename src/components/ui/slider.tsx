import * as React from 'react'

import { cn } from '@/lib/utils'

interface SliderProps {
  value: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ value, onValueChange, min = 0, max = 100, step = 1, className, ...props }, ref) => {
    const currentValue = Array.isArray(value) && value.length > 0 ? value[0] : min

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const numericValue = Number(event.target.value)
      onValueChange?.([numericValue])
    }

    return (
      <div className={cn('flex items-center', className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-secondary"
          {...props}
        />
      </div>
    )
  }
)

Slider.displayName = 'Slider'


