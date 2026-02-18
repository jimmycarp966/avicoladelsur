import { redirect } from 'next/navigation'

export default function TesoreriaPorSucursalPage() {
  redirect('/tesoreria/cajas?view=por-sucursal')
}
