'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook para reproducir alertas sonoras usando Web Audio API
 *
 * @example
 * ```tsx
 * const { playBeep, playDoubleBeep, playSuccess, playAlert } = useSoundAlert(true)
 *
 * <button onClick={() => playDoubleBeep()}>Notificar</button>
 * ```
 */
export function useSoundAlert(enabled: boolean = true) {
  const audioContextRef = useRef<AudioContext | null>(null)

  // Inicializar AudioContext al montar el componente
  useEffect(() => {
    if (!enabled) return

    // Crear contexto de audio (manejar compatibilidad con navegadores antiguos)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      audioContextRef.current = new AudioContextClass()
    }

    return () => {
      // Cerrar contexto al desmontar
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [enabled])

  /**
   * Reproduce un pitido simple con frecuencia y duración configurables
   *
   * @param frequency - Frecuencia en Hz (por defecto 800)
   * @param duration - Duración en ms (por defecto 200)
   * @param volume - Volumen entre 0 y 1 (por defecto 0.3)
   */
  const playBeep = useCallback((frequency: number = 800, duration: number = 200, volume: number = 0.3) => {
    if (!enabled || !audioContextRef.current) return

    const ctx = audioContextRef.current

    // Reanudar contexto si está suspendido (política de autoplay)
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    try {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      // Conectar nodos: oscillator -> gain -> destination
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      // Configurar tono
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      // Configurar envolvente de volumen para evitar clicks
      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000)

      // Reproducir
      oscillator.start(now)
      oscillator.stop(now + duration / 1000)
    } catch (error) {
      console.error('[useSoundAlert] Error reproduciendo beep:', error)
    }
  }, [enabled])

  /**
   * Reproduce un pitido doble (beep-beep) para notificaciones más prominentes
   */
  const playDoubleBeep = useCallback((freq1: number = 800, freq2: number = 1000, duration: number = 150) => {
    if (!enabled) return
    playBeep(freq1, duration)
    setTimeout(() => playBeep(freq2, duration), 200)
  }, [enabled, playBeep])

  /**
   * Reproduce un sonido de éxito (tres pitidos ascendentes)
   */
  const playSuccess = useCallback(() => {
    if (!enabled) return
    playBeep(600, 100)
    setTimeout(() => playBeep(800, 100), 120)
    setTimeout(() => playBeep(1000, 150), 240)
  }, [enabled, playBeep])

  /**
   * Reproduce un sonido de alerta (pitido grave largo)
   */
  const playAlert = useCallback(() => {
    if (!enabled) return
    playBeep(400, 400, 0.4)
  }, [enabled, playBeep])

  /**
   * Reproduce un sonido de notificación nuevo (doble beep agudo)
   */
  const playNotification = useCallback(() => {
    if (!enabled) return
    playDoubleBeep(880, 1100, 150)
  }, [enabled, playDoubleBeep])

  return {
    playBeep,
    playDoubleBeep,
    playSuccess,
    playAlert,
    playNotification,
  }
}
