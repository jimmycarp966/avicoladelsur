import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface RutaMapaRedirectPageProps {
  params: Promise<{ ruta_id: string }>
}

export default async function RutaMapaRedirectPage({
  params,
}: RutaMapaRedirectPageProps) {
  const { ruta_id } = await params
  redirect(`/ruta/${ruta_id}`)
}
