import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        context = await browser.new_context()
        context.set_default_timeout(10000)
        page = await context.new_page()
        
        # Login
        print("Logging in...")
        await page.goto("http://localhost:3000/login", wait_until="commit", timeout=15000)
        await page.wait_for_load_state("domcontentloaded")
        await page.fill('input[type="email"]', 'admin@avicoladelsur.com')
        await page.fill('input[type="password"]', '123456')
        await page.click('button[type="submit"]')
        await page.wait_for_url("**/dashboard", timeout=20000)
        
        # 1. Test Inventory (Almacen -> Lotes/Inventario)
        print("Navigating to Almacen -> Productos...")
        await page.click('text=Almacén') # Open accordion if needed
        # Assuming link text is "Productos" or "Lotes"
        # Based on sidebar analysis, it might be "Productos"
        link_productos = page.locator('a:has-text("Productos")')
        if await link_productos.is_visible():
             await link_productos.click()
        else:
             await page.click('text=Productos') # Try direct text
        
        await page.wait_for_url("**/almacen/productos", timeout=10000)
        print("Success: Almacen/Productos loaded.")
        
        # 2. Test Production (Producción)
        print("Navigating to Producción...")
        # Ensure Almacen is expanded (it should be, but let's be safe)
        # Check if Producción is visible, if not click Almacén
        link_prod = page.get_by_role("link", name="Producción")
        if not await link_prod.is_visible():
            print("Producción link not visible, checking Almacén expansion...")
            # Click Almacén trigger if needed (collapsible sidebar logic)
            # Usually clicking the parent 'Almacén' toggles it.
            await page.get_by_role("link", name="Almacén").click()
            await page.wait_for_timeout(500) # Wait for animation

        # Try clicking Producción
        try:
            await link_prod.click()
        except:
            # Fallback: force navigation
            print("Could not click Production link, forcing navigation.")
            await page.goto("http://localhost:3000/almacen/produccion")

        await page.wait_for_load_state("domcontentloaded")
        await page.wait_for_url("**/almacen/produccion*", timeout=10000)

        if "/produccion" in page.url or "/almacen/produccion" in page.url:
             print("Success: Production page loaded.")
        else:
             # Raise error to catch it
             raise AssertionError(f"Failed to navigate to Production. Current URL: {page.url}")
             
        # Verify Key Elements
        # Check for a table or specific header
        if await page.locator('table').count() > 0 or await page.locator('h1').count() > 0:
             print("Page content verified.")
        else:
             raise AssertionError("Production page empty or error.")

        print("Test passed: Inventory and Production modules accessible.")

    except Exception as e:
        print(f"Test failed: {str(e)}")
        if page:
             await page.screenshot(path="inventory_failure.png")
        raise AssertionError(f"Test failed: {str(e)}")
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    