'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, ArrowLeft, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { procesarArchivoAction, importarMovimientosAction } from '@/actions/conciliacion.actions'
import { MovimientoBancarioInput } from '@/types/conciliacion'
import { toast } from 'sonner'

interface ImportarViewProps {
    cuentas: any[]
}

export function ImportarView({ cuentas }: ImportarViewProps) {
    const router = useRouter()
    const [cuentaId, setCuentaId] = useState<string>('')
    const [archivo, setArchivo] = useState<File | null>(null)
    const [procesando, setProcesando] = useState(false)
    const [movimientos, setMovimientos] = useState<MovimientoBancarioInput[]>([])
    const [importando, setImportando] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setArchivo(e.target.files[0])
            setMovimientos([])
        }
    }

    const handleProcesar = async () => {
        if (!archivo) return
        setProcesando(true)

        // Detectar tipo
        let tipo: 'csv' | 'excel' | 'pdf' | 'imagen' = 'csv'
        if (archivo.name.endsWith('.xlsx')) tipo = 'excel'
        else if (archivo.name.endsWith('.pdf')) tipo = 'pdf'
        else if (archivo.type.startsWith('image/')) tipo = 'imagen'

        const formData = new FormData()
        formData.append('archivo', archivo)
        formData.append('tipo', tipo)

        try {
            const res = await procesarArchivoAction(formData)
            if (res.success && res.movimientos) {
                setMovimientos(res.movimientos)
                toast.success(`Se encontraron ${res.movimientos.length} movimientos`)
            } else {
                toast.error(res.error || 'Error al procesar archivo')
            }
        } catch (e) {
            toast.error('Error procesando archivo')
        } finally {
            setProcesando(false)
        }
    }

    const handleConfirmarImportacion = async () => {
        if (!cuentaId) {
            toast.error('Selecciona una cuenta bancaria')
            return
        }
        if (movimientos.length === 0) return

        setImportando(true)
        try {
            const payload = movimientos.map(m => ({
                ...m,
                cuenta_bancaria_id: cuentaId,
                archivo_origen: archivo?.name
            }))

            const res = await importarMovimientosAction(payload)
            if (res.success) {
                toast.success(`Importados ${res.count} movimientos. ${res.conciliados} conciliados automáticamente.`)
                router.push('/tesoreria/conciliacion')
            } else {
                toast.error(res.error || 'Error en importación')
            }
        } catch (e) {
            toast.error('Error importando')
        } finally {
            setImportando(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-2xl font-bold">Importar Movimientos</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Panel de carga */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Cargar Archivo</CardTitle>
                        <CardDescription>Soporta CSV, Excel, PDF e Imágenes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cuenta">Cuenta Bancaria</Label>
                            <Select value={cuentaId} onValueChange={setCuentaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cuentas.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.banco} - {c.moneda}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="archivo">Archivo</Label>
                            <Input id="archivo" type="file" accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
                        </div>

                        <Button
                            className="w-full"
                            disabled={!archivo || procesando}
                            onClick={handleProcesar}
                        >
                            {procesando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Procesar Archivo
                        </Button>
                    </CardContent>
                </Card>

                {/* Vista previa */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Vista Previa</CardTitle>
                            <CardDescription>{movimientos.length > 0 ? `${movimientos.length} movimientos detectados` : 'Sube un archivo para ver los datos'}</CardDescription>
                        </div>
                        {movimientos.length > 0 && (
                            <Button onClick={handleConfirmarImportacion} disabled={importando || !cuentaId}>
                                {importando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Confirmar Importación
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="max-h-[500px] overflow-auto">
                        {movimientos.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Ref</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movimientos.slice(0, 50).map((m, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{new Date(m.fecha).toLocaleDateString()}</TableCell>
                                            <TableCell>{m.descripcion}</TableCell>
                                            <TableCell>{m.referencia}</TableCell>
                                            <TableCell className="text-right font-medium">${m.monto.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                    {movimientos.length > 50 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                ... y {movimientos.length - 50} más
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-10 text-muted-foreground border-2 border-dashed rounded-lg">
                                <Upload className="h-10 w-10 mb-2 opacity-20" />
                                <p>Los datos extraídos aparecerán aquí</p>
                                <div className="mt-4 text-xs text-orange-600 flex items-center bg-orange-50 p-2 rounded">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Nota: Los archivos PDF/Imágenes se procesan con IA y pueden tardar unos segundos.
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
