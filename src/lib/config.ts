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
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    region: process.env.GOOGLE_CLOUD_REGION || 'southamerica-east1',
    serviceAccount: {
      // Base64 encoded JSON (producción) o ruta al archivo (desarrollo)
      base64: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64,
      path: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH,
    },
    maps: {
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
      fleetRoutingApiKey: process.env.GOOGLE_MAPS_FLEET_ROUTING_API_KEY,
    },
    optimization: {
      enabled: process.env.GOOGLE_OPTIMIZATION_API_ENABLED === 'true',
    },
    dialogflow: {
      projectId: process.env.GOOGLE_DIALOGFLOW_PROJECT_ID,
      agentId: process.env.GOOGLE_DIALOGFLOW_AGENT_ID,
      languageCode: process.env.GOOGLE_DIALOGFLOW_LANGUAGE_CODE || 'es-AR',
    },
    speechToText: {
      enabled: process.env.GOOGLE_SPEECH_TO_TEXT_ENABLED === 'true',
      languageCode: process.env.GOOGLE_SPEECH_TO_TEXT_LANGUAGE_CODE || 'es-AR',
    },
    documentAI: {
      projectId: process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID,
      location: process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us',
      processors: {
        facturas: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS,
        remitos: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS,
      },
    },
    vertexAI: {
      enabled: process.env.GOOGLE_VERTEX_AI_ENABLED === 'true',
      location: process.env.GOOGLE_VERTEX_AI_LOCATION || 'us-central1',
    },
    automl: {
      enabled: process.env.GOOGLE_AUTOML_ENABLED === 'true',
      location: process.env.GOOGLE_AUTOML_LOCATION || 'us-central1',
    },
    gemini: {
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      model: process.env.GOOGLE_GEMINI_MODEL || 'gemini-3-pro-preview',
      location: process.env.GOOGLE_GEMINI_LOCATION || 'us-central1',
    },
  },
}

// Roles del sistema
export const ROLES = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
  REPARTIDOR: 'repartidor',
  ALMACENISTA: 'almacenista',
  TESORERO: 'tesorero',
  SUCURSAL: 'sucursal',
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

// Paleta de colores basada en la página web de Avícola del Sur
export const colors = {
  primary: {
    green: '#2F7058', // Verde oscuro de la página web
    yellow: '#FCDE8D', // Amarillo/Crema de la página web
    red: '#CB3433', // Rojo de la página web
  },
  secondary: {
    dark: '#255a47', // Verde oscuro más intenso
    light: '#D9EBC6', // Verde claro de la página web
    orange: '#CB3433', // Usar rojo en lugar de naranja
  },
  neutral: {
    white: '#FFFFFF',
    gray: {
      50: '#F5F7F9', // Gris muy claro de la página web
      100: '#F5F7F9',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#7A7A7A', // Gris claro de la página web
      500: '#43474E', // Gris medio de la página web
      600: '#334155', // Gris oscuro de la página web (foreground)
      700: '#334155',
      800: '#0E131B', // Gris muy oscuro de la página web
      900: '#0E131B',
    },
  },
  status: {
    success: '#2F7058', // Verde oscuro de la página web
    warning: '#FCDE8D', // Amarillo/Crema de la página web
    error: '#CB3433', // Rojo de la página web
    info: '#43474E', // Gris medio de la página web
  },
}
