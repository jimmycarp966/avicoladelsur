import { createClient } from '@/lib/supabase/server'
import CatalogoClient from './CatalogoClient'

export const metadata = {
    title: 'Catálogo | Avícola del Sur',
    description: 'Productos frescos de calidad - Avícola del Sur'
}

// Revalidar cada 5 minutos
export const revalidate = 300

async function getProductos() {
    const supabase = await createClient()

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

    // Transformar al formato esperado por el cliente
    return (productos || []).map(p => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio_minorista: p.precio_venta || 0,
        precio_mayorista: p.precio_costo,
        unidad: p.unidad_medida || 'kg',
        es_pesable: p.pesable || false,
        venta_mayor_habilitada: p.venta_mayor_habilitada || false,
        kg_por_unidad_mayor: p.kg_por_unidad_mayor,
        imagen_url: null,
        categoria: p.categoria ? { id: p.categoria, nombre: p.categoria } : null
    }))
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

export default async function CatalogoPage() {
    const [productos, categorias] = await Promise.all([
        getProductos(),
        getCategorias()
    ])

    return <CatalogoClient productos={productos} categorias={categorias} />
}

