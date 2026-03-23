do $$
declare
  v_src uuid := 'e00374e9-5537-4789-8499-c8788a5daa77';
  v_dst uuid := '1a70c429-f80a-4343-9ceb-59c495252559';
begin
  if not exists (
    select 1 from public.zonas
    where id = v_src and lower(nombre) = lower('Valles')
  ) then
    raise exception 'Zona origen no encontrada o no coincide: %', v_src;
  end if;

  if not exists (
    select 1 from public.zonas
    where id = v_dst and lower(nombre) = lower('Tafi del valle')
  ) then
    raise exception 'Zona destino no encontrada o no coincide: %', v_dst;
  end if;

  update public.plan_rutas_semanal set zona_id = v_dst where zona_id = v_src;
  update public.zonas_dias set zona_id = v_dst where zona_id = v_src;
  update public.rutas_reparto set zona_id = v_dst where zona_id = v_src;
  update public.pedidos set zona_id = v_dst where zona_id = v_src;
  update public.presupuestos set zona_id = v_dst where zona_id = v_src;
  update public.clientes set zona_id = v_dst where zona_id = v_src;
  update public.localidades set zona_id = v_dst where zona_id = v_src;
  update public.rutas_planificadas set zona_id = v_dst where zona_id = v_src;
  update public.transferencias_stock set zona_id = v_dst where zona_id = v_src;

  update public.clientes
  set zona_entrega = 'TAFI DEL VALLE'
  where upper(trim(zona_entrega)) = 'VALLES';

  if not exists (select 1 from public.plan_rutas_semanal where zona_id = v_src)
     and not exists (select 1 from public.zonas_dias where zona_id = v_src)
     and not exists (select 1 from public.rutas_reparto where zona_id = v_src)
     and not exists (select 1 from public.pedidos where zona_id = v_src)
     and not exists (select 1 from public.presupuestos where zona_id = v_src)
     and not exists (select 1 from public.clientes where zona_id = v_src)
     and not exists (select 1 from public.localidades where zona_id = v_src)
     and not exists (select 1 from public.rutas_planificadas where zona_id = v_src)
     and not exists (select 1 from public.transferencias_stock where zona_id = v_src)
  then
    delete from public.zonas where id = v_src;
  else
    update public.zonas set activo = false where id = v_src;
  end if;
end $$;;
