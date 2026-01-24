import { Toaster } from 'sonner'
import '@/app/globals.css'

export default function CatalogoLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            {children}
            <Toaster position="bottom-center" richColors />
        </>
    )
}
