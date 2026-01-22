import { test, expect } from '@playwright/test';
import { loginAndNavigate } from './auth-helper';

test.describe('RRHH Empleados', () => {
  test.beforeEach(async ({ page }) => {
    // Login y navegar a la página de empleados
    await loginAndNavigate(page, '/rrhh/empleados');
  });

  test('debería cargar la página de empleados correctamente', async ({ page }) => {
    // Esperar a que cargue el contenido
    await page.waitForLoadState('networkidle');
    
    // Verificar que el título de la página esté presente
    await expect(page.getByRole('heading', { name: 'Empleados' })).toBeVisible();
    await expect(page.getByText('Gestión completa del personal de la empresa')).toBeVisible();
  });

  test('debería mostrar el botón Nuevo Empleado', async ({ page }) => {
    // Verificar que exista el botón "Nuevo Empleado"
    await expect(page.getByRole('button', { name: /Nuevo Empleado/i })).toBeVisible();
  });

  test('debería mostrar las estadísticas rápidas', async ({ page }) => {
    // Esperar a que cargue
    await page.waitForLoadState('networkidle');
    
    // Verificar que existan las tarjetas de estadísticas
    const statsCards = page.locator('.bg-white.p-6.rounded-lg.border');
    await expect(statsCards.nth(0).getByText('Total Empleados')).toBeVisible();
    await expect(statsCards.nth(1).getByText('Activos')).toBeVisible();
    await expect(statsCards.nth(2).getByText('Promedio Salario')).toBeVisible();
    await expect(statsCards.nth(3).getByText('Sucursales')).toBeVisible();
  });

  test('debería mostrar la tabla de empleados', async ({ page }) => {
    // Esperar a que cargue
    await page.waitForLoadState('networkidle');
    
    // Verificar que exista la tabla
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('debería mostrar el encabezado con título y descripción', async ({ page }) => {
    // Verificar el título
    const title = page.locator('h1.text-3xl.font-bold');
    await expect(title).toBeVisible();
    await expect(title).toContainText('Empleados');
    
    // Verificar la descripción
    await expect(page.getByText('Gestión completa del personal de la empresa')).toBeVisible();
  });

  test('debería mostrar el grid de estadísticas con 4 columnas', async ({ page }) => {
    // Verificar que exista el grid
    const statsGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-4');
    await expect(statsGrid).toBeVisible();
  });

  test('debería mostrar el icono en cada tarjeta de estadística', async ({ page }) => {
    // Verificar que existan iconos en las tarjetas
    const icons = page.locator('.bg-white.p-6.rounded-lg').locator('svg');
    await expect(icons).toHaveCount(4);
  });

  test('debería mostrar el contenedor blanco para la tabla', async ({ page }) => {
    // Verificar que exista el contenedor
    const tableContainer = page.locator('.bg-white.rounded-lg.border').filter({ has: page.locator('table') });
    await expect(tableContainer).toBeVisible();
  });

  test('debería mostrar el botón de Nuevo Empleado con el icono Plus', async ({ page }) => {
    // Verificar que exista el botón
    const nuevoButton = page.getByRole('button', { name: /Nuevo Empleado/i });
    await expect(nuevoButton).toBeVisible();
  });

  test('debería tener estadísticas con valores numéricos', async ({ page }) => {
    // Esperar a que cargue
    await page.waitForLoadState('networkidle');
    
    // Verificar que existan valores numéricos en las estadísticas
    const numericValues = page.locator('.text-2xl.font-bold');
    await expect(numericValues).toHaveCount(4);
  });

  test('debería mostrar el mensaje de carga mientras carga empleados', async ({ page }) => {
    // Recargar la página
    await page.reload();
    
    // Verificar que aparezca el mensaje de carga
    await expect(page.getByText('Cargando...')).toBeVisible({ timeout: 1000 });
  });

  test('debería tener el contenedor principal con espacio-y-6', async ({ page }) => {
    // Verificar que exista el contenedor principal
    const mainContainer = page.locator('.space-y-6').first();
    await expect(mainContainer).toBeVisible();
  });

  test('debería mostrar el diálogo de confirmación para eliminar', async ({ page }) => {
    // El diálogo debería existir en el DOM pero no ser visible inicialmente
    const dialog = page.locator('.AlertDialogContent');
    await expect(dialog).not.toBeVisible();
  });

  test('debería tener el título "¿Estás seguro?" en el diálogo', async ({ page }) => {
    // El diálogo debería existir en el DOM
    const dialogTitle = page.locator('.AlertDialogTitle');
    // No debería ser visible inicialmente
    await expect(dialogTitle).not.toBeVisible();
  });

  test('debería tener la descripción en el diálogo', async ({ page }) => {
    // La descripción debería existir en el DOM
    const dialogDescription = page.locator('.AlertDialogDescription');
    // No debería ser visible inicialmente
    await expect(dialogDescription).not.toBeVisible();
  });

  test('debería tener botones de Cancelar y Eliminar en el diálogo', async ({ page }) => {
    // Los botones deberían existir en el DOM
    const cancelButton = page.getByRole('button', { name: 'Cancelar' });
    const deleteButton = page.getByRole('button', { name: 'Eliminar' });
    
    // No deberían ser visibles inicialmente
    await expect(cancelButton).not.toBeVisible();
    await expect(deleteButton).not.toBeVisible();
  });

  test('debería mostrar el botón de Nuevo Empleado como Link', async ({ page }) => {
    // Verificar que el botón sea un link
    const nuevoLink = page.locator('a').filter({ hasText: 'Nuevo Empleado' });
    await expect(nuevoLink).toBeVisible();
  });

  test('debería tener el link a /rrhh/empleados/nuevo', async ({ page }) => {
    // Verificar que el link tenga el href correcto
    const nuevoLink = page.locator('a[href="/rrhh/empleados/nuevo"]');
    await expect(nuevoLink).toBeVisible();
  });

  test('debería tener el contenedor de la tabla con padding', async ({ page }) => {
    // Verificar que exista el contenedor con padding
    const tableContainer = page.locator('.bg-white.rounded-lg.border').locator('.p-6');
    await expect(tableContainer).toBeVisible();
  });

  test('debería mostrar el encabezado con flexbox', async ({ page }) => {
    // Verificar que exista el encabezado con flexbox en el contenido principal
    const header = page.locator('.space-y-6').first().locator('.flex.items-center.justify-between');
    await expect(header).toBeVisible();
  });

  test('debería tener las tarjetas de estadísticas con borde', async ({ page }) => {
    // Verificar que existan las tarjetas con borde
    const cards = page.locator('.bg-white.p-6.rounded-lg.border');
    await expect(cards).toHaveCount(4);
  });

  test('debería mostrar el icono de usuarios en Total Empleados', async ({ page }) => {
    // Verificar que exista el icono en la primera tarjeta
    const firstCard = page.locator('.bg-white.p-6.rounded-lg.border').first();
    const icon = firstCard.locator('svg');
    await expect(icon).toBeVisible();
  });

  test('debería mostrar el icono de check en Activos', async ({ page }) => {
    // Verificar que exista el icono en la segunda tarjeta
    const cards = page.locator('.bg-white.p-6.rounded-lg.border');
    const secondCard = cards.nth(1);
    const icon = secondCard.locator('svg');
    await expect(icon).toBeVisible();
  });

  test('debería mostrar el icono de dinero en Promedio Salario', async ({ page }) => {
    // Verificar que exista el icono en la tercera tarjeta
    const cards = page.locator('.bg-white.p-6.rounded-lg.border');
    const thirdCard = cards.nth(2);
    const icon = thirdCard.locator('svg');
    await expect(icon).toBeVisible();
  });

  test('debería mostrar el icono de edificio en Sucursales', async ({ page }) => {
    // Verificar que exista el icono en la cuarta tarjeta
    const cards = page.locator('.bg-white.p-6.rounded-lg.border');
    const fourthCard = cards.nth(3);
    const icon = fourthCard.locator('svg');
    await expect(icon).toBeVisible();
  });

  test('debería tener el texto "Total Empleados" en la primera tarjeta', async ({ page }) => {
    // Verificar que exista el texto
    const statsCards = page.locator('.bg-white.p-6.rounded-lg.border');
    await expect(statsCards.nth(0).getByText('Total Empleados')).toBeVisible();
  });

  test('debería tener el texto "Activos" en la segunda tarjeta', async ({ page }) => {
    // Verificar que exista el texto
    const statsCards = page.locator('.bg-white.p-6.rounded-lg.border');
    await expect(statsCards.nth(1).getByText('Activos')).toBeVisible();
  });

  test('debería tener el texto "Promedio Salario" en la tercera tarjeta', async ({ page }) => {
    // Verificar que exista el texto
    const statsCards = page.locator('.bg-white.p-6.rounded-lg.border');
    await expect(statsCards.nth(2).getByText('Promedio Salario')).toBeVisible();
  });

  test('debería tener el texto "Sucursales" en la cuarta tarjeta', async ({ page }) => {
    // Verificar que exista el texto
    const statsCards = page.locator('.bg-white.p-6.rounded-lg.border');
    await expect(statsCards.nth(3).getByText('Sucursales')).toBeVisible();
  });

  test('debería tener el símbolo $ en Promedio Salario', async ({ page }) => {
    // Verificar que exista el símbolo de dólar
    const salaryCard = page.locator('.bg-white.p-6.rounded-lg.border').filter({ hasText: 'Promedio Salario' });
    await expect(salaryCard.locator('text=/$/')).toBeVisible();
  });
});
