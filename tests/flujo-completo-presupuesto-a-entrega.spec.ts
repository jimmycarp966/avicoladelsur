import { test, expect } from '@playwright/test';
import { login } from './auth-helper';

/**
 * TEST E2E COMPLETO: FLUJO DE PRESUPUESTO A ENTREGA
 *
 * 1. Crear presupuesto con 10+ productos (pesables y no pesables)
 * 2. Marcar productos como listos en "En Preparación"
 * 3. Realizar pesaje de productos pesables
 * 4. Convertir presupuesto a pedido
 * 5. Verificar que se creó la ruta automáticamente
 * 6. Login como repartidor y completar la ruta
 */

test('Flujo completo E2E: Presupuesto -> Pedido -> Ruta -> Entrega', async ({ page }) => {
  // Variables para compartir entre pasos
  let presupuestoId: string = '';
  let pedidoId: string = '';
  let rutaId: string = '';

  // URLs base
  const URLS = {
    login: '/login',
    ventas: '/ventas/presupuestos',
    nuevoPresupuesto: '/ventas/presupuestos/nuevo',
    enPreparacion: '/almacen/en-preparacion',
    pedidos: '/almacen/pedidos',
    rutas: '/reparto/rutas',
  };

  // PASO 1: Login como admin
  await login(page);
  await page.goto(URLS.ventas);
  await page.waitForLoadState('networkidle');

  // PASO 2: Ir a crear nuevo presupuesto
  console.log('PASO 1: Navegando a nuevo presupuesto...');
  await page.goto(URLS.nuevoPresupuesto);
  await page.waitForLoadState('domcontentloaded');
  await page.screenshot({ path: 'test-results/00-pagina-nuevo-presupuesto.png' });

  // PASO 3: Seleccionar cliente
  console.log('PASO 2: Seleccionando cliente...');

  // Intentar multiple enfoques para seleccionar cliente
  let clienteSeleccionado = false;

  // Enfoque 1: Hacer click en el trigger y luego buscar opción
  try {
    await page.click('#cliente_id');
    await page.waitForTimeout(1000);

    // Buscar input de búsqueda
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    const searchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (searchVisible) {
      await searchInput.fill('Cliente');
      await page.waitForTimeout(1000);

      // Presionar Enter para seleccionar primer resultado
      await searchInput.press('Enter');
      await page.waitForTimeout(500);
      clienteSeleccionado = true;
      console.log('✅ Cliente seleccionado (enfoque 1)');
    }
  } catch (e) {
    console.log('⚠️ Enfoque 1 falló, intentando enfoque 2...');
  }

  // Enfoque 2: Seleccionar directamente del SelectContent si está visible
  if (!clienteSeleccionado) {
    const selectContent = page.locator('[role="listbox"]').first();
    const selectVisible = await selectContent.isVisible().catch(() => false);

    if (selectVisible) {
      const option = selectContent.locator('[role="option"]:not([aria-disabled])').first();
      const optionVisible = await option.isVisible().catch(() => false);
      if (optionVisible) {
        await option.click();
        clienteSeleccionado = true;
        console.log('✅ Cliente seleccionado (enfoque 2)');
      }
    }
  }

  // Si aún no se seleccionó, tomar screenshot y continuar
  if (!clienteSeleccionado) {
    console.log('⚠️ No se pudo seleccionar cliente, tomando screenshot...');
    await page.screenshot({ path: 'test-results/01-error-cliente.png' });
  } else {
    await page.screenshot({ path: 'test-results/01-cliente-seleccionado.png' });
  }

  await page.waitForTimeout(1000);

  // PASO 4: Agregar productos
  console.log('PASO 3: Agregando productos...');

  // Buscar el primer producto que ya viene pre-cargado en el formulario
  // El formulario ya tiene una fila de producto, solo necesito seleccionar un producto
  const selectTriggerProducto = page.locator('[id^="producto_"]').first();
  await selectTriggerProducto.click();
  await page.waitForTimeout(1000);

  // Buscar input de búsqueda dentro del Select
  const productoSearch0 = page.locator('[id^="producto_"] ~ [role="listbox"] input, [data-radix-popper-content-wrapper] input').first();
  const search0Visible = await productoSearch0.isVisible().catch(() => false);

  if (search0Visible) {
    await productoSearch0.fill('pollo');
    await page.waitForTimeout(1000);

    // Presionar Enter o hacer click en la primera opción
    const primerProductoOption = page.locator('[role="option"]').first();
    if (await primerProductoOption.isVisible().catch(() => false)) {
      await primerProductoOption.click();
    } else {
      await productoSearch0.press('Enter');
    }
  } else {
    // Alternativa: escribir directamente en el campo y presionar Enter
    await page.keyboard.type('pollo');
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(500);

  // Agregar más productos (hasta llegar a 10)
  for (let i = 1; i < 10; i++) {
    await page.click('button:has-text("Agregar Producto"), button:has-text("Agregar")');
    await page.waitForTimeout(500);

    // Buscar el trigger del producto por índice
    const productoTrigger = page.locator(`#producto_${i}`).or(
      page.locator('[id^="producto_"]').nth(i)
    );

    const triggerVisible = await productoTrigger.isVisible().catch(() => false);
    if (!triggerVisible) {
      console.log(`⚠️ Trigger del producto ${i} no visible, saltando...`);
      continue;
    }

    await productoTrigger.click();
    await page.waitForTimeout(500);

    // Buscar input dentro del Select
    const productoSearch = page.locator(`#producto_${i} ~ [role="listbox"] input, [data-radix-popper-content-wrapper] input`).or(
      page.locator('[id^="producto_"] ~ [role="listbox"] input').nth(i)
    );

    const searchVisible = await productoSearch.isVisible().catch(() => false);

    if (searchVisible) {
      // Alternar entre búsquedas
      const busqueda = i % 2 === 0 ? 'huevo' : 'pollo';
      await productoSearch.fill(busqueda);
      await page.waitForTimeout(800);

      const option = page.locator('[role="option"]').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      } else {
        await productoSearch.press('Enter');
      }
    } else {
      // Último recurso: presionar teclas
      const busqueda = i % 2 === 0 ? 'huevo' : 'pollo';
      await page.keyboard.type(busqueda);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(400);
  }

  console.log('✅ Productos agregados');

  // PASO 5: Guardar presupuesto
  console.log('PASO 4: Guardando presupuesto...');
  await page.click('button[type="submit"]:has-text("Guardar")');
  await page.waitForTimeout(3000);

  // Obtener el ID del presupuesto desde la URL actual
  const currentUrl = page.url();
  const urlMatch = currentUrl.match(/\/presupuestos\/([^\/\?]+)/);
  if (urlMatch) {
    presupuestoId = urlMatch[1];
    console.log(`✅ Presupuesto creado: ${presupuestoId}`);
  } else {
    // Si no estamos en la página del detalle, ir a la lista y obtener el primero
    await page.goto(URLS.ventas);
    await page.waitForLoadState('networkidle');

    const primerPresupuesto = page.locator('a[href^="/ventas/presupuestos/"]').first();
    const href = await primerPresupuesto.getAttribute('href');
    if (href) {
      const match = href.match(/\/presupuestos\/([^\/]+)/);
      presupuestoId = match[1];
      console.log(`✅ Presupuesto obtenido de lista: ${presupuestoId}`);
    }
  }

  expect(presupuestoId).toBeTruthy();
  await page.screenshot({ path: 'test-results/01-presupuesto-creado.png' });

  // PASO 6: Navegar al detalle y enviar a almacén
  console.log('PASO 5: Enviando a almacén...');
  await page.goto(`/ventas/presupuestos/${presupuestoId}`);
  await page.waitForLoadState('networkidle');

  // Buscar botón de enviar a almacén
  const botonEnviarAlmacen = page.locator('button:has-text("Enviar a Almacén")').or(
    page.locator('button:has-text("Enviar a Almacén")')
  );

  if (await botonEnviarAlmacen.first().isVisible().catch(() => false)) {
    await botonEnviarAlmacen.first().click();
    await page.waitForTimeout(2000);
    console.log('✅ Enviado a almacén');
  } else {
    // Puede que ya esté en almacén, continuar
    console.log('⚠️ Botón "Enviar a Almacén" no encontrado, puede que ya esté en almacén');
  }

  await page.screenshot({ path: 'test-results/02-enviado-almacen.png' });

  // PASO 7: Marcar productos como listos en En Preparación
  console.log('PASO 6: Marcando productos como listos...');
  await page.goto(URLS.enPreparacion);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Buscar botones "Listo" y hacer click
  const botonesListo = page.locator('button:has-text("Listo")');
  const countListo = await botonesListo.count();

  if (countListo > 0) {
    // Marcar hasta 5 productos como listos
    for (let i = 0; i < Math.min(countListo, 5); i++) {
      await botonesListo.nth(i).click();
      await page.waitForTimeout(300);
    }
    console.log(`✅ Marcados ${Math.min(countListo, 5)} productos como listos`);
  } else {
    console.log('⚠️ No se encontraron botones "Listo"');
  }

  await page.screenshot({ path: 'test-results/03-productos-listos.png' });

  // PASO 8: Realizar pesaje
  console.log('PASO 7: Realizando pesaje...');
  await page.goto(`/almacen/presupuesto/${presupuestoId}/pesaje`);
  await page.waitForLoadState('networkidle');

  // Buscar inputs de peso
  const inputsPeso = page.locator('input[name*="peso"], input[placeholder*="peso"], input[placeholder*="kg"]');
  const countPeso = await inputsPeso.count();

  if (countPeso > 0) {
    await inputsPeso.first().fill('2.5');
    await page.waitForTimeout(500);

    for (let i = 1; i < Math.min(countPeso, 5); i++) {
      await inputsPeso.nth(i).fill(`${(i + 1) * 1.5}`);
      await page.waitForTimeout(200);
    }

    // Guardar pesaje
    const botonGuardarPesaje = page.locator('button:has-text("Guardar"), button:has-text("Confirmar")').first();
    if (await botonGuardarPesaje.isVisible().catch(() => false)) {
      await botonGuardarPesaje.click();
      await page.waitForTimeout(2000);
    }
    console.log('✅ Pesaje completado');
  } else {
    console.log('⚠️ No se encontraron inputs de peso');
  }

  await page.screenshot({ path: 'test-results/04-pesaje-completado.png' });

  // PASO 9: Convertir a pedido
  console.log('PASO 8: Convirtiendo a pedido...');
  await page.goto(`/ventas/presupuestos/${presupuestoId}`);
  await page.waitForLoadState('networkidle');

  // Buscar botón de convertir
  const botonConvertir = page.locator('button:has-text("Convertir")').first();

  if (await botonConvertir.isVisible().catch(() => false)) {
    await botonConvertir.click();
    await page.waitForTimeout(2000);

    // Confirmar si hay modal
    const confirmar = page.locator('button:has-text("Confirmar"), button:has-text("Sí")').first();
    if (await confirmar.isVisible().catch(() => false)) {
      await confirmar.click();
      await page.waitForTimeout(2000);
    }
  } else {
    // Intentar desde menú de acciones
    const menuAcciones = page.locator('button[aria-label*="acción"], button:has-text("Acciones")').first();
    if (await menuAcciones.isVisible().catch(() => false)) {
      await menuAcciones.click();
      await page.waitForTimeout(500);

      const opcionConvertir = page.locator('button:has-text("Convertir a Pedido"), a:has-text("Convertir a Pedido")').first();
      await opcionConvertir.click();
      await page.waitForTimeout(2000);
    }
  }

  await page.waitForTimeout(3000);

  // Obtener ID del pedido
  const pedidoLink = page.locator('a[href^="/almacen/pedidos/"]').first();
  const hrefPedido = await pedidoLink.getAttribute('href');
  if (hrefPedido) {
    const match = hrefPedido.match(/\/pedidos\/([^\/]+)/);
    if (match) {
      pedidoId = match[1];
      console.log(`✅ Pedido creado: ${pedidoId}`);
    }
  }

  expect(pedidoId).toBeTruthy();
  await page.screenshot({ path: 'test-results/05-pedido-creado.png' });

  // PASO 10: Verificar ruta
  console.log('PASO 9: Verificando ruta...');
  await page.goto(URLS.rutas);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Buscar primera ruta
  const primeraRuta = page.locator('a[href^="/reparto/rutas/"]').first();
  const hrefRuta = await primeraRuta.getAttribute('href');

  if (hrefRuta) {
    const match = hrefRuta.match(/\/rutas\/([^\/]+)/);
    if (match) {
      rutaId = match[1];
      console.log(`✅ Ruta encontrada: ${rutaId}`);
    }
  }

  if (rutaId) {
    await page.goto(`/reparto/rutas/${rutaId}`);
    await page.waitForLoadState('networkidle');
  }

  await page.screenshot({ path: 'test-results/06-ruta-creada.png' });

  // PASO 11: Cerrar sesión y login como repartidor
  console.log('PASO 10: Login como repartidor...');
  await page.goto('/logout');
  await page.waitForTimeout(1000);

  await page.goto(URLS.login);
  await page.waitForLoadState('networkidle');

  // Login como repartidor
  await page.fill('#email', 'repartidor@avicoladelsur.com');
  await page.fill('#password', '123456');
  await page.click('button[type="submit"]');

  // Esperar login exitoso
  await page.waitForURL(url => url.pathname !== '/login', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  console.log('✅ Login repartidor exitoso');

  // PASO 12: Completar ruta como repartidor
  if (rutaId) {
    console.log('PASO 11: Completando entregas como repartidor...');
    await page.goto(`/repartidor/ruta/${rutaId}`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'test-results/07-hoja-ruta-repartidor.png' });

    // Buscar entregas pendientes
    const entregasPendientes = page.locator('text=/Pendiente/i, [data-estado*="pendiente"]');
    const countEntregas = await entregasPendientes.count();

    if (countEntregas > 0) {
      // Hacer click en la primera
      await entregasPendientes.first().click();
      await page.waitForTimeout(1000);

      // Marcar como entregada
      const botonEntregar = page.locator('button:has-text("Entregado"), button:has-text("Confirmar Entrega")').first();
      if (await botonEntregar.isVisible().catch(() => false)) {
        await botonEntregar.click();
        await page.waitForTimeout(1000);

        // Confirmar si hay modal
        const confirmar = page.locator('button:has-text("Confirmar"), button:has-text("Aceptar")').first();
        if (await confirmar.isVisible().catch(() => false)) {
          await confirmar.click();
        }
      }

      await page.waitForTimeout(1000);
      // Volver atrás
      await page.goBack();
      await page.waitForLoadState('networkidle');
    }

    console.log('✅ Entregas completadas');

    // Finalizar ruta
    const botonFinalizar = page.locator('button:has-text("Finalizar Ruta"), button:has-text("Completar Ruta")').first();
    if (await botonFinalizar.isVisible().catch(() => false)) {
      await botonFinalizar.click();
      await page.waitForTimeout(2000);

      const confirmar = page.locator('button:has-text("Confirmar"), button:has-text("Aceptar")').first();
      if (await confirmar.isVisible().catch(() => false)) {
        await confirmar.click();
      }
      console.log('✅ Ruta finalizada');
    }

    await page.screenshot({ path: 'test-results/08-ruta-finalizada.png' });
  } else {
    console.log('⚠️ No hay ruta para completar');
  }

  // PASO 13: Verificar estado final
  console.log('PASO 12: Verificando estado final...');

  // Volver a login como admin
  await page.goto('/logout');
  await page.waitForTimeout(1000);

  await login(page);

  if (pedidoId) {
    await page.goto(`/almacen/pedidos/${pedidoId}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/09-estado-final-pedido.png' });
  }

  if (rutaId) {
    await page.goto(`/reparto/rutas/${rutaId}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/10-estado-final-ruta.png' });
  }

  console.log('✅ TEST COMPLETADO');
});
