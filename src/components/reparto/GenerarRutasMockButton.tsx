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
    setLoading(true)
    try {
      // Primero limpiar datos mock anteriores
      toast.info('Limpiando datos mock anteriores...')
      const cleanRes = await fetch('/api/reparto/limpiar-mock', {
        method: 'DELETE'
      })

      if (cleanRes.ok) {
        const cleanData = await cleanRes.json()
        if (cleanData.success) {
          const totalEliminados = Object.values(cleanData.data as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
          toast.success(`${totalEliminados} registros anteriores eliminados`)
        }
      }

      // Esperar un momento para que se procesen las eliminaciones
      await new Promise(resolve => setTimeout(resolve, 500))

      // Generar nuevas rutas mock
      toast.info('Generando nuevas rutas mock...')
      const result = await crearRutasMockMonteros(2, 7)

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
      toast.error(error.message || 'Error al generar rutas mock')
    } finally {
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

