/**
 * GET /api/avisos
 * 
 * Devuelve avisos (novedades RRHH y alertas de stock) según el scope
 * Query params: scope (admin | sucursal | rrhh), sucursal_id?
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTodayArgentina } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const scope = (searchParams.get('scope') || 'admin') as 'admin' | 'sucursal' | 'rrhh'
    const sucursalId = searchParams.get('sucursal_id') || null

    const avisos: Array<{
      id: string
      tipo: 'novedad' | 'alerta_stock'
      titulo: string
      mensaje: string
      prioridad: 'urgente' | 'alta' | 'normal' | 'baja'
      fecha: string
      activo: boolean
      metadata?: any
    }> = []

    // Obtener novedades RRHH según scope
    if (scope === 'rrhh' || scope === 'admin' || scope === 'sucursal') {
      let novedadesQuery = supabase
        .from('rrhh_novedades')
        .select('id, titulo, descripcion, prioridad, fecha_publicacion, fecha_expiracion, activo, tipo')
        .eq('activo', true)
        .lte('fecha_publicacion', getTodayArgentina())
        .order('fecha_publicacion', { ascending: false })
        .limit(10)

      // Si es scope sucursal, filtrar por sucursal
      if (scope === 'sucursal' && sucursalId) {
        novedadesQuery = novedadesQuery.or(`sucursal_id.eq.${sucursalId},tipo.eq.general`)
      }

      const { data: novedades } = await novedadesQuery

      novedades?.forEach((novedad) => {
        // Verificar si expiró
        const fechaExpiracion = novedad.fecha_expiracion
        const hoy = getTodayArgentina()
        if (fechaExpiracion && fechaExpiracion < hoy) {
          return // Saltar novedades expiradas
        }

        avisos.push({
          id: novedad.id,
          tipo: 'novedad',
          titulo: novedad.titulo,
          mensaje: novedad.descripcion || '',
          prioridad: (novedad.prioridad as 'urgente' | 'alta' | 'normal' | 'baja') || 'normal',
          fecha: novedad.fecha_publicacion,
          activo: novedad.activo,
        })
      })
    }

    // Obtener alertas de stock según scope
    if (scope === 'sucursal' || scope === 'admin') {
      let alertasQuery = supabase
        .from('alertas_stock')
        .select(`
          id,
          cantidad_actual,
          umbral,
          estado,
          created_at,
          producto:productos(id, nombre, codigo)
        `)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(10)

      // Si es scope sucursal, filtrar por sucursal
      if (scope === 'sucursal' && sucursalId) {
        alertasQuery = alertasQuery.eq('sucursal_id', sucursalId)
      }

      const { data: alertas } = await alertasQuery

      alertas?.forEach((alerta) => {
        const producto = Array.isArray(alerta.producto) ? alerta.producto[0] : alerta.producto
        const porcentajeStock = alerta.umbral > 0
          ? (alerta.cantidad_actual / alerta.umbral) * 100
          : 0

        // Determinar prioridad según porcentaje de stock
        let prioridad: 'urgente' | 'alta' | 'normal' | 'baja' = 'normal'
        if (porcentajeStock < 20) {
          prioridad = 'urgente'
        } else if (porcentajeStock < 50) {
          prioridad = 'alta'
        }

        avisos.push({
          id: alerta.id,
          tipo: 'alerta_stock',
          titulo: `Stock bajo: ${producto?.nombre || 'Producto'}`,
          mensaje: `Quedan solo ${alerta.cantidad_actual} ${producto?.codigo || ''}. Umbral: ${alerta.umbral}`,
          prioridad,
          fecha: alerta.created_at,
          activo: true,
          metadata: {
            producto: {
              id: producto?.id,
              nombre: producto?.nombre,
              codigo: producto?.codigo,
            },
            cantidadActual: alerta.cantidad_actual,
            umbral: alerta.umbral,
          },
        })
      })
    }

    // Ordenar por fecha descendente
    avisos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    return NextResponse.json({
      success: true,
      data: avisos,
    })
  } catch (error: any) {
    console.error('Error en /api/avisos:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener avisos' },
      { status: 500 }
    )
  }
}

