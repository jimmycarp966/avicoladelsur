'use client'

import { useSoundAlert } from '@/components/ui/sound-alert'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * Botón para probar y activar las notificaciones sonoras
 *
 * Debido a la política de autoplay de los navegadores, el AudioContext
 * debe ser activado por una interacción del usuario.
 */
export function SoundTestButton() {
  const { playNotification, activateAudio, audioState } = useSoundAlert(true)

  const handleClick = async () => {
    // Primero intentar activar el audio
    await activateAudio()
    // Luego reproducir el sonido de prueba
    playNotification()
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-2"
      >
        {audioState === 'suspended' || audioState === 'uninitialized' ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        Probar sonido
      </Button>
      <Badge variant="outline" className="text-xs">
        Audio: {audioState}
      </Badge>
    </div>
  )
}
