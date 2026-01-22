import { Page, test } from '@playwright/test';

export async function login(page: Page) {
  await page.goto('/login');
  
  // Esperar a que cargue el formulario de login
  await page.waitForLoadState('networkidle');
  
  // Esperar a que los campos estén disponibles
  await page.waitForSelector('#email', { state: 'visible' });
  await page.waitForSelector('#password', { state: 'visible' });
  
  // Llenar el formulario de login con los selectores correctos
  await page.fill('#email', 'admin@avicoladelsur.com');
  await page.fill('#password', '123456');
  
  // Esperar a que el botón de submit esté disponible
  await page.waitForSelector('button[type="submit"]', { state: 'visible' });
  
  // Hacer clic en el botón de iniciar sesión
  await page.click('button[type="submit"]');
  
  // Esperar a que se redirija al dashboard o página principal
  // Aumentar el timeout a 30 segundos y verificar que no haya errores
  try {
    await page.waitForURL(url => url.pathname !== '/login', { timeout: 30000 });
  } catch (error) {
    // Verificar si hay mensajes de error en el formulario
    const errorMessage = page.locator('.text-destructive').first();
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      throw new Error(`Login falló: ${errorText}`);
    }
    throw error;
  }
  
  await page.waitForLoadState('networkidle');
}

export async function loginAndNavigate(page: Page, path: string) {
  await login(page);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
