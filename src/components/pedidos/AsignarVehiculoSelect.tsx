'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Truck, AlertTriangle } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerVehiculosAction } from '@/actions/reparto.actions'
import { asignarPedidoARutaConVehiculo } from '@/actions/reparto.actions'

interface Vehiculo {
  id: string
  patente: string
  marca?: string
  modelo?: string
  capacidad_kg?: number
}

interface AsignarVehiculoSelectProps {
  pedidoId: string
  numeroPedido: string
  estado: string
  pesoTotal: number
  onSuccess?: () => void
}

export function AsignarVehiculoSelect({ 
  pedidoId, 
  numeroPedido, 
  estado, 
  pesoTotal,
  onSuccess 
}: AsignarVehiculoSelectProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(false)
  const [loadingVehiculos, setLoadingVehiculos] = useState(true)
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<string>('')

  // Solo mostrar si el pedido está en estado 'preparando'
  if (estado !== 'preparando') {
    return null
  }

  useEffect(() => {
    const cargarVehiculos = async () => {
      setLoadingVehiculos(true)
      try {
        const result = await obtenerVehiculosAction()
        if (result.success && result.data) {
          setVehiculos(result.data)
          // Seleccionar automáticamente el vehículo más chico (menor capacidad)
          if (result.data.length > 0) {
            const vehiculoMasChico = result.data.reduce((menor, actual) => {
              const capacidadMenor = menor.capacidad_kg || Infinity
              const capacidadActual = actual.capacidad_kg || Infinity
              return capacidadActual < capacidadMenor ? actual : menor
            })
            setVehiculoSeleccionado(vehiculoMasChico.id)
          }
        }
      } catch (error) {
        console.error('Error cargando vehículos:', error)
      } finally {
        setLoadingVehiculos(false)
      }
    }
    cargarVehiculos()
  }, [])

  const handleAsignar = async () => {
    if (!vehiculoSeleccionado) {
      showToast('error', 'Selecciona un vehículo')
      return
    }

    try {
      setLoading(true)
      const result = await asignarPedidoARutaConVehiculo(pedidoId, vehiculoSeleccionado)
      
      if (result.success) {
        showToast(
          'success',
          result.message || `Pedido ${numeroPedido} asignado a ruta exitosamente`
        )
        
        if (onSuccess) {
          onSuccess()
        } else {
          router.refresh()
        }
      } else {
        showToast(
          'error',
          result.error || 'Error al asignar pedido a ruta'
        )
      }
    } catch (error: any) {
      console.error('Error al asignar pedido a ruta:', error)
      showToast('error', error.message || 'Error al asignar pedido a ruta')
    } finally {
      setLoading(false)
    }
  }

  const vehiculoInfo = vehiculos.find(v => v.id === vehiculoSeleccionado)
  const superaCapacidad = vehiculoInfo?.capacidad_kg && pesoTotal > vehiculoInfo.capacidad_kg

  return (
    <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
      <p className="text-sm font-medium">Asignar a Ruta con Vehículo</p>
      
      <Select 
        value={vehiculoSeleccionado} 
        onValueChange={setVehiculoSeleccionado}
        disabled={loadingVehiculos || loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={loadingVehiculos ? "Cargando..." : "Seleccionar vehículo"} />
        </SelectTrigger>
        <SelectContent>
          {vehiculos.map((vehiculo) => {
            const excede = vehiculo.capacidad_kg && pesoTotal > vehiculo.capacidad_kg
            return (
              <SelectItem key={vehiculo.id} value={vehiculo.id}>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  <span>
                    {vehiculo.marca && vehiculo.modelo 
                      ? `${vehiculo.marca} ${vehiculo.modelo}`
                      : vehiculo.modelo 
                        ? vehiculo.modelo
                        : vehiculo.patente}
                  </span>
                  {vehiculo.patente && (
                    <span className="text-xs text-muted-foreground">
                      ({vehiculo.patente})
                    </span>
                  )}
                  {vehiculo.capacidad_kg && (
                    <span className={`text-xs ${excede ? 'text-red-500' : 'text-muted-foreground'}`}>
                      - {vehiculo.capacidad_kg} kg
                    </span>
                  )}
                  {excede && <AlertTriangle className="h-3 w-3 text-red-500" />}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      {superaCapacidad && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
          <AlertTriangle className="h-4 w-4" />
          <span>
            El peso del pedido ({pesoTotal.toFixed(2)} kg) supera la capacidad del vehículo ({vehiculoInfo?.capacidad_kg} kg). 
            Se asignará de todas formas.
          </span>
        </div>
      )}

      <Button
        onClick={handleAsignar}
        disabled={loading || !vehiculoSeleccionado}
        className="w-full"
        size="sm"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Asignando...
          </>
        ) : (
          <>
            <Truck className="mr-2 h-4 w-4" />
            Asignar a Ruta
          </>
        )}
      </Button>
    </div>
  )
}

