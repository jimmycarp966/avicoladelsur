'use client'

import { ClientesEnRiesgoWidget } from './ClientesEnRiesgoWidget'
import { PrediccionStockWidget } from './PrediccionStockWidget'

/**
 * Contenedor de Widgets de IA para el Dashboard
 * Wrapper client-side para los widgets que requieren fetch
 */
export function IAWidgetsContainer() {
    return (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <ClientesEnRiesgoWidget />
            <PrediccionStockWidget />
        </div>
    )
}
