'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Building2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

function ConfiguracionContent() {
  const searchParams = useSearchParams()
  const mensaje = searchParams.get('mensaje')

  const handleRecargar = () => {
    window.location.reload()
  }

  return (
    <CardContent className="space-y-6">
      {mensaje === 'sucursal-requerida' && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-orange-900 mb-2">
                        Sucursal No Asignada
                      </h3>
                      <p className="text-orange-800 mb-4">
                        Tu cuenta de usuario no tiene una sucursal asignada.
                        Para acceder a las funcionalidades del sistema, necesitas que un administrador
                        te asigne a una sucursal.
                      </p>
                      <div className="flex items-center gap-2 text-sm text-orange-700">
                        <span>Estado:</span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          Pendiente de asignación
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Qué hacer ahora?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs font-semibold text-blue-600">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Contacta al administrador</p>
                      <p className="text-sm text-muted-foreground">
                        Un administrador del sistema debe asignarte a una sucursal específica.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs font-semibold text-blue-600">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Espera la asignación</p>
                      <p className="text-sm text-muted-foreground">
                        Una vez asignado, podrás acceder a todas las funcionalidades de tu sucursal.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-xs font-semibold text-blue-600">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Recarga la página</p>
                      <p className="text-sm text-muted-foreground">
                        Una vez asignado, haz clic en el botón de abajo para recargar y acceder al sistema.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={handleRecargar} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Verificar asignación y recargar
                  </Button>
                </div>
              </CardContent>
            </Card>
    </CardContent>
  )
}

export default function ConfiguracionSucursalPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">Configuración de Sucursal</CardTitle>
                <CardDescription>
                  Gestiona la configuración de tu cuenta de sucursal
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <Suspense fallback={<CardContent><div>Cargando...</div></CardContent>}>
            <ConfiguracionContent />
          </Suspense>
        </Card>
      </div>
    </div>
  )
}



