import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, formatDistance, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime, format as formatTz } from 'date-fns-tz'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ===========================================
// UTILIDADES DE TIMEZONE GMT-3 (Argentina)
// ===========================================

const TIMEZONE_ARGENTINA = 'America/Argentina/Buenos_Aires'

function parseArgentinaDateValue(value: string | Date): Date {
  if (value instanceof Date) return value

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0, 0)
  }

  return parseISO(value)
}

/**
 * Obtiene la fecha/hora actual en timezone de Argentina (GMT-3)
 * @returns Date con la fecha/hora actual en Argentina
 */
export function getNowArgentina(): Date {
  const now = new Date()
  // Convertir la hora actual a timezone de Argentina
  return toZonedTime(now, TIMEZONE_ARGENTINA)
}

/**
 * Obtiene la fecha de hoy en timezone de Argentina (GMT-3)
 * @returns string en formato YYYY-MM-DD
 */
export function getTodayArgentina(): string {
  const today = getNowArgentina()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Utilidades de formato de fecha
/**
 * Formatea una fecha mostrándola en timezone de Argentina (GMT-3)
 * @param date - Fecha a formatear (string ISO, Date, null o undefined)
 * @param formatString - Formato deseado (por defecto 'dd/MM/yyyy')
 * @returns Fecha formateada en timezone de Argentina
 */
export function formatDate(date: string | Date | null | undefined, formatString: string = 'dd/MM/yyyy') {
  if (!date) {
    return '-'
  }
  
  try {
    const dateObj = parseArgentinaDateValue(date)
    if (!dateObj || isNaN(dateObj.getTime())) {
      return '-'
    }
    
    // Convertir a timezone de Argentina antes de formatear
    const dateInArgentina = toZonedTime(dateObj, TIMEZONE_ARGENTINA)
    return formatTz(dateInArgentina, formatString, { 
      timeZone: TIMEZONE_ARGENTINA,
      locale: es 
    })
  } catch (error) {
    console.error('Error formatting date:', error)
    return '-'
  }
}

export function formatTime(
  time: string | Date | null | undefined,
  formatString: string = 'HH:mm'
) {
  if (!time) {
    return '-'
  }

  try {
    const dateObj =
      typeof time === 'string'
        ? // Si viene sólo la hora (HH:mm o HH:mm:ss), crear una fecha ficticia
          (time.length <= 8 && time.includes(':')
            ? (() => {
                const [hours, minutes, seconds = '0'] = time.split(':')
                const d = getNowArgentina()
                d.setHours(Number(hours), Number(minutes), Number(seconds), 0)
                return d
              })()
            : parseISO(time))
        : time

    if (!dateObj || isNaN(dateObj.getTime())) {
      return '-'
    }

    const dateInArgentina = toZonedTime(dateObj, TIMEZONE_ARGENTINA)
    return formatTz(dateInArgentina, formatString, {
      timeZone: TIMEZONE_ARGENTINA,
      locale: es,
    })
  } catch (error) {
    console.error('Error formatting time:', error)
    return '-'
  }
}

export function formatRelativeDate(date: string | Date | null | undefined) {
  if (!date) {
    return '-'
  }
  
  try {
    const dateObj = parseArgentinaDateValue(date)
    if (!dateObj || isNaN(dateObj.getTime())) {
      return '-'
    }
    // Convertir a timezone de Argentina para cálculos relativos
    const dateInArgentina = toZonedTime(dateObj, TIMEZONE_ARGENTINA)
    const nowInArgentina = getNowArgentina()
    return formatDistance(dateInArgentina, nowInArgentina, { 
      addSuffix: true, 
      locale: es
    })
  } catch (error) {
    console.error('Error formatting relative date:', error)
    return '-'
  }
}

// Utilidades de formato de moneda
function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatDecimalString(value: number, decimals: number): string {
  const safeDecimals = Math.max(0, Math.trunc(decimals))
  const absoluteValue = Math.abs(value)
  const fixedValue = absoluteValue.toFixed(safeDecimals)
  const [integerPart, decimalPart] = fixedValue.split('.')
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = value < 0 ? '-' : ''

  if (safeDecimals === 0) {
    return `${sign}${groupedInteger}`
  }

  return `${sign}${groupedInteger},${decimalPart}`
}

export function formatCurrency(amount: number | string | null | undefined, currency: string = 'ARS') {
  const safeAmount = toFiniteNumber(amount) ?? 0
  const normalizedCurrency = currency.toUpperCase()
  const decimals = normalizedCurrency === 'ARS' ? 0 : 2
  const symbols: Record<string, string> = {
    ARS: '$',
    USD: 'US$',
    EUR: 'EUR ',
  }
  const prefix = symbols[normalizedCurrency] ?? `${normalizedCurrency} `

  return `${prefix}${formatDecimalString(safeAmount, decimals)}`
}

// Utilidades de formato de números
export function formatNumber(num: number | string | null | undefined, decimals: number = 2) {
  return formatDecimalString(toFiniteNumber(num) ?? 0, decimals)
}

export function formatFixed(
  value: number | string | null | undefined,
  decimals: number = 2,
  fallback: string = '0.00'
) {
  const safeNumber = toFiniteNumber(value)
  return safeNumber == null ? fallback : safeNumber.toFixed(decimals)
}

// Utilidades para arrays y objetos
export function isEmpty(obj: any): boolean {
  if (obj == null) return true
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0
  if (typeof obj === 'object') return Object.keys(obj).length === 0
  return false
}

// Utilidades para validación
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[0-9+\-\s()]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10
}

