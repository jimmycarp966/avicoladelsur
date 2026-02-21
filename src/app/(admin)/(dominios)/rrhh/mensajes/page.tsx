import {
    obtenerBandejaEntradaAction,
    obtenerMensajesEnviadosAction,
    contarNoLeidosAction,
    obtenerUsuariosDestinatariosAction
} from '@/actions/mensajes.actions'
import { PageHeader } from '@/components/ui/page-header'
import { Mail, Inbox, Send, Archive, Trash2 } from 'lucide-react'
import { MensajesClient } from './components/MensajesClient'

export const revalidate = 10

export default async function MensajesPage() {
    const [bandejaResult, enviadosResult, noLeidosResult, usuariosResult] = await Promise.all([
        obtenerBandejaEntradaAction(),
        obtenerMensajesEnviadosAction(),
        contarNoLeidosAction(),
        obtenerUsuariosDestinatariosAction(),
    ])

    const bandeja = bandejaResult.success ? bandejaResult.data! : []
    const enviados = enviadosResult.success ? enviadosResult.data! : []
    const noLeidos = noLeidosResult.count || 0
    const usuarios = usuariosResult.success ? usuariosResult.data! : []

    return (
        <div className="space-y-6">
            <PageHeader
                title="Mensajes Internos"
                description="Comunicación interna entre empleados"
                breadcrumbs={[
                    { label: 'RRHH', href: '/rrhh/empleados' },
                    { label: 'Mensajes' },
                ]}
            />

            <MensajesClient
                bandeja={bandeja}
                enviados={enviados}
                noLeidos={noLeidos}
                usuarios={usuarios}
            />
        </div>
    )
}
