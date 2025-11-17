import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth.actions'
import { RepartidorLayout } from '@/components/layout/repartidor/RepartidorLayout'

export default async function RepartidorLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  // Verificar autenticación
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Verificar que sea repartidor
  if (user.rol !== 'repartidor') {
    redirect('/unauthorized')
  }

  return <RepartidorLayout>{children}</RepartidorLayout>
}
