# 🎯 Ejemplo Práctico: Integración de Control Gestual en Pesaje

Este documento muestra cómo integrar el control gestual en el módulo de pesaje de almacén, el caso de uso más claro y útil.

---

## 📋 Objetivo

Permitir que los almacenistas confirmen pesos, naveguen entre productos y finalicen presupuestos usando gestos de mano, sin necesidad de tocar la pantalla repetidamente.

---

## 🔧 Implementación

### Paso 1: Crear Componente de Control Gestual Reutilizable

```typescript
// src/components/gestures/GestureControl.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { HandLandmarker, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision'

interface GestureAction {
  gesture: string
  action: () => void
  label: string
  icon?: React.ReactNode
}

interface GestureControlProps {
  enabled: boolean
  gestures: GestureAction[]
  onGestureDetected?: (gesture: string) => void
  showFeedback?: boolean
}

export function GestureControl({ 
  enabled, 
  gestures, 
  onGestureDetected,
  showFeedback = true 
}: GestureControlProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [currentGesture, setCurrentGesture] = useState<string | null>(null)
  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const requestRef = useRef<number>(0)
  const lastGestureTime = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        )

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        })

        setIsLoaded(true)
      } catch (error) {
        console.error("Error MediaPipe:", error)
      }
    }

    setupMediaPipe()

    return () => {
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close()
        handLandmarkerRef.current = null
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [enabled])

  const enableCam = async () => {
    if (!handLandmarkerRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.addEventListener("loadeddata", () => {
          setPermissionGranted(true)
          predictWebcam()
        }, { once: true })
        videoRef.current.play()
      }
    } catch (err: any) {
      console.error("Error accessing webcam:", err)
    }
  }

  const detectGesture = (landmarks: NormalizedLandmark[]): string | null => {
    // PINCH: Pulgar (4) e índice (8) juntos
    const thumbTip = landmarks[4]
    const indexTip = landmarks[8]
    const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y)
    const isPinching = pinchDist < 0.08

    // VICTORY: Índice y medio extendidos, anular y meñique cerrados
    const isIndexExtended = landmarks[8].y < landmarks[6].y
    const isMiddleExtended = landmarks[12].y < landmarks[10].y
    const isRingCurled = landmarks[16].y > landmarks[14].y
    const isPinkyCurled = landmarks[20].y > landmarks[18].y
    const isVictory = isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled && !isPinching

    // OPEN HAND: Todos los dedos extendidos
    const allExtended = 
      landmarks[8].y < landmarks[6].y &&  // Índice
      landmarks[12].y < landmarks[10].y && // Medio
      landmarks[16].y < landmarks[14].y && // Anular
      landmarks[20].y < landmarks[18].y    // Meñique

    // FIST: Todos los dedos cerrados
    const allCurled = 
      landmarks[8].y > landmarks[6].y &&  // Índice
      landmarks[12].y > landmarks[10].y && // Medio
      landmarks[16].y > landmarks[14].y && // Anular
      landmarks[20].y > landmarks[18].y    // Meñique

    if (isPinching) return 'pinch'
    if (isVictory) return 'victory'
    if (allExtended) return 'open_hand'
    if (allCurled) return 'fist'
    
    return null
  }

  const predictWebcam = () => {
    if (!videoRef.current || !handLandmarkerRef.current) {
      requestRef.current = window.requestAnimationFrame(predictWebcam)
      return
    }

    if (videoRef.current.readyState < 2) {
      requestRef.current = window.requestAnimationFrame(predictWebcam)
      return
    }

    const startTimeMs = performance.now()
    
    try {
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs)
      
      if (results && results.landmarks && results.landmarks.length > 0) {
        const gesture = detectGesture(results.landmarks[0])
        
        if (gesture) {
          setCurrentGesture(gesture)
          
          // Cooldown para evitar múltiples activaciones
          const now = Date.now()
          if (now - lastGestureTime.current > 1000) {
            lastGestureTime.current = now
            
            const gestureAction = gestures.find(g => g.gesture === gesture)
            if (gestureAction) {
              gestureAction.action()
              onGestureDetected?.(gesture)
            }
          }
        } else {
          setCurrentGesture(null)
        }
      } else {
        setCurrentGesture(null)
      }
    } catch (error) {
      console.error("Error en detectForVideo:", error)
    }
    
    requestRef.current = window.requestAnimationFrame(predictWebcam)
  }

  if (!enabled) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Video oculto para detección */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        playsInline
        muted
      />
      
      {/* Botón de activación */}
      {!permissionGranted && isLoaded && (
        <button
          onClick={enableCam}
          className="bg-[#2F7058] hover:bg-[#3d8a6f] text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🎥 Activar Control Gestual</span>
        </button>
      )}

      {/* Feedback visual */}
      {permissionGranted && showFeedback && currentGesture && (
        <div className="bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm font-bold">
            {gestures.find(g => g.gesture === currentGesture)?.label || currentGesture}
          </div>
        </div>
      )}
    </div>
  )
}
```

### Paso 2: Integrar en PesajeForm

