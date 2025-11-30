'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { crearRutasMockMonteros } from '@/actions/reparto.actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function GenerarRutasMockButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleGenerarRutas() {
    console.log('🎯 [BUTTON] Botón "Generar Rutas Mock" presionado')
    setLoading(true)
    try {
      // Primero limpiar datos mock anteriores
      console.log('🧹 [CLEAN] Iniciando limpieza de datos mock anteriores')
      toast.info('Limpiando datos mock anteriores...')
      const cleanRes = await fetch('/api/reparto/limpiar-mock', {
        method: 'DELETE'
      })

      if (cleanRes.ok) {
        const cleanData = await cleanRes.json()
        console.log('🧹 [CLEAN] Respuesta del endpoint limpiar-mock:', cleanData)
        if (cleanData.success && cleanData.data) {
          const totalEliminados = Object.values(cleanData.data as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
          toast.success(`${totalEliminados} registros anteriores eliminados`)
        } else {
          console.log('🧹 [CLEAN] No se eliminaron datos anteriores o respuesta sin data:', cleanData)
          toast.info('No había datos mock anteriores para eliminar')
        }
      } else {
        console.error('🧹 [CLEAN] Error en la respuesta del endpoint limpiar-mock:', cleanRes.status, cleanRes.statusText)
      }

      // Esperar un momento para que se procesen las eliminaciones
      await new Promise(resolve => setTimeout(resolve, 500))

      // Generar nuevas rutas mock
      console.log('🏗️ [GENERATE] Iniciando generación de rutas mock')
      toast.info('Generando nuevas rutas mock...')
      const result = await crearRutasMockMonteros(2, 7)
      console.log('🏗️ [GENERATE] Resultado completo de crearRutasMockMonteros:', result)

      if (result.success) {
        console.log('✅ [SUCCESS] Rutas creadas exitosamente:', result.data?.rutasCreadas)
        toast.success(result.message || 'Rutas mock generadas exitosamente')
      } else {
        console.error('❌ [ERROR] Error generando rutas:', result.error)
        toast.error(result.error || 'Error al generar rutas mock')
      }

      if (result.success) {
        toast.success(result.message || 'Rutas mock generadas exitosamente')

        // Esperar un momento antes de refrescar para que se completen las inserciones
        setTimeout(() => {
          router.refresh()
        }, 1000)
      } else {
        toast.error(result.error || 'Error al generar rutas mock')
      }
    } catch (error: any) {
      console.error('❌ [ERROR] Error en GenerarRutasMockButton:', error)
      console.error('❌ [ERROR] Stack trace:', error.stack)
      toast.error(error.message || 'Error al generar rutas mock')
    } finally {
      console.log('🔄 [FINISH] Finalizando proceso de generación de rutas mock')
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleGenerarRutas}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Generar Rutas Mock (Monteros)
        </>
      )}
    </Button>
  )
}

