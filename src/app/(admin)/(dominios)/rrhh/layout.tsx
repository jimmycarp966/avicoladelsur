
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth.actions'

export default async function RRHHLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()

    if (!user) {
        redirect('/login')
    }

    // RRHH is strictly for admins
    if (user.rol !== 'admin') {
        redirect('/unauthorized')
    }

    return <>{children}</>
}