```typescript
// src/components/almacen/PesajeForm.tsx
'use client'

import { useState } from 'react'
import { GestureControl } from '@/components/gestures/GestureControl'
import { Hand, CheckCircle, ArrowRight, Fist } from 'lucide-react'

export function PesajeForm({ presupuesto, itemsPesables, presupuestoId }: PesajeFormProps) {
  const [currentItemIndex, setCurrentItemIndex] = useState(0)
  const [gestureEnabled, setGestureEnabled] = useState(false)
  
  // ... código existente ...

  const currentItem = itemsPesables[currentItemIndex]

  // Configuración de gestos para pesaje
  const gestureActions = [
    {
      gesture: 'open_hand',
      action: () => {
        // Confirmar peso actual y pasar al siguiente
        if (currentItem?.peso_final) {
          if (currentItemIndex < itemsPesables.length - 1) {
            setCurrentItemIndex(currentItemIndex + 1)
          }
        }
      },
      label: 'Confirmar y Siguiente',
      icon: <Hand />
    },
    {
      gesture: 'victory',
      action: () => {
        // Cambiar entre presupuestos (navegación)
        // Esto requeriría una lista de presupuestos disponibles
        console.log('Cambiar presupuesto')
      },
      label: 'Cambiar Presupuesto',
      icon: <CheckCircle />
    },
    {
      gesture: 'pinch',
      action: () => {
        // Ajustar peso manualmente (abre modal o input)
        // Por ahora, solo muestra feedback
        console.log('Ajustar peso')
      },
      label: 'Ajustar Peso',
      icon: <ArrowRight />
    },
    {
      gesture: 'fist',
      action: () => {
        // Finalizar presupuesto si todos están pesados
        if (todosPesados) {
          handleFinalizarPesaje()
        }
      },
      label: 'Finalizar Presupuesto',
      icon: <Fist />
    }
  ]

  return (
    <div className="space-y-6">
      {/* Toggle para activar/desactivar gestos */}
      <div className="flex justify-end">
        <button
          onClick={() => setGestureEnabled(!gestureEnabled)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            gestureEnabled 
              ? 'bg-[#2F7058] text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          {gestureEnabled ? '🎥 Gestos Activados' : '🎥 Activar Gestos'}
        </button>
      </div>

      {/* Contenido del formulario existente */}
      {/* ... código del formulario ... */}

      {/* Componente de control gestual */}
      <GestureControl
        enabled={gestureEnabled}
        gestures={gestureActions}
        showFeedback={true}
        onGestureDetected={(gesture) => {
          console.log('Gesto detectado:', gesture)
        }}
      />
    </div>
  )
}
```

---

## 🎨 Mejoras de UX

### Indicador Visual de Gestos Disponibles

```typescript
// Agregar al inicio del formulario
{gestureEnabled && (
  <Card className="bg-blue-50 border-blue-200">
    <CardContent className="pt-6">
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <Hand className="mx-auto h-8 w-8 text-blue-600 mb-2" />
          <p className="text-sm font-medium">Mano abierta</p>
          <p className="text-xs text-gray-600">Confirmar y siguiente</p>
        </div>
        <div>
          <CheckCircle className="mx-auto h-8 w-8 text-blue-600 mb-2" />
          <p className="text-sm font-medium">✌️ Victoria</p>
          <p className="text-xs text-gray-600">Cambiar presupuesto</p>
        </div>
        <div>
          <ArrowRight className="mx-auto h-8 w-8 text-blue-600 mb-2" />
          <p className="text-sm font-medium">🤏 Pinza</p>
          <p className="text-xs text-gray-600">Ajustar peso</p>
        </div>
        <div>
          <Fist className="mx-auto h-8 w-8 text-blue-600 mb-2" />
          <p className="text-sm font-medium">👊 Puño</p>
          <p className="text-xs text-gray-600">Finalizar</p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

---

## 🔒 Validaciones de Seguridad

### Confirmación para Acciones Críticas

```typescript
const handleFinalizarConGesto = () => {
  // Mostrar confirmación antes de finalizar
  if (window.confirm('¿Finalizar presupuesto? Todos los items deben estar pesados.')) {
    handleFinalizarPesaje()
  }
}
```

---

## 📱 Optimización para Tablets/Dispositivos Móviles

### Detección de Dispositivo

```typescript
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
)

// Ajustar sensibilidad según dispositivo
const pinchThreshold = isMobile ? 0.1 : 0.08
```

---

## 🧪 Pruebas

### Checklist de Pruebas

- [ ] Gestos se detectan correctamente
- [ ] Acciones se ejecutan sin errores
- [ ] Feedback visual es claro
- [ ] No hay conflictos con entrada manual
- [ ] Funciona con guantes (si aplica)
- [ ] Rendimiento es aceptable (60fps)
- [ ] Batería no se drena excesivamente

---

## 🚀 Próximos Pasos

1. **Integrar en PesajeForm**: Agregar el componente `GestureControl`
2. **Pruebas con usuarios**: Validar con almacenistas reales
3. **Ajustar sensibilidad**: Calibrar según feedback
4. **Expandir a otros módulos**: Reparto, Recepción, etc.

---

*Ejemplo creado: Diciembre 2025*

