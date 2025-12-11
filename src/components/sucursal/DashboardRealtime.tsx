'use client'

import { useEffect, useState } from 'react'
import { useRealtime } from '@/lib/hooks/useRealtime'

interface DashboardRealtimeProps {
  sucursalId: string
  onVentasUpdate?: (ventas: any[]) => void
  onAlertasUpdate?: (alertas: any[]) => void
  onCajaUpdate?: (caja: any) => void
  onTransferenciasUpdate?: (transferencias: any[]) => void
}

/**
 * Componente que maneja las actualizaciones en tiempo real del dashboard de sucursal
 */
export function DashboardRealtime({
  sucursalId,
  onVentasUpdate,
  onAlertasUpdate,
  onCajaUpdate,
  onTransferenciasUpdate,
}: DashboardRealtimeProps) {
  const [ventasDia, setVentasDia] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [caja, setCaja] = useState<any>(null)
  const [transferencias, setTransferencias] = useState<any[]>([])

  // Realtime: Suscribirse a nuevos pedidos completados
  useRealtime({
    table: 'pedidos',
    event: '*',
    filter: `sucursal_id=eq.${sucursalId}`,
    onInsert: (payload) => {
      const pedido = payload.new as any
      // Solo contar pedidos completados del día actual
      const hoy = new Date().toISOString().split('T')[0]
      const fechaPedido = new Date(pedido.created_at).toISOString().split('T')[0]
      
      if (pedido.estado === 'completado' && fechaPedido === hoy) {
        setVentasDia((prev) => {
          const nuevas = [...prev, pedido]
          onVentasUpdate?.(nuevas)
          return nuevas
        })
      }
    },
    onUpdate: (payload) => {
      const pedido = payload.new as any
      const hoy = new Date().toISOString().split('T')[0]
      const fechaPedido = new Date(pedido.created_at).toISOString().split('T')[0]
      
      if (pedido.estado === 'completado' && fechaPedido === hoy) {
        setVentasDia((prev) => {
          const index = prev.findIndex((v) => v.id === pedido.id)
          if (index >= 0) {
            const nuevas = [...prev]
            nuevas[index] = pedido
            onVentasUpdate?.(nuevas)
            return nuevas
          } else {
            const nuevas = [...prev, pedido]
            onVentasUpdate?.(nuevas)
            return nuevas
          }
        })
      } else {
        // Si el pedido ya no está completado o no es del día, removerlo
        setVentasDia((prev) => {
          const nuevas = prev.filter((v) => v.id !== pedido.id)
          onVentasUpdate?.(nuevas)
          return nuevas
        })
      }
    }
  })

  // Realtime: Suscribirse a nuevas alertas de stock
  useRealtime({
    table: 'alertas_stock',
    event: '*',
    filter: `sucursal_id=eq.${sucursalId}`,
    onInsert: (payload) => {
      const alerta = payload.new as any
      if (alerta.estado === 'pendiente') {
        setAlertas((prev) => {
          const nuevas = [...prev, alerta]
          onAlertasUpdate?.(nuevas)
          
          // Mostrar notificación push si es crítica
          if (alerta.prioridad === 'critico' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('⚠️ Alerta de Stock Crítica', {
              body: `Producto con stock crítico en ${sucursalId}`,
              icon: '/images/logo-avicola.svg',
            })
          }
          
          return nuevas
        })
      }
    },
    onUpdate: (payload) => {
      const alerta = payload.new as any
      setAlertas((prev) => {
        if (alerta.estado === 'pendiente') {
          const index = prev.findIndex((a) => a.id === alerta.id)
          if (index >= 0) {
            const nuevas = [...prev]
            nuevas[index] = alerta
            onAlertasUpdate?.(nuevas)
            return nuevas
          } else {
            const nuevas = [...prev, alerta]
            onAlertasUpdate?.(nuevas)
            return nuevas
          }
        } else {
          // Si la alerta ya no está pendiente, removerla
          const nuevas = prev.filter((a) => a.id !== alerta.id)
          onAlertasUpdate?.(nuevas)
          return nuevas
        }
      })
    }
  })

  // Realtime: Suscribirse a cambios en caja
  useRealtime({
    table: 'tesoreria_cajas',
    event: 'UPDATE',
    filter: `sucursal_id=eq.${sucursalId}`,
    onUpdate: (payload) => {
      const cajaData = payload.new as any
      if (cajaData.active) {
        setCaja(cajaData)
        onCajaUpdate?.(cajaData)
      }
    }
  })

  // Realtime: Suscribirse a cambios en transferencias
  useRealtime({
    table: 'transferencias_stock',
    event: '*',
    filter: `sucursal_origen_id=eq.${sucursalId},sucursal_destino_id=eq.${sucursalId}`,
    onInsert: (payload) => {
      const transferencia = payload.new as any
      if (transferencia.estado === 'pendiente' || transferencia.estado === 'en_transito') {
        setTransferencias((prev) => {
          const nuevas = [...prev, transferencia]
          onTransferenciasUpdate?.(nuevas)
          return nuevas
        })
      }
    },
    onUpdate: (payload) => {
      const transferencia = payload.new as any
      setTransferencias((prev) => {
        if (transferencia.estado === 'pendiente' || transferencia.estado === 'en_transito') {
          const index = prev.findIndex((t) => t.id === transferencia.id)
          if (index >= 0) {
            const nuevas = [...prev]
            nuevas[index] = transferencia
            onTransferenciasUpdate?.(nuevas)
            return nuevas
          } else {
            const nuevas = [...prev, transferencia]
            onTransferenciasUpdate?.(nuevas)
            return nuevas
          }
        } else {
          // Si la transferencia ya no está pendiente o en tránsito, removerla
          const nuevas = prev.filter((t) => t.id !== transferencia.id)
          onTransferenciasUpdate?.(nuevas)
          return nuevas
        }
      })
    }
  })

  // Cargar datos iniciales
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        const hoy = new Date().toISOString().split('T')[0]
        
        // Cargar ventas del día
        const ventasRes = await fetch(`/api/tesoreria/movimientos-tiempo-real?sucursal_id=${sucursalId}&fecha=${hoy}`)
        if (ventasRes.ok) {
          const ventasData = await ventasRes.json()
          if (ventasData.success) {
            setVentasDia(ventasData.data?.pedidos || [])
            onVentasUpdate?.(ventasData.data?.pedidos || [])
          }
        }

        // Cargar alertas
        const alertasRes = await fetch(`/api/sucursales/${sucursalId}/alerts`)
        if (alertasRes.ok) {
          const alertasData = await alertasRes.json()
          if (alertasData.success) {
            const alertasPendientes = (alertasData.data || []).filter((a: any) => a.estado === 'pendiente')
            setAlertas(alertasPendientes)
            onAlertasUpdate?.(alertasPendientes)
          }
        }

        // Cargar caja
        const cajaRes = await fetch(`/api/tesoreria/cajas?sucursal_id=${sucursalId}`)
        if (cajaRes.ok) {
          const cajaData = await cajaRes.json()
          if (cajaData.success && cajaData.data?.length > 0) {
            const cajaActiva = cajaData.data.find((c: any) => c.active)
            if (cajaActiva) {
              setCaja(cajaActiva)
              onCajaUpdate?.(cajaActiva)
            }
          }
        }

        // Cargar transferencias
        const transferenciasRes = await fetch(`/api/sucursales/transferencias?sucursal_id=${sucursalId}`)
        if (transferenciasRes.ok) {
          const transferenciasData = await transferenciasRes.json()
          if (transferenciasData.success) {
            const transferenciasPendientes = (transferenciasData.data || []).filter(
              (t: any) => t.estado === 'pendiente' || t.estado === 'en_transito'
            )
            setTransferencias(transferenciasPendientes)
            onTransferenciasUpdate?.(transferenciasPendientes)
          }
        }
      } catch (error) {
        console.error('[DashboardRealtime] Error cargando datos iniciales:', error)
      }
    }

    if (sucursalId) {
      cargarDatosIniciales()
    }
  }, [sucursalId, onVentasUpdate, onAlertasUpdate, onCajaUpdate, onTransferenciasUpdate])

  // Solicitar permiso para notificaciones
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  return null // Este componente no renderiza nada, solo maneja Realtime
}

