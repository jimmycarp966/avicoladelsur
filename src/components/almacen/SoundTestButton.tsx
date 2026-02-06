'use client'

import { useState } from 'react'
import { useSoundAlert } from '@/components/ui/sound-alert'
import { Volume2, VolumeX, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

/**
 * Botón para probar y activar las notificaciones sonoras
 *
 * Debido a la política de autoplay de los navegadores, el AudioContext
 * debe ser activado por una interacción del usuario.
 */
export function SoundTestButton() {
  const { playNotification, activateAudio, audioState } = useSoundAlert(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleClick = async () => {
    setIsPlaying(true)

    // Primero intentar activar el audio
    const wasSuspended = audioState === 'suspended' || audioState === 'uninitialized'
    const activated = await activateAudio()

    if (wasSuspended && activated) {
      toast.success('¡Audio activado!', {
        description: 'Las notificaciones sonoras están funcionando',
        duration: 2000,
      })
    }

    // Luego reproducir el sonido de prueba
    playNotification()

    setTimeout(() => setIsPlaying(false), 1500)
  }

  const isInactive = audioState === 'suspended' || audioState === 'uninitialized'

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isInactive ? 'default' : 'outline'}
        size="sm"
        onClick={handleClick}
        className="gap-2"
        disabled={isPlaying}
      >
        {isPlaying ? (
          <Bell className="h-4 w-4 animate-ping" />
        ) : isInactive ? (
          <VolumeX className="h-4 w-4 text-orange-500" />
        ) : (
          <Volume2 className="h-4 w-4 text-green-600" />
        )}
        {isPlaying ? 'Reproduciendo...' : isInactive ? 'Activar sonido' : 'Probar alarma'}
      </Button>
      <Badge
        variant={isInactive ? 'destructive' : 'default'}
        className="text-xs"
      >
        {isInactive ? '🔇 Audio inactivo' : '🔊 Audio activo'}
      </Badge>
    </div>
  )
}
