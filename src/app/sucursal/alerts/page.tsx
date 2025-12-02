import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { getSucursalUsuario } from '@/lib/utils'
import { AlertasContent } from '@/components/shared/AlertasContent'

interface AlertaStock {
  id: string
  sucursal_id: string
  producto_id: string
  cantidad_actual: number
  umbral: number
  estado: 'pendiente' | 'en_transito' | 'resuelto'
  created_at: string
  updated_at: string
}

async function getAlertasSucursal() {
  const supabase = createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario
  const sucursalId = await getSucursalUsuario(supabase, user.id)

  if (!sucursalId) {
    throw new Error('Usuario no tiene sucursal asignada')
  }

  // Obtener alertas
  const { data: alertas, error: alertasError } = await supabase
    .from('alertas_stock')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .order('created_at', { ascending: false })

  if (alertasError) {
    throw new Error('Error al obtener alertas')
  }

  return {
    alertas: alertas || [],
    estadisticas: {
      pendientes: alertas.filter(a => a.estado === 'pendiente').length,
      resueltas: alertas.filter(a => a.estado !== 'pendiente').length,
      total: alertas.length
    }
  }
}

export default async function SucursalAlertsPage() {
  try {
    const data = await getAlertasSucursal()

    return <AlertasContent data={data} />
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar alertas</h3>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
