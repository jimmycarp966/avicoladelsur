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
        # -> Input admin credentials and click 'Iniciar Sesión' to log in.
        frame = context.pages[-1]
        # Input admin email
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@avicoladelsur.com')
        

        frame = context.pages[-1]
        # Input admin password
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('123456')
        

        frame = context.pages[-1]
        # Click 'Iniciar Sesión' button to log in
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Navigate to the budget creation page or section to create a budget with valid details.
        frame = context.pages[-1]
        # Click on the button or menu to navigate to budget creation (if visible)
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/div[2]/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        await page.mouse.wheel(0, await page.evaluate('() => window.innerHeight'))
        

        # -> Click on 'Ventas' tab to access budget creation and sales management.
        frame = context.pages[-1]
        # Click on 'Ventas' tab to navigate to sales and budget creation section
        elem = frame.locator('xpath=html/body/div[2]/div/div/nav/ul/li/ul/li[4]/div/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Nuevo Presupuesto' button to start creating a new budget.
        frame = context.pages[-1]
        # Click 'Nuevo Presupuesto' button to create a new budget
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/div/div/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click client combobox button to open client search and select a client from the list.
        frame = context.pages[-1]
        # Click client combobox to open client search dropdown
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select a client from the dropdown list to proceed with budget creation.
        frame = context.pages[-1]
        # Select client 'AGUSTIN OLEA (MONTEROS)' from the dropdown
        elem = frame.locator('xpath=html/body/div[3]/div/div/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select 'Tipo de Venta' (sale type) as 'Reparto (entrega a domicilio)'.
        frame = context.pages[-1]
        # Select 'Reparto (entrega a domicilio)' radio button for sale type
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div[2]/div/label/input').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Zona de Entrega' combobox to select a delivery zone.
        frame = context.pages[-1]
        # Click 'Zona de Entrega' combobox to open delivery zone options
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div[3]/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select 'Monteros' as the delivery zone from the dropdown options.
        frame = context.pages[-1]
        # Select 'Monteros' delivery zone from dropdown
        elem = frame.locator('xpath=html/body/div[3]/div/div/div[3]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Lista de Precios (Global)' combobox to select a price list.
        frame = context.pages[-1]
        # Click 'Lista de Precios (Global)' combobox to open price list options
        elem = frame.locator('xpath=html/body/div[2]/div[3]/main/div/div/form/div/div[2]/div[4]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select 'MAYORISTA - Lista Mayorista (20% margen)' price list from the dropdown options.
        frame = context.pages[-1]
        # Select 'MAYORISTA - Lista Mayorista (20% margen)' price list option
        elem = frame.locator('xpath=html/body/div[3]/div/div/div[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select product 'ALAS KG.' from the product dropdown to add to the budget.
        frame = context.pages[-1]
        # Select product 'ALAS KG.' from the product dropdown
        elem = frame.locator('xpath=html/body/div[3]/div/div/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        try:
            await expect(frame.locator('text=Atomic Conversion Success').first).to_be_visible(timeout=1000)
        except AssertionError:
            raise AssertionError("Test failed: The conversion of budget into a confirmed order was not atomic. Partial or duplicate states may exist, violating the atomicity requirement in the test plan.")
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    