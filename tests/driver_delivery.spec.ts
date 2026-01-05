import { test, expect } from '@playwright/test';

test.describe('Driver Delivery Flow', () => {
    test.slow();

    test('Complete Route Deliveries', async ({ page }) => {
        // 1. Login as Driver
        await page.goto('/login');
        await page.fill('input[type="email"]', 'repartidor@avicoladelsur.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        // 2. Access Current Route
        // Assuming dashboard has a direct link "Ver Ruta Actual" or similar
        await page.click('text=Ver Ruta Actual'); // Or navigate to /entregas or /ruta/[id]

        // Verify we are on the route page
        // Use a specific selector
        await expect(page.locator('h1:has-text("Ruta")').or(page.locator('h2:has-text("Ruta")'))).toBeVisible();

        // 3. Process Deliveries
        // Get all delivery cards/rows
        // We'll process them one by one. Since completing one might remove it contextually or change its status,
        // we'll look for "Pendiente" items repeatedly.

        const getFirstPending = () => page.locator('text=Pendiente').first();

        // While there are pending deliveries...
        // Note: In a real test we'd iterate a fixed number or use specific clients, 
        // effectively doing 'while (await getFirstPending().isVisible())'
        // For robustness, let's look for the specific clients we know are in the route.
        const clients = ['Monteagudo', 'Alberdi', 'Horqueta', 'San Martin'];

        for (const client of clients) {
            // Find the card/link for this client
            // Assuming card acts as a link or has a "Ver Detalles" button
            const clientCard = page.locator(`text=${client}`);
            await clientCard.click();

            // Now in Entrega Detail (EntregaClienteForm)

            // Fill Payment Info
            await page.selectOption('select', { label: 'Pagó completo' }); // Based on "option value='pagado'>Pagó completo<" 
            // In shadcn select, it might not be a standard select. Re-checking component...
            // Standard <select> was seen in the code: <select className="..." ...>

            await page.selectOption('select', 'pagado'); // Value based

            // Wait for method select to appear
            await page.selectOption('select >> nth=1', 'efectivo'); // Second select is method

            // Amount should differ defaults, but let's confirm it
            // Code: setMontoCobrado(parseFloat(e.target.value))
            // Ensure button is enabled

            await page.click('button:has-text("Registrar cobro")');
            // Wait for toast "Cobro registrado"
            await expect(page.locator('text=Cobro registrado')).toBeVisible();

            // Mark as Delivered
            // Code: Button text "Entregado"
            await page.click('button:has-text("Entregado")');
            // Wait for toast "Entrega completada"
            await expect(page.locator('text=Entrega completada')).toBeVisible();

            // Should navigate back or we go back to list
            await page.goto('/entregas'); // Force return to list if not auto
        }
    });

});
