import { test, expect } from '@playwright/test';
import { loginAndNavigate } from './auth-helper';

test.describe('RRHH - Pruebas Integrales de Módulos', () => {

    test('Módulo de Asistencia - Carga y Elementos Clave', async ({ page }) => {
        await loginAndNavigate(page, '/rrhh/asistencia');

        // Título y descripción
        await expect(page.getByRole('heading', { name: 'Control de Asistencia' })).toBeVisible();

        // KPIs de Asistencia
        await expect(page.getByText('Presentismo Diario')).toBeVisible();
        await expect(page.getByText('Tardanzas (Mes)')).toBeVisible();
        await expect(page.getByText('Faltas sin Aviso')).toBeVisible();

        // Tabla de asistencia
        await expect(page.locator('table')).toBeVisible();

        // Botón Marcar Asistencia
        const marcarBtn = page.getByRole('link', { name: /Marcar Asistencia/i });
        await expect(marcarBtn).toBeVisible();
        await marcarBtn.click();
        await expect(page).toHaveURL(/.*asistencia\/marcar/);
    });

    test('Módulo de Adelantos - Carga y Validación de Límites', async ({ page }) => {
        await loginAndNavigate(page, '/rrhh/adelantos');

        // Título
        await expect(page.getByRole('heading', { name: 'Gestión de Adelantos' })).toBeVisible();

        // KPIs de Adelantos
        await expect(page.getByText('Total Adelantos')).toBeVisible();
        await expect(page.getByText('Pendientes')).toBeVisible();

        // Tabla
        await expect(page.locator('table')).toBeVisible();

        // Botón Nuevo Adelanto
        const nuevoBtn = page.getByRole('link', { name: /Nuevo Adelanto/i });
        await expect(nuevoBtn).toBeVisible();
        await nuevoBtn.click();
        await expect(page).toHaveURL(/.*adelantos\/nuevo/);
    });

    test('Módulo de Liquidaciones - Carga y Procesamiento', async ({ page }) => {
        await loginAndNavigate(page, '/rrhh/liquidaciones');

        // Título
        await expect(page.getByRole('heading', { name: 'Liquidaciones de Sueldo' })).toBeVisible();

        // Tabla de liquidaciones
        await expect(page.locator('table')).toBeVisible();

        // Botón Calcular Liquidaciones
        const calcularBtn = page.getByRole('link', { name: /Calcular Liquidaciones/i });
        await expect(calcularBtn).toBeVisible();
        await calcularBtn.click();
        await expect(page).toHaveURL(/.*liquidaciones\/calcular/);
    });

    test('Módulo de Licencias - Gestión de Permisos', async ({ page }) => {
        await loginAndNavigate(page, '/rrhh/licencias');

        // Título
        await expect(page.getByRole('heading', { name: 'Licencias y Descansos' })).toBeVisible();

        // Tabla
        await expect(page.locator('table')).toBeVisible();

        // Botón Nueva Licencia
        const nuevaBtn = page.getByRole('link', { name: /Nueva Licencia/i });
        await expect(nuevaBtn).toBeVisible();
        await nuevaBtn.click();
        await expect(page).toHaveURL(/.*licencias\/nueva/);
    });

    test('Módulo de Evaluaciones - Desempeño', async ({ page }) => {
        await loginAndNavigate(page, '/rrhh/evaluaciones');

        // Título
        await expect(page.getByRole('heading', { name: 'Evaluaciones de Desempeño' })).toBeVisible();

        // Tabla o Grid de evaluaciones
        await expect(page.locator('table')).toBeVisible();

        // Botón Nueva Evaluación
        const nuevaBtn = page.getByRole('link', { name: /Nueva Evaluación/i });
        await expect(nuevaBtn).toBeVisible();
        await nuevaBtn.click();
        await expect(page).toHaveURL(/.*evaluaciones\/nueva/);
    });

    test('Módulo de Novedades - Comunicación Interna', async ({ page }) => {
        await loginAndNavigate(page, '/rrhh/novedades');

        // Título
        await expect(page.getByRole('heading', { name: 'Novedades y Comunicados' })).toBeVisible();

        // Botón Nueva Novedad
        const nuevaBtn = page.getByRole('link', { name: /Nueva Novedad/i });
        await expect(nuevaBtn).toBeVisible();
        await nuevaBtn.click();
        await expect(page).toHaveURL(/.*novedades\/nueva/);
    });

});