// Utilidades para generar IDs únicos
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

// Utilidades para truncar texto
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Utilidades para sleep/delay
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Utilidades para coordenadas GPS
export function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

// Utilidades para calcular distancias (fórmula de Haversine)
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Utilidades para formato de duración
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0s'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

  return parts.join(' ')
}

/**
 * Obtiene la sucursal asignada a un usuario desde la tabla rrhh_empleados
 * @param supabase - Cliente de Supabase
 * @param userId - ID del usuario autenticado
 * @returns ID de la sucursal o null si no tiene asignada
 */
export async function getSucursalUsuario(supabase: any, userId: string): Promise<string | null> {
  try {
    // Consulta directa usando la política RLS "empleados_read_own"
    // Esta política permite que usuarios lean su propio registro
    const { data: empleado, error } = await supabase
      .from('rrhh_empleados')
      .select('sucursal_id')
      .eq('usuario_id', userId)
      .eq('activo', true)
      .maybeSingle() // Usa maybeSingle() en lugar de single() para evitar error si no hay registro

    // Si hay error, loguear detalles para diagnóstico
    if (error) {
      // Si el error es porque no se encontró registro (PGRST116), es normal
      if (error.code !== 'PGRST116') {
        console.error('Error al obtener sucursal del usuario:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId
        })
      }
      return null
    }

    // Si no hay empleado o no tiene sucursal_id, retornar null
    if (!empleado?.sucursal_id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Usuario sin sucursal asignada:', { userId, empleado })
      }
      return null
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Sucursal obtenida para usuario:', { userId, sucursalId: empleado.sucursal_id })
    }

    return empleado.sucursal_id
  } catch (error) {
    console.error('Error al obtener sucursal del usuario:', error)
    return null
  }
}

/**
 * Obtiene la sucursal del usuario con soporte para admins
 * Si el usuario es admin y no tiene sucursal asignada, intenta obtener la primera sucursal activa
 * @param supabase - Cliente de Supabase
 * @param userId - ID del usuario autenticado
 * @param userEmail - Email del usuario (para verificar rol)
 * @returns ID de la sucursal o null si no tiene asignada y no es admin
 */
export async function getSucursalUsuarioConAdmin(
  supabase: any,
  userId: string,
  userEmail: string,
  sidParam?: string
): Promise<{ sucursalId: string | null; esAdmin: boolean }> {
  // Obtener rol del usuario
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('email', userEmail)
    .single()

  const esAdmin = usuarioData?.rol === 'admin'

  // Si es admin y hay un parámetro sid en la URL, validar y usar ese (permite cambiar de sucursal)
  if (esAdmin && sidParam) {
    const { data: sucursalParam } = await supabase
      .from('sucursales')
      .select('id, active')
      .eq('id', sidParam)
      .single()
    
    if (sucursalParam && sucursalParam.active) {
      return { sucursalId: sidParam, esAdmin: true }
    }
  }

  // Obtener sucursal del usuario
  const sucursalId = await getSucursalUsuario(supabase, userId)

  // Si es admin y no tiene sucursal asignada, obtener la primera sucursal activa
  let sucursalIdFinal = sucursalId
  if (!sucursalIdFinal && esAdmin) {
    const { data: sucursalesActivas } = await supabase
      .from('sucursales')
      .select('id')
      .eq('active', true)
      .order('nombre')
      .limit(1)
    
    if (sucursalesActivas && sucursalesActivas.length > 0) {
      sucursalIdFinal = sucursalesActivas[0].id
    }
  }

  return { sucursalId: sucursalIdFinal, esAdmin }
}

// Helper para determinar si es venta mayorista
// Función pura sin dependencias del servidor (puede usarse en client components)
export function esVentaMayorista(presupuesto: any, item: any): boolean {
  // Verificar si la lista del presupuesto es mayorista
  const tipoLista = presupuesto?.lista_precio?.tipo || item?.lista_precio?.tipo
  if (tipoLista !== 'mayorista') {
    return false
  }

  // Verificar si el producto tiene venta mayor habilitada
  return item.producto?.venta_mayor_habilitada === true
}
