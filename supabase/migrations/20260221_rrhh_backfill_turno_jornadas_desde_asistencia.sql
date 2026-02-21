-- Backfill de turno para jornadas auto ya generadas
-- Toma el turno de rrhh_asistencia por empleado+fecha.

update public.rrhh_liquidacion_jornadas as j
set turno = a.turno
from public.rrhh_asistencia as a
where j.empleado_id = a.empleado_id
  and j.fecha = a.fecha
  and j.origen in ('auto_hik', 'auto_asistencia')
  and coalesce(j.turno, 'general') = 'general'
  and a.turno is not null;
