import asyncio
import random
import string
from playwright import async_api
from playwright.async_api import expect

def generate_random_code():
    return 'PROD' + ''.join(random.choices(string.digits, k=6))

async def run_test():
    pw = None
    browser = None
    context = None
    
    unique_code = generate_random_code()
    print(f"Testing with Product Code: {unique_code}")

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        
        # Create a new browser context
        context = await browser.new_context()
        context.set_default_timeout(10000)
        
        # Open a new page
        page = await context.new_page()
        
        # Navigate to login
        await page.goto("http://localhost:3000/login", wait_until="commit", timeout=15000)
        
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except async_api.Error:
            pass
        
        # Login
        await page.get_by_label("Email").fill('admin@avicoladelsur.com')
        await page.get_by_label("Contraseña").fill('123456')
        await page.get_by_role("button", name="Iniciar sesión").click()
        
        # Wait for navigation to dashboard - check for sidebar
        await expect(page.get_by_role("link", name="Reparto")).to_be_visible(timeout=10000)

        # Navigate to Almacén -> Productos
        await page.goto("http://localhost:3000/almacen/productos", wait_until="domcontentloaded")
        
        # Wait for products page to load - use Nuevo Producto button as indicator
        await expect(page.get_by_role("link", name="Nuevo Producto")).to_be_visible(timeout=15000)

        # Click 'Nuevo Producto'
        await page.get_by_role("link", name="Nuevo Producto").click()
        
        # Wait for form to load
        await expect(page.get_by_label("Código *")).to_be_visible(timeout=10000)
        
        # Form filling - using exact label text
        await page.get_by_label("Código *").fill(unique_code)
        await page.get_by_label("Nombre *").fill(f"Producto Prueba {unique_code}")
        await page.get_by_label("Categoría").fill('Aves')
        await page.get_by_label("Precio de Venta *").fill('150.00')
        await page.get_by_label("Stock Mínimo *").fill('10')
        
        # Activate switch if needed (label might vary)
        # Assuming switch has aria-label or is identifiable.
        # If not found, skip (default might be active)
        
        # Submit - button text is "Crear Producto"
        await page.get_by_role("button", name="Crear Producto").click()
        
        # Wait for redirect back to products list
        await page.wait_for_url("**/almacen/productos", timeout=10000)
        await expect(page.get_by_role("link", name="Nuevo Producto")).to_be_visible(timeout=10000)
        
        print(f"✓ Product {unique_code} created successfully")
        
        # Verify in Table - search for the product
        search_input = page.get_by_placeholder("Buscar productos...")
        await expect(search_input).to_be_visible(timeout=5000)
        await search_input.fill(unique_code)
        await page.wait_for_timeout(2000) # Wait for debounce
        
        # Check row exists
        row = page.get_by_role("row", name=unique_code)
        await expect(row).to_be_visible()

        # Open Actions Menu
        # Find the row, then find the 'Abrir menú' button within it
        menu_btn = row.get_by_role("button", name="Abrir menú")
        await menu_btn.click()
        
        # Click Edit (Editar)
        await page.get_by_role("menuitem", name="Editar").click()
        
        # Verify Edit Mode (URL or Form content)
        await expect(page.get_by_text("Editar Producto")).to_be_visible()
        
        print("TC003 Passed Successfully")

    except Exception as e:
        print(f"Test Failed: {e}")
        # Capture screenshot on failure
        if page:
            await page.screenshot(path="tc003_failure.png")
        raise e
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    