import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon'
  className?: string
  priority?: boolean
  light?: boolean // Para usar en fondos oscuros
}

const sizeMap = {
  sm: { height: 32, width: 32 },
  md: { height: 40, width: 40 },
  lg: { height: 48, width: 48 },
  xl: { height: 64, width: 64 },
}

export function Logo({
  size = 'md',
  variant = 'full',
  className,
  priority = false,
  light = false,
}: LogoProps) {
  const dimensions = sizeMap[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/images/logo-avicola.png"
        alt="Avícola del Sur"
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className="object-contain"
        style={{ width: 'auto', height: dimensions.height }}
      />
      {variant === 'full' && size !== 'sm' && (
        <div className="flex flex-col">
          <span className={cn(
            "text-sm font-semibold leading-tight",
            light ? "text-white" : "text-primary"
          )}>
            Avícola
          </span>
          <span className={cn(
            "text-xs leading-tight",
            light ? "text-white/80" : "text-muted-foreground"
          )}>
            del Sur
          </span>
        </div>
      )}
    </div>
  )
}

