import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth.actions'
import { AdminLayout } from '@/components/layout/admin/AdminLayout'

const allowedRoles = ['admin', 'vendedor', 'almacenista']

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  // Verificar autenticación
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Verificar permisos
  if (!allowedRoles.includes(user.rol)) {
    redirect('/unauthorized')
  }

  return <AdminLayout user={user}>{children}</AdminLayout>
}
