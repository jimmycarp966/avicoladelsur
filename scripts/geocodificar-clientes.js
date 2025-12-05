#!/usr/bin/env node
/**
 * Script para geocodificar direcciones de clientes usando Google Maps Geocoding API
 * 
 * Uso: node scripts/geocodificar-clientes.js
 * 
 * Requisitos:
 * - Variables de entorno configuradas en .env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - GOOGLE_MAPS_API_KEY o NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * 
 * Funcionalidad:
 * - Lee lista de clientes con direcciones
 * - Busca cada cliente por código en la base de datos
 * - Geocodifica direcciones usando Google Maps API
 * - Actualiza dirección y coordenadas en la BD
 * - Genera log detallado en consola y archivo
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
require('dotenv').config({ path: '.env.local' })

// ============================================
// CONFIGURACIÓN
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

// Delay entre requests a Google API (en ms)
const DELAY_MS = 1500

// Casos especiales a omitir
const CASOS_ESPECIALES = ['RETIRA', 'COMPRA GALPON', 'COMPRA CASA CENTRAL', 'CASA CENTRAL']

// ============================================
// LISTA DE CLIENTES A PROCESAR
// ============================================

const clientesAProcesar = [
  { codigo: '2', nombre: 'HORQUETA (P)', domicilio: 'COLON 750', localidad: 'MONTEROS' },
  { codigo: '3', nombre: 'SAN MARTIN (P)', domicilio: 'SAN MARTIN 325', localidad: 'MONTEROS' },
  { codigo: '4', nombre: 'ALBERDI (P)', domicilio: 'ALBERDI 145', localidad: 'MONTEROS' },
  { codigo: '101', nombre: 'ALICIA VAQUERA', domicilio: 'ALBERDI 836', localidad: 'MONTEROS' },
  { codigo: '102', nombre: 'SOLEDAD ORELLANA', domicilio: 'CONGRESO 174', localidad: 'MONTEROS' },
  { codigo: '103', nombre: 'PAOLA ARDILES', domicilio: 'CRISOSTOMO ALVAREZ Y MONZON', localidad: 'MONTEROS' },
  { codigo: '104', nombre: 'POLLERIA MONTEAGUDO', domicilio: 'MONTEAGUDO 193', localidad: 'MONTEROS' },
  { codigo: '107', nombre: 'ALMENDRA', domicilio: 'LEANDRO ARAOZ 273', localidad: 'MONTEROS' },
  { codigo: '110', nombre: 'WALTER NIEVA', domicilio: 'AYACUCHO Y MANUEL VAQUERA', localidad: 'MONTEROS' },
  { codigo: '116', nombre: 'POLLERIA LA 5TA', domicilio: 'BARRIO 150 (24 SEP 970)', localidad: 'MONTEROS' },
  { codigo: '123', nombre: 'POLLERIA ENZO', domicilio: 'ESPAÑA 510', localidad: 'MONTEROS' },
  { codigo: '124', nombre: 'POLLERIA LA GRINGA', domicilio: 'COLON 898', localidad: 'MONTEROS' },
  { codigo: '125', nombre: 'EMILIA MARKET', domicilio: 'ESQUINA RIVADAVIA Y JUJUY', localidad: 'MONTEROS' },
  { codigo: '126', nombre: 'CARLOS CORONEL', domicilio: 'ESQUINA CHILE Y LAPRIDA', localidad: 'MONTEROS' },
  { codigo: '129', nombre: 'ALE FERNANDEZ', domicilio: 'COLON 739', localidad: 'MONTEROS' },
  { codigo: '134', nombre: 'POLLERIA LA PATRONA', domicilio: 'ALBERDI Y MONZON', localidad: 'MONTEROS' },
  { codigo: '137', nombre: 'LEO KISI', domicilio: 'SAN MARTIN 1186', localidad: 'MONTEROS' },
  { codigo: '139', nombre: 'BAR SCARAMANZIA', domicilio: 'DIEGO DE VILLARROEL 148', localidad: 'MONTEROS' },
  { codigo: '140', nombre: 'BETO CORREA', domicilio: 'B° ALBERDI (CENTRO COMERCIAL)', localidad: 'MONTEROS' },
  { codigo: '143', nombre: 'POLLERIA AMERICO PAEZ', domicilio: 'B° 105 VIVIENDAS', localidad: 'MONTEROS' },
  { codigo: '146', nombre: 'POLLERIA MONZON', domicilio: 'MONZON 465', localidad: 'MONTEROS' },
  { codigo: '149', nombre: 'CRISTIAN COSTILLA', domicilio: 'RETIRA DEL GALPON', localidad: 'MONTEROS' },
  { codigo: '159', nombre: 'POLLERIA JUAREZ', domicilio: 'CABILDO 824 - B° AEROCLUB', localidad: 'MONTEROS' },
  { codigo: '160', nombre: 'MIMI ORELLANA', domicilio: 'DIAGONAL DEL SANATORIO ROSARIO', localidad: 'MONTEROS' },
  { codigo: '161', nombre: 'FRANCO CORREA', domicilio: 'B°50 VIVIENDA.MZ A, C. 17', localidad: 'MONTEROS' },
  { codigo: '164', nombre: 'ROSA VILLAGRA', domicilio: '9 DE JULIO 821', localidad: 'MONTEROS' },
  { codigo: '167', nombre: 'JUAN NIEVA', domicilio: 'SAN LORENZO 962', localidad: 'MONTEROS' },
  { codigo: '169', nombre: 'PANADERIA DAVID', domicilio: 'COLON 588', localidad: 'MONTEROS' },
  { codigo: '173', nombre: 'POLLERIA LA ARGENTINA', domicilio: 'TUCUMAN AL 700', localidad: 'MONTEROS' },
  { codigo: '174', nombre: 'DARIO PAEZ', domicilio: '9 DE JULIO 9', localidad: 'MONTEROS' },
  { codigo: '176', nombre: 'POLLERIA TOMASITO', domicilio: 'CONGRESO Y 24 DE SEPTIEMBRE', localidad: 'MONTEROS' },
  { codigo: '184', nombre: 'MARTIN ELIAS', domicilio: 'ROCA Y DIEGO DE VILLAROEL', localidad: 'MONTEROS' },
  { codigo: '187', nombre: 'MONICA NUÑEZ', domicilio: 'YAPEYU 60 (FRENTE ESC MATAD)', localidad: 'MONTEROS' },
  { codigo: '188', nombre: 'BAR FIKA (MONTEROS)', domicilio: 'LEANDRO ARAOZ 98', localidad: 'MONTEROS' },
  { codigo: '189', nombre: 'DESPENSA E Y F', domicilio: 'BARRIO MUTUAL MZ C CASA 10', localidad: 'MONTEROS' },
  { codigo: '195', nombre: 'POLLERIA LA 24', domicilio: '24 DE SEPTIEMBRE 898', localidad: 'MONTEROS' },
  { codigo: '197', nombre: 'JUAN JOSE OLEA', domicilio: 'RETIRA DE GALPON', localidad: 'MONTEROS' },
  { codigo: '209', nombre: 'LA PORTEÑA', domicilio: 'CALLE MONTEAGUDO', localidad: 'MONTEROS' },
  { codigo: '216', nombre: 'GUSTAVO OLEA', domicilio: 'RETIRA DEL GALPON', localidad: 'MONTEROS' },
  { codigo: '218', nombre: 'ROBERTO ARGAÑARAZ', domicilio: 'MONTEAGUDO 394', localidad: 'MONTEROS' },
  { codigo: '221', nombre: 'OMAR FERNANDEZ', domicilio: 'RETIRA DEL GALPON', localidad: 'MONTEROS' },
  { codigo: '228', nombre: 'VALERIA ALBORNOZ', domicilio: 'RIVADAVIA 1071 CASA 26', localidad: 'MONTEROS' },
  { codigo: '230', nombre: 'LUCAS LOPEZ', domicilio: 'CONGRESO 663', localidad: 'MONTEROS' },
  { codigo: '232', nombre: 'MAIRA CORONEL', domicilio: 'SARMIENTO 333', localidad: 'MONTEROS' },
  { codigo: '246', nombre: 'POLLERIA BMP', domicilio: 'PEDRO OTTONELLO 810 Bº MODELO', localidad: 'MONTEROS' },
  { codigo: '248', nombre: 'MANUELA MEDINA', domicilio: 'CONGRESO PRIMERA CUADRA', localidad: 'MONTEROS' },
  { codigo: '253', nombre: 'POLLERIA J Y E', domicilio: 'COLON 1011', localidad: 'MONTEROS' },
  { codigo: '254', nombre: 'POLLERIA TETE', domicilio: 'MAYPU Y SANTA FE', localidad: 'MONTEROS' },
  { codigo: '261', nombre: 'GOMEZ ENRIQUE', domicilio: 'COMPRA GALPON', localidad: 'MONTEROS' },
  { codigo: '263', nombre: 'NORMA GAUNA', domicilio: 'COMPRA GALPON', localidad: 'MONTEROS' },
  { codigo: '266', nombre: 'SILVIA GONZALES', domicilio: 'COMPRA GALPON', localidad: 'MONTEROS' },
  { codigo: '275', nombre: 'POLLERIA JD', domicilio: '9 DE JULIO Y RIVADAVIA', localidad: 'MONTEROS' },
  { codigo: '278', nombre: 'ELINA ALBORNOZ', domicilio: 'RETIRA DE GALPON', localidad: 'MONTEROS' },
  { codigo: '280', nombre: 'PUNTO TINCHO', domicilio: 'ÑUÑORCO 393', localidad: 'MONTEROS' },
  { codigo: '286', nombre: 'JEREZ ROSA', domicilio: 'COMPRA CASA CENTRAL', localidad: 'MONTEROS' },
  { codigo: '290', nombre: 'ARIEL ALDERETE', domicilio: 'JUJUY 237', localidad: 'MONTEROS' },
  { codigo: '291', nombre: 'VALERIA JIMENEZ', domicilio: 'DORREGO 745 - VILLA NUEVA', localidad: 'MONTEROS' },
  { codigo: '296', nombre: 'OPEN24HS', domicilio: 'URQUIZA 181', localidad: 'MONTEROS' },
  { codigo: '297', nombre: 'IVANA NORRY', domicilio: 'COLON 1376 B ÑUÑORCO', localidad: 'MONTEROS' },
  { codigo: '298', nombre: 'ANTONIA PONCE', domicilio: 'SIMON BOLIVAR 125', localidad: 'MONTEROS' },
  { codigo: '301', nombre: 'MARTIN NORRY', domicilio: 'URUGUAY 139 ESQ PARAGUAY', localidad: 'MONTEROS' },
  { codigo: '304', nombre: 'JONATAN FIGUEROA', domicilio: 'COMPRA GALPON', localidad: 'MONTEROS' },
  { codigo: '318', nombre: 'NANCY TEJEDA', domicilio: 'ESPAÑA 585 BARRIO IBATIN', localidad: 'MONTEROS' },
  { codigo: '323', nombre: 'ALICIA GALVAN', domicilio: '2 DE ABRIL 873 B°SAN CARLOS', localidad: 'MONTEROS' },
  { codigo: '324', nombre: 'ARROYO RODOLFO', domicilio: 'COMPRA GALPON', localidad: 'MONTEROS' },
  { codigo: '329', nombre: 'MARIA JOSE CASTILLO', domicilio: 'MANUEL VAQUERA 169', localidad: 'MONTEROS' },
  { codigo: '343', nombre: 'HUGO SALES', domicilio: 'CALLE 25 DE MAYO Y SAN MARTIN', localidad: 'MONTEROS' },
  { codigo: '345', nombre: 'DESPENSA PEDRO', domicilio: 'COLON 1150', localidad: 'MONTEROS' },
  { codigo: '348', nombre: 'SUPER CARNES FREDY', domicilio: 'CATAMARCA 129', localidad: 'MONTEROS' },
  { codigo: '352', nombre: 'DESPENSA DOÑA RAMONA', domicilio: 'TAFI DEL VALLE', localidad: 'MONTEROS' },
  { codigo: '353', nombre: 'CASINO RITZ', domicilio: '25 DE MAYO 37', localidad: 'MONTEROS' },
  { codigo: '354', nombre: 'LUIS NADAL', domicilio: 'TUCUMAN 684', localidad: 'MONTEROS' },
  { codigo: '361', nombre: 'MERCEDES MANCA (KIOSCO LA TUCU)', domicilio: 'DOMINGO ARAOZ 570', localidad: 'MONTEROS' },
  { codigo: '366', nombre: 'KARINA TREJO', domicilio: 'B° BELGRANO FRENTE DISPESARIO', localidad: 'MONTEROS' },
  { codigo: '389', nombre: 'LUIS HERRERA', domicilio: 'COLON AL 600', localidad: 'MONTEROS' },
  { codigo: '392', nombre: 'TOMAS GIMENEZ', domicilio: 'SILVANO BORES Y PJE CENTEN.', localidad: 'MONTEROS' },
  { codigo: '396', nombre: 'WALTER CADONI', domicilio: 'B° EUCALIPTUS', localidad: 'MONTEROS' },
  { codigo: '407', nombre: 'POLLERIA EL PACARA', domicilio: 'SAN MARTIN 970', localidad: 'MONTEROS' },
  { codigo: '418', nombre: 'MARIA MANSILLA', domicilio: 'SAN LORENZO 880', localidad: 'MONTEROS' },
  { codigo: '434', nombre: 'CARNICERIA EL PORTEÑO', domicilio: 'FLORENTINO AMEGUINO Y ALB.EIN', localidad: 'MONTEROS' },
  { codigo: '436', nombre: 'POLLERIA TOLEDO', domicilio: '25 DE MAYO Y ESQ MONZON', localidad: 'MONTEROS' },
  { codigo: '438', nombre: 'CLUB MONTEROS VOLEY', domicilio: 'RUTA 325', localidad: 'MONTEROS' },
  { codigo: '447', nombre: 'FRANCO VAQUERA', domicilio: 'SAN MARTIN 340', localidad: 'MONTEROS' },
  { codigo: '459', nombre: 'PABLO HEREDIA', domicilio: 'RETIRA DEL GALPON', localidad: 'MONTEROS' },
  { codigo: '460', nombre: 'MARIA JIMENA MOLINA', domicilio: 'SAN LORENZO 950 (CASA PARTIC.)', localidad: 'MONTEROS' },
  { codigo: '461', nombre: 'POLLERIA COMERCIAL', domicilio: 'CRISOSTOMO ALVAREZ 1090', localidad: 'MONTEROS' },
  { codigo: '473', nombre: 'IVAN SORIA', domicilio: 'RIVADAVIA 60', localidad: 'MONTEROS' },
  { codigo: '483', nombre: 'MARIA NIETO', domicilio: 'RETIRA DEL GALPON', localidad: 'MONTEROS' },
  { codigo: '484', nombre: 'JOSE MIGUEL LLORENS', domicilio: 'RETIRA DEL GALPON', localidad: 'MONTEROS' },
  { codigo: '490', nombre: 'POLLERIA JYE', domicilio: 'LAPRIDA 346', localidad: 'MONTEROS' },
  { codigo: '492', nombre: 'POLLERIA DEL VALLE', domicilio: 'B° EUCALIPTO MZA C CASA 16', localidad: 'MONTEROS' },
  { codigo: '494', nombre: 'MARIELA MEDINA', domicilio: 'URUGUAY 150', localidad: 'MONTEROS' },
  { codigo: '498', nombre: 'ZOZINE SILVIA', domicilio: 'FRIAS SILVA 978', localidad: 'MONTEROS' },
  { codigo: '506', nombre: 'RAUL NUÑEZ', domicilio: 'BARRIO EL TEJAR', localidad: 'MONTEROS' },
  { codigo: '508', nombre: 'CRISTINA ZOZINE', domicilio: 'FRIA SILVA 978', localidad: 'MONTEROS' },
  { codigo: '510', nombre: 'RAUL CAYO', domicilio: 'PASO LAS LECHERAS', localidad: 'MONTEROS' },
  { codigo: '527', nombre: 'POLLERIA AVILA', domicilio: 'MARIANO MORENO 18', localidad: 'MONTEROS' },
  { codigo: '528', nombre: 'POLLERIA MAURICIO', domicilio: 'SAN LORENZO 173', localidad: 'MONTEROS' },
  { codigo: '534', nombre: 'DAMIAN HERRERA', domicilio: 'ENTRADA A LA COSTA Y R38', localidad: 'MONTEROS' },
  { codigo: '551', nombre: 'CARNICERIA HUGO', domicilio: 'B IBATIN (MONTEAGUDO Y ESPAÑA)', localidad: 'MONTEROS' },
  { codigo: '558', nombre: 'MONONA ORELLANA', domicilio: 'B 150 VIVIENDA MANZ A CASA 17', localidad: 'MONTEROS' },
  { codigo: '560', nombre: 'ROSARIO ALE', domicilio: 'CHILE Y LAPRIDA', localidad: 'MONTEROS' },
  { codigo: '562', nombre: 'AZUCENA VILLAGRA (LOLI)', domicilio: 'LAVALLE 229 BARRIO NORTE', localidad: 'MONTEROS' },
  { codigo: '565', nombre: 'MARIA AGUIRRE', domicilio: 'COLON 1208 66 VIV.(MONOBLOCK)', localidad: 'MONTEROS' },
  { codigo: '567', nombre: 'ANALIA AVILA', domicilio: 'YONOPONGO', localidad: 'MONTEROS' },
  { codigo: '575', nombre: 'CARNICERIA SAN TORO', domicilio: 'SARMIENTO 344', localidad: 'MONTEROS' },
  { codigo: '588', nombre: 'AGUSTIN OLEA', domicilio: 'PJE PASTEUR 253', localidad: 'MONTEROS' },
  { codigo: '589', nombre: 'WALTER DIP', domicilio: 'MONZON 595', localidad: 'MONTEROS' },
  { codigo: '592', nombre: 'DESPENSA EL MELLI', domicilio: 'SARMIENTO 480', localidad: 'MONTEROS' },
  { codigo: '604', nombre: 'BIANCA SALGUERO', domicilio: 'B° 150 MANZANA F CASA 2', localidad: 'MONTEROS' },
  { codigo: '605', nombre: 'MAXI LESCANO', domicilio: 'MARIANO MORENO 106', localidad: 'MONTEROS' },
  { codigo: '608', nombre: 'SUPER CARNES GUILLERMINA', domicilio: 'MARIANO MORENO 248', localidad: 'MONTEROS' },
  { codigo: '613', nombre: 'IVANA DOMINGUEZ', domicilio: 'ENTRE RIOS 970', localidad: 'MONTEROS' },
  { codigo: '614', nombre: 'GABRIELA SALAS', domicilio: 'AVENIDA ROCA 319', localidad: 'MONTEROS' },
  { codigo: '624', nombre: 'GUADALUPE CHUMBA', domicilio: 'COLON 1208', localidad: 'MONTEROS' },
  { codigo: '626', nombre: 'ALDO MOYA', domicilio: 'CALCHAQUI 524', localidad: 'MONTEROS' },
  { codigo: '630', nombre: 'JESICA ROMANO', domicilio: 'LA RIOJA 296 B° VILLA ALCIRA', localidad: 'MONTEROS' },
  { codigo: '631', nombre: 'VERONICA FIGUEROA', domicilio: 'BARRIO 150 MANZANA E CASA 14', localidad: 'MONTEROS' },
  { codigo: '634', nombre: 'HERNAN DIAZ', domicilio: 'RIVADAVIA 950 C° 52', localidad: 'MONTEROS' },
  { codigo: '637', nombre: 'BAR DE RODI', domicilio: 'AYACUCHO 780', localidad: 'MONTEROS' },
  { codigo: '640', nombre: 'JESUS RIVADENEIRA', domicilio: 'LAS PIEDRAS 308', localidad: 'MONTEROS' },
  { codigo: '661', nombre: 'MARLEN PERALTA', domicilio: 'B° EUCALIPTO (CAMINO A SIMOCA)', localidad: 'MONTEROS' },
  { codigo: '665', nombre: 'POLLERIA ISABELA', domicilio: 'COLON 665', localidad: 'MONTEROS' },
  { codigo: '699', nombre: 'WILLIAM FONTEÑO', domicilio: 'FLORENTINO AMEGUINO 1284', localidad: 'MONTEROS' },
  { codigo: '713', nombre: 'BEATRIZ MOLINA', domicilio: 'GREGORIO ALFARO 316', localidad: 'MONTEROS' },
  { codigo: '715', nombre: 'FERNANDA VAQUERA', domicilio: 'TUCUMAN 815', localidad: 'MONTEROS' },
  { codigo: '726', nombre: 'GABRIEL DELGADO', domicilio: 'DIEGO DE VILLARROEL 76', localidad: 'MONTEROS' },
  { codigo: '734', nombre: 'NATALIA LAZARTE', domicilio: 'AVENIDA DIEGO DE VILLARROEL 76', localidad: 'MONTEROS' },
  { codigo: '750', nombre: 'MINISERVICE URKUPIÑA', domicilio: 'FEDERICO MORENO 850', localidad: 'MONTEROS' },
  { codigo: '752', nombre: 'MARIA QUINTEROS', domicilio: 'SANTIAGO Y RUTA 325', localidad: 'MONTEROS' },
  { codigo: '753', nombre: 'POLLERIA LA NORTEÑITA', domicilio: 'ESPAÑA 9 FRENTE HELADER SEI TU', localidad: 'MONTEROS' },
  { codigo: '761', nombre: 'CLAUDIO TRIPOLONI', domicilio: 'RETIRA DEL GALPON', localidad: 'MONTEROS' },
  { codigo: '762', nombre: 'CARLOS COSTILLA', domicilio: 'CALCHAQUI 509 B° MATADEROS', localidad: 'MONTEROS' },
  { codigo: '773', nombre: 'DESPENSA CRIS', domicilio: 'SAAVEDRA 471 B° AEROCLUB', localidad: 'MONTEROS' },
  { codigo: '776', nombre: 'PATRICIA VELIZ', domicilio: 'SIMON BOLIVAR 341', localidad: 'MONTEROS' },
  { codigo: '779', nombre: 'MARCOS EZEQUIEL ORELLANA', domicilio: '4 DE OCTUBRE 156', localidad: 'MONTEROS' },
  { codigo: '781', nombre: 'AZAR MARIA MARCELA', domicilio: 'ESQ. CATAMARCA Y FRIA B°SAN CA', localidad: 'MONTEROS' },
  { codigo: '789', nombre: 'GRACIELA GONZALEZ', domicilio: 'CERCA DEL RIO MANDOLO', localidad: 'MONTEROS' },
  { codigo: '790', nombre: 'MARTA MOLINA', domicilio: 'YAPEYU 59', localidad: 'MONTEROS' },
  { codigo: '792', nombre: 'MARU PAEZ', domicilio: 'SAN MARTIN 630', localidad: 'MONTEROS' },
]

// ============================================
// UTILIDADES
// ============================================

// Array para acumular logs
const logEntries = []

// Función para loguear con timestamp
function log(mensaje, tipo = 'INFO') {
  const timestamp = new Date().toISOString()
  const linea = `[${timestamp}] [${tipo}] ${mensaje}`
  console.log(linea)
  logEntries.push(linea)
}

// Función para esperar
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Verificar si es caso especial (omitir)
function esCasoEspecial(domicilio) {
  if (!domicilio) return true
  const upper = domicilio.toUpperCase()
  return CASOS_ESPECIALES.some(caso => upper.includes(caso))
}

// Construir dirección completa
function construirDireccionCompleta(domicilio, localidad) {
  // Limpiar caracteres especiales y notas entre paréntesis
  let direccionLimpia = domicilio
    .replace(/\(.*?\)/g, '') // Eliminar contenido entre paréntesis
    .replace(/B°/g, 'BARRIO ') // Expandir abreviatura de barrio
    .replace(/Bº/g, 'BARRIO ')
    .replace(/MZ\s?/gi, 'MANZANA ')
    .replace(/C\.\s?/gi, 'CASA ')
    .replace(/ESQ\.?/gi, 'ESQUINA ')
    .replace(/PJE\.?/gi, 'PASAJE ')
    .replace(/\s+/g, ' ') // Múltiples espacios a uno
    .trim()
  
  return `${direccionLimpia}, ${localidad}, Tucumán, Argentina`
}

// Geocodificar dirección usando Google Maps API
async function geocodificarDireccion(direccion) {
  if (!GOOGLE_API_KEY) {
    return { success: false, error: 'API key de Google Maps no configurada' }
  }

  try {
    const encodedAddress = encodeURIComponent(direccion)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_API_KEY}`

    const response = await fetch(url)
    
    if (!response.ok) {
      return { success: false, error: `Error HTTP: ${response.status}` }
    }

    const data = await response.json()

    switch (data.status) {
      case 'OK':
        if (data.results && data.results.length > 0) {
          const result = data.results[0]
          return {
            success: true,
            data: {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
              direccion_formateada: result.formatted_address
            }
          }
        }
        return { success: false, error: 'No se encontraron resultados' }

      case 'ZERO_RESULTS':
        return { success: false, error: 'No se encontraron coordenadas para esta dirección' }

      case 'OVER_QUERY_LIMIT':
        return { success: false, error: 'Límite de consultas excedido' }

      case 'REQUEST_DENIED':
        return { success: false, error: 'Solicitud denegada. Verifica la API key.' }

      default:
        return { success: false, error: `Error de Google: ${data.status}` }
    }
  } catch (error) {
    return { success: false, error: `Error de red: ${error.message}` }
  }
}

// Buscar cliente por código en la base de datos
async function buscarClientePorCodigo(codigo) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, codigo, nombre, direccion, coordenadas')
    .eq('codigo', codigo)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Error al buscar cliente: ${error.message}`)
  }

  return data
}

// Actualizar cliente en la base de datos
async function actualizarClienteEnBD(clienteId, direccion, coordenadas) {
  let updateData = {
    direccion,
    updated_at: new Date().toISOString()
  }

  if (coordenadas) {
    // Formato PostGIS EWKT
    updateData.coordenadas = `SRID=4326;POINT(${coordenadas.lng} ${coordenadas.lat})`
  }

  const { error } = await supabase
    .from('clientes')
    .update(updateData)
    .eq('id', clienteId)

  if (error) {
    throw new Error(`Error al actualizar cliente: ${error.message}`)
  }
}

// Pedir confirmación al usuario
function pedirConfirmacion(mensaje) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => {
    rl.question(mensaje, respuesta => {
      rl.close()
      resolve(respuesta.toLowerCase() === 's' || respuesta.toLowerCase() === 'si')
    })
  })
}

// Guardar log en archivo
function guardarLogEnArchivo() {
  const logsDir = path.join(process.cwd(), 'logs')
  
  // Crear directorio logs si no existe
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logPath = path.join(logsDir, `geocodificacion-${timestamp}.log`)
  
  fs.writeFileSync(logPath, logEntries.join('\n'), 'utf8')
  
  return logPath
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  GEOCODIFICACIÓN MASIVA DE CLIENTES - AVÍCOLA DEL SUR')
  console.log('='.repeat(60) + '\n')

  // Validación inicial
  log('Verificando configuración...')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    log('ERROR: NEXT_PUBLIC_SUPABASE_URL no configurada', 'ERROR')
    process.exit(1)
  }

  if (!GOOGLE_API_KEY) {
    log('ERROR: GOOGLE_MAPS_API_KEY no configurada', 'ERROR')
    log('Configura GOOGLE_MAPS_API_KEY o NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env.local', 'ERROR')
    process.exit(1)
  }

  log(`✅ Supabase configurado: ${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...`)
  log(`✅ Google Maps API configurada: ${GOOGLE_API_KEY.substring(0, 10)}...`)

  // Análisis de clientes a procesar
  log('\nAnalizando clientes a procesar...')
  
  const clientesNormales = clientesAProcesar.filter(c => !esCasoEspecial(c.domicilio))
  const clientesEspeciales = clientesAProcesar.filter(c => esCasoEspecial(c.domicilio))

  console.log('\n' + '-'.repeat(60))
  console.log(`  Total de clientes en la lista:    ${clientesAProcesar.length}`)
  console.log(`  Clientes a geocodificar:          ${clientesNormales.length}`)
  console.log(`  Clientes a omitir (especiales):   ${clientesEspeciales.length}`)
  console.log('-'.repeat(60))

  if (clientesEspeciales.length > 0) {
    console.log('\n📋 Clientes que serán OMITIDOS (casos especiales):')
    clientesEspeciales.forEach(c => {
      console.log(`   - ${c.codigo}: ${c.nombre} → "${c.domicilio}"`)
    })
  }

  console.log('\n📍 Clientes que serán PROCESADOS (primeros 10):')
  clientesNormales.slice(0, 10).forEach(c => {
    const direccionCompleta = construirDireccionCompleta(c.domicilio, c.localidad)
    console.log(`   - ${c.codigo}: ${c.nombre}`)
    console.log(`     "${c.domicilio}" → "${direccionCompleta}"`)
  })
  if (clientesNormales.length > 10) {
    console.log(`   ... y ${clientesNormales.length - 10} clientes más`)
  }

  console.log('\n' + '-'.repeat(60))
  console.log(`  ⏱️  Tiempo estimado: ~${Math.ceil(clientesNormales.length * DELAY_MS / 60000)} minutos`)
  console.log(`  📝 Se generará log en: logs/geocodificacion-{timestamp}.log`)
  console.log('-'.repeat(60) + '\n')

  // Pedir confirmación
  const confirmado = await pedirConfirmacion('¿Deseas continuar con la geocodificación? (s/n): ')
  
  if (!confirmado) {
    log('❌ Proceso cancelado por el usuario')
    process.exit(0)
  }

  console.log('\n')
  log('🚀 Iniciando geocodificación...\n')

  // Contadores
  const resultados = {
    exitosos: 0,
    solodireccion: 0, // Actualizó dirección pero no coordenadas
    omitidos: 0,
    noEncontrados: 0,
    errores: []
  }

  // Procesar clientes
  for (let i = 0; i < clientesAProcesar.length; i++) {
    const cliente = clientesAProcesar[i]
    const progreso = `[${i + 1}/${clientesAProcesar.length}]`

    // Omitir casos especiales
    if (esCasoEspecial(cliente.domicilio)) {
      log(`${progreso} ⏭️  OMITIDO ${cliente.codigo} - ${cliente.nombre}: Caso especial (${cliente.domicilio})`)
      resultados.omitidos++
      continue
    }

    // Buscar cliente en BD
    let clienteBD
    try {
      clienteBD = await buscarClientePorCodigo(cliente.codigo)
    } catch (error) {
      log(`${progreso} ❌ ERROR ${cliente.codigo} - ${cliente.nombre}: ${error.message}`, 'ERROR')
      resultados.errores.push({ codigo: cliente.codigo, error: error.message })
      continue
    }

    if (!clienteBD) {
      log(`${progreso} ⚠️  NO ENCONTRADO ${cliente.codigo} - ${cliente.nombre}: No existe en BD`)
      resultados.noEncontrados++
      continue
    }

    // Construir dirección completa
    const direccionCompleta = construirDireccionCompleta(cliente.domicilio, cliente.localidad)

    // Geocodificar
    const geoResult = await geocodificarDireccion(direccionCompleta)

    if (geoResult.success) {
      // Actualizar con dirección y coordenadas
      try {
        await actualizarClienteEnBD(
          clienteBD.id,
          cliente.domicilio, // Guardamos la dirección original (sin localidad)
          geoResult.data
        )
        log(`${progreso} ✅ ÉXITO ${cliente.codigo} - ${cliente.nombre}: ${geoResult.data.lat.toFixed(6)}, ${geoResult.data.lng.toFixed(6)}`)
        resultados.exitosos++
      } catch (error) {
        log(`${progreso} ❌ ERROR al guardar ${cliente.codigo}: ${error.message}`, 'ERROR')
        resultados.errores.push({ codigo: cliente.codigo, error: error.message })
      }
    } else {
      // Actualizar solo dirección y marcar para revisión manual
      log(`${progreso} ⚠️  PARCIAL ${cliente.codigo} - ${cliente.nombre}: ${geoResult.error}`)
      log(`${progreso}    → Guardando dirección sin coordenadas (REVISIÓN MANUAL)`)
      
      try {
        await actualizarClienteEnBD(clienteBD.id, cliente.domicilio, null)
        resultados.solodireccion++
      } catch (error) {
        log(`${progreso} ❌ ERROR al guardar dirección ${cliente.codigo}: ${error.message}`, 'ERROR')
        resultados.errores.push({ codigo: cliente.codigo, error: error.message })
      }
    }

    // Delay para rate limiting
    if (i < clientesAProcesar.length - 1) {
      await delay(DELAY_MS)
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(60))
  console.log('  RESUMEN DE GEOCODIFICACIÓN')
  console.log('='.repeat(60))
  console.log(`  ✅ Exitosos (con coordenadas):     ${resultados.exitosos}`)
  console.log(`  ⚠️  Parciales (solo dirección):    ${resultados.solodireccion}`)
  console.log(`  ⏭️  Omitidos (casos especiales):   ${resultados.omitidos}`)
  console.log(`  ❓ No encontrados en BD:           ${resultados.noEncontrados}`)
  console.log(`  ❌ Errores:                        ${resultados.errores.length}`)
  console.log('='.repeat(60))

  if (resultados.errores.length > 0) {
    console.log('\n📋 Detalle de errores:')
    resultados.errores.forEach(e => {
      console.log(`   - ${e.codigo}: ${e.error}`)
    })
  }

  if (resultados.solodireccion > 0) {
    console.log('\n⚠️  ATENCIÓN: Hay clientes que requieren REVISIÓN MANUAL de coordenadas.')
    console.log('   Búscalos en la interfaz web y ajusta las coordenadas manualmente.')
  }

  // Guardar log
  const logPath = guardarLogEnArchivo()
  console.log(`\n📝 Log guardado en: ${logPath}`)

  console.log('\n✨ Proceso completado.\n')
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error)
  process.exit(1)
})





