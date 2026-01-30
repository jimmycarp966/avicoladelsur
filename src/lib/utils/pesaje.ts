
import { esVentaMayorista } from '@/lib/utils'

// Helper para determinar si un item es pesable
export function esItemPesable(item: any, esMayorista: boolean = false): boolean {
    // 1. Si el producto requiere pesaje explícitamente (nueva configuración), SIEMPRE es pesable
    // Esto sobre-escribe la lógica de mayorista
    if (item.producto?.requiere_pesaje === true) {
        return true
    }

    // 2. Si es venta mayorista, NO es pesable (productos vienen en caja cerrada)
    if (esMayorista) {
        return false
    }

    // Primero verificar el campo pesable del item
    if (item.pesable === true) {
        return true
    }

    // Si no está marcado como pesable, verificar la categoría del producto
    const categoria = item.producto?.categoria
    if (categoria) {
        const categoriaUpper = categoria.toUpperCase().trim()
        if (categoriaUpper === 'BALANZA') {
            return true
        }
    }

    // 3. Verificar si el nombre contiene "xkg" sin número previo (ej: "Pechuga xkg" = pesable, "2xkg" = NO pesable)
    const nombre = item.producto?.nombre || ''
    if (/(?<!\d)xkg/i.test(nombre)) {
        return true
    }

    return false
}

export function calcularKgItem(presupuesto: any, item: any): number {
    if (!item) return 0
    const esMayorista = esVentaMayorista(presupuesto, item)
    const kgPorUnidadMayor = item.producto?.kg_por_unidad_mayor

    if (esMayorista && kgPorUnidadMayor) {
        const cant = item.cantidad_solicitada || 0
        const calculado = (item.peso_final ?? cant * kgPorUnidadMayor)
        return calculado
    }

    // Si es mayorista pero no tiene kg_por_unidad_mayor configurado, retornar cantidad solicitada
    if (esMayorista && !kgPorUnidadMayor) {
        return item.cantidad_solicitada || 0
    }

    if (item.pesable && item.peso_final) {
        return item.peso_final
    }
    return item.cantidad_solicitada || 0
}

// Calcula unidades para productos NO pesables (para mostrar en lista de preparación)
export function calcularUnidadesItem(presupuesto: any, item: any): number {
    if (!item) return 0
    const esMayorista = esVentaMayorista(presupuesto, item)
    const kgPorUnidadMayor = item.producto?.kg_por_unidad_mayor

    if (esMayorista && kgPorUnidadMayor) {
        // Venta mayorista: mostrar cantidad en unidades mayores (cajones)
        return item.cantidad_solicitada || 0
    }

    // Venta normal: mostrar cantidad en unidades individuales
    return item.cantidad_solicitada || 0
}
