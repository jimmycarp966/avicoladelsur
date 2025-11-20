/**
 * Adapter Interface para Integración de Balanza
 * 
 * Este módulo proporciona una interfaz abstracta para integrar diferentes tipos de balanzas:
 * - Balanzas HTTP-enabled (REST API)
 * - Balanzas Serial (RS-232, USB)
 * - Balanzas Bluetooth
 * 
 * Para integrar una balanza real, implementa la interfaz BalanzaAdapter y crea una instancia
 * del tipo correspondiente.
 */

export interface PesoData {
  peso: number // Peso en kilogramos
  unidad: 'kg' | 'g' | 'lb'
  timestamp: Date
  estable?: boolean // Si el peso está estable (no oscilando)
  error?: string // Mensaje de error si hubo problema
}

export interface BalanzaAdapter {
  /**
   * Conecta a la balanza
   * @returns Promise que resuelve cuando la conexión está establecida
   */
  conectar(): Promise<void>

  /**
   * Desconecta de la balanza
   */
  desconectar(): Promise<void>

  /**
   * Obtiene el peso actual de la balanza
   * @returns Promise con los datos del peso
   */
  leerPeso(): Promise<PesoData>

  /**
   * Verifica si la balanza está conectada
   */
  estaConectada(): boolean

  /**
   * Obtiene información de la balanza (modelo, versión, etc.)
   */
  obtenerInfo(): Promise<{ modelo?: string; version?: string; [key: string]: any }>
}

/**
 * Implementación Mock para desarrollo y testing
 * Simula una balanza que devuelve pesos aleatorios
 */
export class BalanzaMockAdapter implements BalanzaAdapter {
  private conectada = false
  private pesoBase = 0

  async conectar(): Promise<void> {
    this.conectada = true
    // Simular tiempo de conexión
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  async desconectar(): Promise<void> {
    this.conectada = false
  }

  async leerPeso(): Promise<PesoData> {
    if (!this.conectada) {
      throw new Error('Balanza no conectada')
    }

    // Simular variación de peso (±10%)
    const variacion = (Math.random() - 0.5) * 0.2 // ±10%
    const peso = this.pesoBase * (1 + variacion)

    return {
      peso: Math.max(0, peso),
      unidad: 'kg',
      timestamp: new Date(),
      estable: Math.random() > 0.3, // 70% de probabilidad de estar estable
    }
  }

  estaConectada(): boolean {
    return this.conectada
  }

  async obtenerInfo(): Promise<{ modelo?: string; version?: string }> {
    return {
      modelo: 'Balanza Mock',
      version: '1.0.0',
    }
  }

  /**
   * Método específico del mock para establecer peso base
   */
  setPesoBase(peso: number): void {
    this.pesoBase = peso
  }
}

/**
 * Implementación para balanzas HTTP-enabled
 * Útil para balanzas que exponen una API REST
 */
export class BalanzaHTTPAdapter implements BalanzaAdapter {
  private url: string
  private apiKey?: string
  private conectada = false

  constructor(url: string, apiKey?: string) {
    this.url = url
    this.apiKey = apiKey
  }

  async conectar(): Promise<void> {
    try {
      const response = await fetch(`${this.url}/status`, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
      })

      if (!response.ok) {
        throw new Error(`Error conectando a balanza: ${response.statusText}`)
      }

      this.conectada = true
    } catch (error) {
      throw new Error(`No se pudo conectar a la balanza: ${error}`)
    }
  }

  async desconectar(): Promise<void> {
    this.conectada = false
  }

  async leerPeso(): Promise<PesoData> {
    if (!this.conectada) {
      throw new Error('Balanza no conectada')
    }

    try {
      const response = await fetch(`${this.url}/peso`, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
      })

      if (!response.ok) {
        throw new Error(`Error leyendo peso: ${response.statusText}`)
      }

      const data = await response.json()

      return {
        peso: data.peso || data.weight || 0,
        unidad: data.unidad || data.unit || 'kg',
        timestamp: new Date(data.timestamp || Date.now()),
        estable: data.estable !== undefined ? data.estable : data.stable !== undefined ? data.stable : true,
      }
    } catch (error) {
      return {
        peso: 0,
        unidad: 'kg',
        timestamp: new Date(),
        estable: false,
        error: `Error leyendo peso: ${error}`,
      }
    }
  }

  estaConectada(): boolean {
    return this.conectada
  }

  async obtenerInfo(): Promise<{ modelo?: string; version?: string; [key: string]: any }> {
    try {
      const response = await fetch(`${this.url}/info`, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
      })

      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error('Error obteniendo info de balanza:', error)
    }

    return {}
  }
}

/**
 * Factory para crear adapters según configuración
 */
export class BalanzaAdapterFactory {
  /**
   * Crea un adapter basado en la configuración del entorno
   */
  static crearAdapter(): BalanzaAdapter {
    const tipo = process.env.BALANZA_TIPO || 'mock'
    const url = process.env.BALANZA_URL
    const apiKey = process.env.BALANZA_API_KEY

    switch (tipo.toLowerCase()) {
      case 'http':
      case 'rest':
      case 'api':
        if (!url) {
          throw new Error('BALANZA_URL es requerido para adapters HTTP')
        }
        return new BalanzaHTTPAdapter(url, apiKey)

      case 'mock':
      case 'simulada':
      default:
        return new BalanzaMockAdapter()
    }
  }
}

/**
 * Ejemplo de uso:
 * 
 * ```typescript
 * // En desarrollo/testing
 * const balanza = BalanzaAdapterFactory.crearAdapter()
 * await balanza.conectar()
 * const peso = await balanza.leerPeso()
 * console.log(`Peso: ${peso.peso} ${peso.unidad}`)
 * 
 * // En producción con balanza HTTP
 * // Variables de entorno:
 * // BALANZA_TIPO=http
 * // BALANZA_URL=http://192.168.1.100:8080
 * // BALANZA_API_KEY=tu-api-key
 * ```
 * 
 * Para balanzas Serial/Bluetooth, crear nuevas implementaciones:
 * 
 * ```typescript
 * export class BalanzaSerialAdapter implements BalanzaAdapter {
 *   // Implementación usando librerías como 'serialport' o 'node-bluetooth-serial-port'
 * }
 * ```
 */
