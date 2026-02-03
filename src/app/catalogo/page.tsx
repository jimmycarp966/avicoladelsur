import { createClient } from '@/lib/supabase/server'
import CatalogoClient from './CatalogoClient'

export const metadata = {
    title: 'Catálogo | Avícola del Sur',
    description: 'Productos frescos de calidad - Avícola del Sur'
}

// Revalidar cada 5 minutos
export const revalidate = 300

interface CatalogoPageProps {
    searchParams: { telefono?: string; token?: string }
}

async function getProductos() {
    const supabase = await createClient()

    // Lista MAYORISTA (los precios están cargados ahí)
    const LISTA_MAYORISTA_ID = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

    // Obtener productos
    const { data: productos, error } = await supabase
        .from('productos')
        .select(`
            id,
            codigo,
            nombre,
            descripcion,
            precio_venta,
            precio_costo,
            unidad_medida,
            pesable,
            venta_mayor_habilitada,
            kg_por_unidad_mayor,
            categoria
        `)
        .eq('activo', true)
        .order('nombre')

    if (error) {
        console.error('Error obteniendo productos:', error)
        return []
    }

    // Obtener precios de la lista mayorista
    const { data: preciosMayorista } = await supabase
        .from('precios_productos')
        .select('producto_id, precio')
        .eq('lista_precio_id', LISTA_MAYORISTA_ID)
        .eq('activo', true)

    // Crear mapa de precios mayorista por producto_id
    const preciosMap = new Map()
    preciosMayorista?.forEach(p => {
        preciosMap.set(p.producto_id, parseFloat(p.precio))
    })

    // Transformar al formato esperado por el cliente
    return (productos || []).map(p => {
        // Usar precio de lista mayorista, si no existe usar precio_venta, si no usar precio_costo
        let precioMinorista = preciosMap.get(p.id) ||
                              (p.precio_venta ? parseFloat(p.precio_venta) : null) ||
                              (p.precio_costo ? parseFloat(p.precio_costo) : null) ||
                              0

        return {
            id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio_minorista: precioMinorista,
            precio_mayorista: preciosMap.get(p.id) || (p.precio_costo ? parseFloat(p.precio_costo) : null),
            unidad: p.unidad_medida || 'kg',
            es_pesable: p.pesable || false,
            venta_mayor_habilitada: p.venta_mayor_habilitada || false,
            kg_por_unidad_mayor: p.kg_por_unidad_mayor,
            imagen_url: null,
            categoria: p.categoria ? { id: p.categoria, nombre: p.categoria } : null
        }
    }).filter(p => p.precio_minorista > 0) // Solo mostrar productos con precio
}

async function getCategorias() {
    const supabase = await createClient()

    // Obtener categorías únicas de los productos
    const { data: productos, error } = await supabase
        .from('productos')
        .select('categoria')
        .eq('activo', true)
        .not('categoria', 'is', null)

    if (error) {
        console.error('Error obteniendo categorías:', error)
        return []
    }

    // Extraer categorías únicas
    const categoriasSet = new Set<string>()
    productos?.forEach(p => {
        if (p.categoria) categoriasSet.add(p.categoria)
    })

    return Array.from(categoriasSet).sort().map(cat => ({
        id: cat,
        nombre: cat
    }))
}

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
    const [productos, categorias] = await Promise.all([
        getProductos(),
        getCategorias()
    ])

    return (
        <CatalogoClient
            productos={productos}
            categorias={categorias}
            telefono={searchParams.telefono}
            token={searchParams.token}
        />
    )
}

