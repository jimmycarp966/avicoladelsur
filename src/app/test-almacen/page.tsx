'use client'

import { useState } from 'react'

export default function TestAlmacenPage() {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)

    const configurarAlmacen = async () => {
        setLoading(true)
        setResult(null)

        try {
            console.log('Iniciando configuración del almacén central...')
            const response = await fetch('/api/setup-almacen-central', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            })

            const data = await response.json()
            console.log('Resultado:', data)
            setResult(data)

            if (data.success) {
                alert('✅ Almacén central configurado exitosamente!\n\nRevisa la consola para más detalles.')
            } else {
                alert('❌ Error: ' + data.error)
            }
        } catch (error) {
            console.error('Error:', error)
            alert('❌ Error de conexión: ' + error)
            setResult({ success: false, error: String(error) })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">🚀 Configurar Almacén Central</h1>
            <p className="mb-6 text-gray-600">
                Esta página configura automáticamente el almacén central con 1000 unidades de cada producto existente para facilitar el desarrollo.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h2 className="font-semibold text-blue-800 mb-2">¿Qué hace esta configuración?</h2>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Marca todos los productos como "catálogo central"</li>
                    <li>• Crea lotes con 1000 unidades de cada producto en almacén central</li>
                    <li>• Actualiza lotes existentes si tienen menos de 1000 unidades</li>
                    <li>• Habilita transferencias desde almacén central a sucursales</li>
                </ul>
            </div>

            <button
                onClick={configurarAlmacen}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg text-lg"
            >
                {loading ? '🔄 Configurando...' : '🚀 Configurar Almacén Central'}
            </button>

            {result && (
                <div className={`mt-6 p-4 rounded-lg ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                        {result.success ? '✅ Configuración Exitosa' : '❌ Error en Configuración'}
                    </h3>

                    {result.success && result.data && (
                        <div className="mt-2 text-sm text-green-700">
                            <p>📦 Productos marcados como catálogo central: {result.data.productos_marcados_catalogo}</p>
                            <p>📊 Lotes procesados: {result.data.lotes_procesados}</p>
                            <p>🏪 Productos con stock: {result.data.productos_con_stock}</p>
                        </div>
                    )}

                    {result.error && (
                        <p className="mt-2 text-sm text-red-700">{result.error}</p>
                    )}
                </div>
            )}

            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">📋 Próximos pasos:</h3>
                <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                    <li>Configurar el almacén central (botón arriba)</li>
                    <li>Ir a <code className="bg-gray-200 px-1 rounded">/sucursales/transferencias/nueva</code></li>
                    <li>Seleccionar una sucursal destino</li>
                    <li>Ver que aparecen productos con stock disponible</li>
                    <li>Crear la primera transferencia</li>
                </ol>
            </div>
        </div>
    )
}
