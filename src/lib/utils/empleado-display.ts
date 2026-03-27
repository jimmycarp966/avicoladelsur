import type { Empleado } from "@/types/domain.types";

type EmpleadoDisplaySource = Pick<Empleado, "nombre" | "apellido" | "legajo" | "dni"> & {
  usuario?: {
    nombre?: string;
    apellido?: string;
    email?: string;
  } | null;
};

function cleanValue(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getEmpleadoNombre(empleado: EmpleadoDisplaySource): string {
  const nombreEmpleado = `${empleado.nombre || ""} ${empleado.apellido || ""}`.trim();
  if (nombreEmpleado) return nombreEmpleado;

  const nombreUsuario = `${empleado.usuario?.nombre || ""} ${empleado.usuario?.apellido || ""}`.trim();
  if (nombreUsuario) return nombreUsuario;

  return "Sin nombre";
}

export function getEmpleadoLegajoDni(empleado: EmpleadoDisplaySource): string {
  const legajo = cleanValue(empleado.legajo);
  const dni = cleanValue(empleado.dni);
  const partes: string[] = [];

  if (legajo) {
    partes.push(`Nro. de legajo ${legajo}`);
  }

  if (dni) {
    partes.push(`DNI ${dni}`);
  }

  return partes.join(" + ") || "Sin legajo ni DNI";
}

export function getEmpleadoDropdownLabel(empleado: EmpleadoDisplaySource): string {
  const identificacion = getEmpleadoLegajoDni(empleado);
  const nombre = getEmpleadoNombre(empleado);

  if (!nombre || nombre === "Sin nombre") {
    return identificacion;
  }

  return `${identificacion} - ${nombre}`;
}

