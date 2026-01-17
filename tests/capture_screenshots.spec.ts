import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Define the output directory relative to the project root
const OUTPUT_DIR = 'capturas';

const routes = [
    // Dashboard
    { name: '01_Dashboard', path: '/dashboard' },

    // Almacen
    { name: '02_Almacen_Main', path: '/almacen' },
    { name: '02_Almacen_Productos', path: '/almacen/productos' },
    { name: '02_Almacen_Lotes', path: '/almacen/lotes' },
    { name: '02_Almacen_Produccion', path: '/almacen/produccion' },
    { name: '02_Almacen_Recepcion', path: '/almacen/recepcion' },
    { name: '02_Almacen_Documentos', path: '/almacen/documentos' },
    { name: '02_Almacen_Pedidos', path: '/almacen/pedidos' },
    { name: '02_Almacen_Presupuestos_Dia', path: '/almacen/presupuestos-dia' },

    // Reparto (Admin/Planner view)
    { name: '03_Reparto_Main', path: '/reparto' },
    { name: '03_Reparto_Monitor', path: '/reparto/monitor' },
    { name: '03_Reparto_Planificacion', path: '/reparto/planificacion' },
    { name: '03_Reparto_Rutas', path: '/reparto/rutas' },
    { name: '03_Reparto_Vehiculos', path: '/reparto/vehiculos' },

    // Ventas
    { name: '04_Ventas_Main', path: '/ventas' },
    { name: '04_Ventas_Clientes', path: '/ventas/clientes' },
    { name: '04_Ventas_Presupuestos', path: '/ventas/presupuestos' },
    { name: '04_Ventas_Listas_Precios', path: '/ventas/listas-precios' },
    { name: '04_Ventas_Reclamos', path: '/ventas/reclamos' },

    // Tesoreria
    { name: '05_Tesoreria_Main', path: '/tesoreria' },
    { name: '05_Tesoreria_Cajas', path: '/tesoreria/cajas' },
    { name: '05_Tesoreria_Cuentas_Corrientes', path: '/tesoreria/cuentas-corrientes' },
    { name: '05_Tesoreria_Gastos', path: '/tesoreria/gastos' },
    { name: '05_Tesoreria_Proveedores', path: '/tesoreria/proveedores' },
    { name: '05_Tesoreria_Sucursales', path: '/tesoreria/sucursales' },
    { name: '05_Tesoreria_Tesoro', path: '/tesoreria/tesoro' },

    // RRHH
    { name: '06_RRHH_Main', path: '/rrhh' },
    { name: '06_RRHH_Adelantos', path: '/rrhh/adelantos' },
    { name: '06_RRHH_Asistencia', path: '/rrhh/asistencia' },
    { name: '06_RRHH_Empleados', path: '/rrhh/empleados' },
    { name: '06_RRHH_Evaluaciones', path: '/rrhh/evaluaciones' },
    { name: '06_RRHH_Licencias', path: '/rrhh/licencias' },
    { name: '06_RRHH_Liquidaciones', path: '/rrhh/liquidaciones' },
    { name: '06_RRHH_Novedades', path: '/rrhh/novedades' },
    { name: '06_RRHH_Reportes', path: '/rrhh/reportes' },

    // Sucursales Management
    { name: '07_Sucursales_Main', path: '/sucursales' },
    { name: '07_Sucursales_Nueva', path: '/sucursales/nueva' },
    { name: '07_Sucursales_Transferencias', path: '/sucursales/transferencias' },

    // Reportes
    { name: '08_Reportes_Main', path: '/reportes' },
];

test.describe('Capture All ERP Screenshots for Redesign', () => {
    const screenshotDir = path.join(process.cwd(), OUTPUT_DIR);

    test.beforeAll(async () => {
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        console.log(`Saving screenshots to: ${screenshotDir}`);
    });

    test('Login and capture all routes', async ({ page }) => {
        // Increase timeout for the whole test
        test.setTimeout(5 * 60 * 1000);

        // 1. Authenticate as Admin
        console.log('Navigating to login...');

        try {
            await page.goto('/login');
            // Wait for login form
            console.log('Waiting for #email selector...');
            await page.waitForSelector('#email', { state: 'visible', timeout: 60000 });

            await page.fill('#email', 'admin@avicoladelsur.com');
            await page.fill('#password', '123456');
            await page.click('button[type="submit"]');

            // Wait for redirection to dashboard
            console.log('Waiting for redirection to dashboard...');
            await page.waitForURL('**/dashboard', { timeout: 60000 });
            console.log('Login successful, starting capture sequence...');
        } catch (e) {
            console.error('Login failed:', e);
            await page.screenshot({ path: path.join(screenshotDir, 'DEBUG_LOGIN_FAIL.png'), fullPage: true });
            const content = await page.content();
            fs.writeFileSync(path.join(screenshotDir, 'DEBUG_LOGIN_FAIL.html'), content);
            throw e; // Fail the test
        }

        // 2. Capture Sidebar explicitly first
        // Assuming sidebar is visible on dashboard
        try {
            await page.waitForTimeout(2000); // Wait for animations
            const sidebar = page.locator('aside'); // Common tag for sidebars
            if (await sidebar.count() > 0 && await sidebar.isVisible()) {
                await sidebar.screenshot({ path: path.join(screenshotDir, '00_Sidebar_Component.png') });
                console.log('Captured Sidebar component');
            } else {
                console.log('Sidebar element not distinctly found with "aside" tag, relying on full page captures.');
            }
        } catch (e) {
            console.log('Could not capture sidebar specifically:', e);
        }

        // 3. Iterate Routes
        for (const route of routes) {
            console.log(`Navigating to: ${route.name} (${route.path})`);
            try {
                await page.goto(route.path, { waitUntil: 'domcontentloaded' });

                // Wait a bit for network idle or hydration
                try {
                    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { });
                } catch (e) { }

                await page.waitForTimeout(1500); // Allow for animations

                const filename = `${route.name}.png`;
                await page.screenshot({
                    path: path.join(screenshotDir, filename),
                    fullPage: true
                });
                console.log(`  --> Captured: ${filename}`);

            } catch (error: any) {
                console.error(`  !! Failed to capture ${route.name}:`, error.message);
                try {
                    await page.screenshot({ path: path.join(screenshotDir, `FAIL_${route.name}.png`) });
                } catch (e) { }
            }
        }

        console.log('All captures completed.');
    });
});
