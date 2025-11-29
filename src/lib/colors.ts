// Paleta de colores para rutas (10 colores vibrantes y distinguibles)
export const ROUTE_COLORS = [
    '#3B82F6',  // Azul vibrante
    '#10B981',  // Verde esmeralda
    '#F59E0B',  // Naranja ámbar
    '#EF4444',  // Rojo intenso
    '#8B5CF6',  // Violeta
    '#EC4899',  // Rosa fucsia
    '#14B8A6',  // Turquesa
    '#F97316',  // Mandarina
    '#6366F1',  // Índigo
    '#84CC16',  // Lima
]

// Función hash para asignar color consistente a cada ruta
export function getRouteColor(rutaId: string): string {
    if (!rutaId) return ROUTE_COLORS[0]

    const hash = rutaId.split('').reduce((acc, char) =>
        char.charCodeAt(0) + ((acc << 5) - acc), 0)
    const index = Math.abs(hash) % ROUTE_COLORS.length
    return ROUTE_COLORS[index]
}

// Obtener nombre del color para mostrar
export function getColorName(color: string): string {
    const names: Record<string, string> = {
        '#3B82F6': 'Azul',
        '#10B981': 'Verde',
        '#F59E0B': 'Naranja',
        '#EF4444': 'Rojo',
        '#8B5CF6': 'Violeta',
        '#EC4899': 'Rosa',
        '#14B8A6': 'Turquesa',
        '#F97316': 'Mandarina',
        '#6366F1': 'Índigo',
        '#84CC16': 'Lima',
    }
    return names[color] || 'Color'
}
