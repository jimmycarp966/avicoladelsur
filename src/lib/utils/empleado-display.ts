import type { Empleado } from "@/types/domain.types";

type EmpleadoDisplaySource = Pick<Empleado, "nombre" | "apellido" | "legajo"> & {
  usuario?: {
    nombre?: string;
    apellido?: string;
    email?: string;
  } | null;
};

export function getEmpleadoNombre(empleado: EmpleadoDisplaySource): string {
  const nombreUsuario = `${empleado.usuario?.nombre || ""} ${empleado.usuario?.apellido || ""}`.trim();
  if (nombreUsuario) return nombreUsuario;

  const nombreEmpleado = `${empleado.nombre || ""} ${empleado.apellido || ""}`.trim();
  if (nombreEmpleado) return nombreEmpleado;

  if (empleado.usuario?.email) return empleado.usuario.email;
  if (empleado.legajo) return `Legajo ${empleado.legajo}`;

  return "Sin nombre";
}

