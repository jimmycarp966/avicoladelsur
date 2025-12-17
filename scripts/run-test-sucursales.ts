/**
 * Script de ejecución del Robot de Pruebas
 * =========================================
 * 
 * Ejecuta las pruebas E2E del módulo de sucursales
 * 
 * Uso: npm run test:sucursales
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Cargar variables de entorno
config({ path: resolve(__dirname, '..', '.env.local') })

// Importar y ejecutar el robot
import './test-sucursales-robot'
