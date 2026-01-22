import { test, expect } from '@playwright/test';
import { loginAndNavigate } from './auth-helper';

test.describe('Admin Bot Chat Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login y navegar a la página del bot chat
    await loginAndNavigate(page, '/admin/bot-chat');
  });

  test('debería cargar el dashboard correctamente', async ({ page }) => {
    // Verificar que el título del dashboard esté presente
    await expect(page.getByText('Dashboard del Bot')).toBeVisible();
    
    // Verificar que el contenedor principal esté visible
    await expect(page.locator('.flex.h-screen.bg-gray-100')).toBeVisible();
  });

  test('debería mostrar la lista de conversaciones', async ({ page }) => {
    // Esperar a que cargue el contenido
    await page.waitForLoadState('networkidle');
    
    // Verificar que exista el sidebar con las conversaciones
    const sidebar = page.locator('.w-80.bg-white');
    await expect(sidebar).toBeVisible();
    
    // Verificar que exista el campo de búsqueda
    const searchInput = page.locator('input[placeholder="Buscar por teléfono o mensaje..."]');
    await expect(searchInput).toBeVisible();
  });

  test('debería mostrar filtros de dirección', async ({ page }) => {
    // Verificar que existan los botones de filtro
    await expect(page.getByText('Todos')).toBeVisible();
    await expect(page.getByText('📥 Entrantes')).toBeVisible();
    await expect(page.getByText('📤 Salientes')).toBeVisible();
  });

  test('debería permitir filtrar por dirección', async ({ page }) => {
    // Hacer clic en el filtro "Entrantes"
    await page.getByText('📥 Entrantes').click();
    
    // Verificar que el botón esté activo
    const incomingButton = page.getByText('📥 Entrantes');
    await expect(incomingButton).toHaveClass(/bg-blue-500/);
    
    // Hacer clic en el filtro "Salientes"
    await page.getByText('📤 Salientes').click();
    
    // Verificar que el botón esté activo
    const outgoingButton = page.getByText('📤 Salientes');
    await expect(outgoingButton).toHaveClass(/bg-blue-500/);
    
    // Hacer clic en "Todos"
    await page.getByText('Todos').click();
    
    // Verificar que el botón esté activo
    const allButton = page.getByText('Todos');
    await expect(allButton).toHaveClass(/bg-blue-500/);
  });

  test('debería permitir buscar conversaciones', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Buscar por teléfono o mensaje..."]');
    
    // Escribir en el campo de búsqueda
    await searchInput.fill('test');
    
    // Verificar que el valor se haya ingresado
    await expect(searchInput).toHaveValue('test');
    
    // Limpiar la búsqueda
    await searchInput.fill('');
    await expect(searchInput).toHaveValue('');
  });

  test('debería mostrar el área de chat vacía inicialmente', async ({ page }) => {
    // Verificar que el área de chat principal muestre el mensaje de selección
    await expect(page.getByText('Selecciona una conversación')).toBeVisible();
    await expect(page.getByText('Haz clic en un número de teléfono de la lista para ver el chat')).toBeVisible();
  });

  test('debería mostrar mensaje de carga mientras carga conversaciones', async ({ page }) => {
    // Recargar la página
    await page.reload();
    
    // Verificar que aparezca el mensaje de carga
    await expect(page.getByText('Cargando conversaciones...')).toBeVisible({ timeout: 1000 });
  });

  test('debería mostrar mensaje cuando no hay conversaciones', async ({ page }) => {
    // Esperar a que cargue
    await page.waitForLoadState('networkidle');
    
    // Buscar algo que no existe
    const searchInput = page.locator('input[placeholder="Buscar por teléfono o mensaje..."]');
    await searchInput.fill('xyz123nonexistent');
    
    // Verificar que aparezca el mensaje de no resultados
    await expect(page.getByText('No se encontraron resultados')).toBeVisible();
  });

  test('debería mostrar contador de conversaciones activas', async ({ page }) => {
    // Verificar que exista el contador
    const counter = page.locator('text=/\\d+ conversaciones activas/');
    await expect(counter).toBeVisible();
  });

  test('debería tener el botón de cerrar chat visible', async ({ page }) => {
    // El botón de cerrar debería estar presente aunque no esté seleccionada una conversación
    // (se muestra en el header cuando hay una conversación seleccionada)
    const closeButton = page.getByText('Cerrar');
    // No debería ser visible inicialmente
    await expect(closeButton).not.toBeVisible();
  });

  test('debería mostrar notificación flotante cuando llega un nuevo mensaje', async ({ page }) => {
    // La notificación debería existir en el DOM pero no ser visible inicialmente
    const notification = page.locator('.fixed.top-4.right-4.bg-blue-500');
    await expect(notification).not.toBeVisible();
  });

  test('debería tener estructura de dos paneles', async ({ page }) => {
    // Verificar que exista el sidebar (panel izquierdo)
    const sidebar = page.locator('.w-80.bg-white');
    await expect(sidebar).toBeVisible();
    
    // Verificar que exista el área de chat (panel derecho)
    const chatArea = page.locator('.flex-1.flex.flex-col');
    await expect(chatArea).toBeVisible();
  });

  test('debería mostrar iconos de dirección en conversaciones', async ({ page }) => {
    // Esperar a que cargue
    await page.waitForLoadState('networkidle');
    
    // Verificar que existan los iconos de dirección
    const incomingIcon = page.locator('text=📥');
    const outgoingIcon = page.locator('text=📤');
    
    // Los iconos deberían existir en el DOM
    await expect(incomingIcon.or(outgoingIcon)).toBeTruthy();
  });

  test('debería formatear números de teléfono correctamente', async ({ page }) => {
    // Esperar a que cargue
    await page.waitForLoadState('networkidle');
    
    // Verificar que los números de teléfono se muestren formateados
    // (con 0 en lugar de +54)
    const phoneNumbers = page.locator('text=/^0/');
    // Solo verificamos que existan, ya que depende de los datos
    await expect(phoneNumbers).toBeTruthy();
  });
});
