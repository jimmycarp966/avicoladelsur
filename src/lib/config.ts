// Configuración general de la aplicación
export const config = {
  app: {
    name: 'Avícola del Sur ERP',
    version: '1.0.0',
    description: 'Sistema de Gestión Integral para Avícola del Sur',
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  botpress: {
    webhookUrl: process.env.BOTPRESS_WEBHOOK_URL,
    apiKey: process.env.BOTPRESS_API_KEY,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  },
  rutas: {
    homeBase: {
      nombre: 'Casa Central Monteros',
      lat: -27.176861754312416,
      lng: -65.51203507261263,
    },
    returnToBase: true,
  },
}

// Roles del sistema
export const ROLES = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
  REPARTIDOR: 'repartidor',
  ALMACENISTA: 'almacenista',
} as const

export type UserRole = typeof ROLES[keyof typeof ROLES]

// Estados de pedidos
export const ESTADOS_PEDIDO = {
  PENDIENTE: 'pendiente',
  CONFIRMADO: 'confirmado',
  PREPARANDO: 'preparando',
  ENVIADO: 'enviado',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
} as const

export type EstadoPedido = typeof ESTADOS_PEDIDO[keyof typeof ESTADOS_PEDIDO]

// Estados de entregas
export const ESTADOS_ENTREGA = {
  PENDIENTE: 'pendiente',
  EN_CAMINO: 'en_camino',
  ENTREGADO: 'entregado',
  FALLIDO: 'fallido',
} as const

export type EstadoEntrega = typeof ESTADOS_ENTREGA[keyof typeof ESTADOS_ENTREGA]

// Paleta de colores basada en el logo
export const colors = {
  primary: {
    green: '#2D5A27',
    yellow: '#F4C430',
    red: '#D32F2F',
  },
  secondary: {
    dark: '#1B3A1F',
    light: '#4A7C59',
    orange: '#E65100',
  },
  neutral: {
    white: '#FFFFFF',
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
  },
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
}
