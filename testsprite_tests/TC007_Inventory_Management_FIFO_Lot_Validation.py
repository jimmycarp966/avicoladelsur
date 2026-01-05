import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:3000", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Input admin email and password, then click login button
        frame = context.pages[-1]
        # Input admin email
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@avicoladelsur.com')
        

        frame = context.pages[-1]
        # Input admin password
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('123456')
        

        frame = context.pages[-1]
        # Click Iniciar Sesión button to login
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Almacén' tab to access inventory management and add multiple lots of the same product with different production dates
        frame = context.pages[-1]
        # Click on 'Almacén' tab in sidebar to open inventory management
        elem = frame.locator('xpath=html/body/div[2]/div/div/nav/ul/li/ul/li[3]/div/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Navigate to 'Lotes' section to add multiple lots of the same product with different production dates
        frame = context.pages[-1]
        # Click on 'Lotes' tab under Almacén to manage product lots
        elem = frame.locator('xpath=html/body/div[2]/div/div/nav/ul/li/ul/li[3]/div/div/a[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Nuevo Lote' button to add a new lot of the product
        frame = context.pages[-1]
        # Click on 'Nuevo Lote' button to add a new lot
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/div/div/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select a product from the product dropdown to start adding the first lot
        frame = context.pages[-1]
        # Click on 'Selecciona un producto' dropdown to select a product
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select product 'Producto Prueba PROD631385' (index 371) to add first lot
        frame = context.pages[-1]
        # Select 'Producto Prueba PROD631385' from product dropdown
        elem = frame.locator('xpath=html/body/div[3]/div/div/div[371]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Input lot details for first lot: quantity 100, expiration date 2026-01-10, provider 'Proveedor A', cost 10.00, location 'Estante A-1' and create the lot
        frame = context.pages[-1]
        # Input quantity 100 for first lot
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('100')
        

        frame = context.pages[-1]
        # Input expiration date 2026-01-10 for first lot
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div[2]/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('2026-01-10')
        

        frame = context.pages[-1]
        # Input provider name for first lot
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div[3]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Proveedor A')
        

        frame = context.pages[-1]
        # Input unit cost 10.00 for first lot
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div[3]/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('10.00')
        

        frame = context.pages[-1]
        # Input location in warehouse for first lot
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div[4]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Estante A-1')
        

        frame = context.pages[-1]
        # Click 'Crear Lote' button to create first lot
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div[2]/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        try:
            await expect(frame.locator('text=Allocation from earliest batch confirmed').first).to_be_visible(timeout=1000)
        except AssertionError:
            raise AssertionError("Test failed: The system did not allocate stock from the earliest lot batch as required by the FIFO inventory management test plan.")
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    