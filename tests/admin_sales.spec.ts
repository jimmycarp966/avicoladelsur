import { test, expect } from '@playwright/test';

test.describe('Admin Sales & Distribution Flow', () => {
    test.slow(); // This is a long flow

    test('Full Cycle: Budget -> Order -> Route Assignment', async ({ page }) => {
        // 1. Login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@avicoladelsur.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        // Debugging: Check if we are stuck on the config error page
        if (await page.isVisible('text=Configuración Requerida')) {
            console.error('ERROR: Supabase configuration missing in environment.');
        }

        // Wait for dashboard or home to ensure login success
        // Use a more specific selector to avoid strict mode violation (Sidebar vs Header)
        await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 15000 });


        // 2. Create Budgets for 4 Clients
        const clients = ['Monteagudo', 'Alberdi', 'Horqueta', 'San Martin'];
        const products = ['Suprema', 'Alas', 'Pechuga'];

        for (const clientName of clients) {
            // Navigate directly to create new budget to avoid navigation issues
            await page.goto('/ventas/presupuestos/nuevo');

            // Wait for form to load
            await expect(page.locator('h1:has-text("Nuevo Presupuesto")').or(page.locator('h2:has-text("Nuevo Presupuesto")'))).toBeVisible();

            // Select Client
            // Try to find the combobox trigger more robustly
            const clientTrigger = page.locator('button[role="combobox"]').first(); // Assuming client is the first combobox
            await clientTrigger.click();

            // Type in the search (if it exists) or just look for the text
            // Shadcn combobox usually has an input inside the content
            const searchInput = page.locator('input[placeholder="Buscar cliente..."]').or(page.locator('input[placeholder="Buscar..."]'));
            if (await searchInput.isVisible()) {
                await searchInput.fill(clientName);
            }

            // Click the option
            await page.click(`div[role="option"]:has-text("${clientName}")`);


            // Add Products
            for (const prod of products) {
                // Click "Agregar Producto" button (assuming it's a button to open modal or add row)
                // If the form has a product search line directly:
                const productTrigger = page.locator('button:has-text("Agregar producto")').first();
                if (await productTrigger.isVisible()) {
                    await productTrigger.click();
                } else {
                    // Maybe it's directly a combobox for product?
                    // Let's assume standard flow: Add -> Search -> Select
                    console.log('Button "Agregar producto" not found, checking alternatives...');
                }

                // Wait for product search input
                const prodSearchIndex = 1; // Assuming second combobox or specialized input
                // Simplified: just search for text input if trigger click worked
                await page.fill('input[placeholder="Buscar producto..."]', prod);
                await page.click(`div[role="option"]:has-text("${prod}")`);

                // Qty
                await page.fill('input[type="number"]', '10');

                // Add
                // Check if there is an "Agregar" button in the modal/row
                const addButton = page.locator('button:has-text("Agregar")').last(); // Last one to avoid confusion with main "Agregar" if any
                if (await addButton.isVisible()) {
                    await addButton.click();
                }
            }

            // Guardar
            await page.click('button:has-text("Guardar Presupuesto")');

            // Wait for success toast or redirection
            await expect(page.locator('text=Presupuesto creado').or(page.locator('text=éxito'))).toBeVisible();
        }

        // 3. Warehouse: Weighing & Conversion
        await page.goto('/almacen/presupuestos');

        // Strategy: Select all new budgets and process them.
        // Assuming there's a list. We might need to filter by today or status.
        // For simplicity in this v1, checking the first 4 that appear or searching by client.

        for (const clientName of clients) {
            // Find row with client name
            const row = page.locator('tr', { hasText: clientName }).first();
            await expect(row).toBeVisible();
            await row.click(); // Open details

            // "Pesar" / Prepare logic
            if (await page.isVisible('button:has-text("Pesar")')) {
                await page.click('button:has-text("Pesar")');
                await page.fill('input[name="peso_real"]', '10.5'); // Mock weight
                await page.click('button:has-text("Confirmar Peso")');
            }

            // Convert to Order
            await page.click('button:has-text("Convertir a Pedido")');
            await expect(page.locator('text=Pedido generado')).toBeVisible();
        }

        // 4. Route Management
        await page.goto('/reparto'); // Or /rutas
        await page.click('text=Nueva Ruta');

        // Select Driver
        await page.click('[placeholder="Seleccionar repartidor"]');
        await page.click('text=Repartidor'); // checking partial match for actual name associated with email

        // Assign Orders (selecting the ones we just made)
        for (const clientName of clients) {
            await page.click(`tr:has-text("${clientName}") input[type="checkbox"]`);
        }

        await page.click('button:has-text("Crear Ruta")');
        await expect(page.locator('text=Ruta creada')).toBeVisible();

        // Start Route (if manual start is needed)
        await page.click('button:has-text("Iniciar Ruta")');
        await expect(page.locator('text=Ruta iniciada')).toBeVisible();
    });
});
