-- Backfill de turno para asistencias sincronizadas desde HikConnect
-- Evita que liquidaciones muestren "general" por registros legacy con turno NULL.

update public.rrhh_asistencia
set turno = case
  when coalesce(horas_trabajadas, 0) >= 7 then 'turno_completo'
  when hora_entrada is not null
    and extract(hour from (hora_entrada at time zone 'America/Argentina/Buenos_Aires')) < 14
    then 'medio_turno_manana'
  when hora_entrada is not null then 'medio_turno_tarde'
  when hora_salida is not null
    and extract(hour from (hora_salida at time zone 'America/Argentina/Buenos_Aires')) < 14
    then 'medio_turno_manana'
  when hora_salida is not null then 'medio_turno_tarde'
  else 'general'
end
where turno is null
  and (
    coalesce(lower(observaciones), '') like '%hikconnect%'
    or coalesce(lower(observaciones), '') like '%hik-connect%'
  );
