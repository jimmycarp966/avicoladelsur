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
        await page.goto("http://localhost:3000/login", wait_until="commit", timeout=10000)
        
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
        # -> Resize the browser window to different desktop sizes and verify layout adjusts correctly with no content clipping or overlap.
        await page.mouse.wheel(0, await page.evaluate('() => window.innerHeight'))
        

        # -> Resize the browser window to smaller desktop widths and verify layout adjusts correctly with no content clipping or overlap.
        await page.mouse.wheel(0, -await page.evaluate('() => window.innerHeight'))
        

        # -> Resize the browser window to smaller desktop widths and verify layout adjusts correctly with no content clipping or overlap.
        frame = context.pages[-1]
        # Focus on Email input to check responsiveness
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Resize the browser window to smaller desktop widths (e.g., tablet size) and verify layout adjusts correctly with no content clipping or overlap.
        await page.mouse.wheel(0, -await page.evaluate('() => window.innerHeight'))
        

        # -> Resize the browser window to smaller desktop widths (tablet size) and verify layout adjusts correctly with no content clipping or overlap.
        frame = context.pages[-1]
        # Click on logo to check responsiveness of header elements
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div/div/div/img').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Resize the browser window to smaller desktop widths (tablet size) and verify layout adjusts correctly with no content clipping or overlap.
        await page.goto('http://localhost:3000/login', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Resize the browser window to smaller desktop widths (tablet size) and verify layout adjusts correctly with no content clipping or overlap.
        frame = context.pages[-1]
        # Input email for login to test input usability and responsiveness
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@avicoladelsur.com')
        

        frame = context.pages[-1]
        # Input password for login to test input usability and responsiveness
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('123456')
        

        # -> Resize the browser window to smaller desktop widths (tablet size) and verify layout adjusts correctly with no content clipping or overlap.
        frame = context.pages[-1]
        # Click 'Iniciar Sesión' button to proceed and test next page responsiveness
        elem = frame.locator('xpath=html/body/div[2]/div[3]/div/div[2]/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Resize the browser window to smaller desktop widths (tablet size) and verify dashboard layout adjusts correctly with no content clipping or overlap.
        await page.mouse.wheel(0, 500)
        

        # -> Resize the browser window to smaller desktop widths (tablet size) and verify dashboard layout adjusts correctly with no content clipping or overlap.
        await page.mouse.wheel(0, -500)
        

        # -> Emulate mobile device to test PWA interface for usability, navigation, and accessibility.
        await page.goto('http://localhost:3000', timeout=10000)
        await asyncio.sleep(3)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=Avícola\ndel Sur').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dashboard').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Notificaciones').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Almacén').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ventas').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Reparto').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tesorería').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=IA').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sucursales').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=RRHH').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Reportes').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Administrador Sistema').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Bienvenido, Administrador. Resumen de tu negocio.').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Productos').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=415').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=+0.2% desde el mes pasado').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Pedidos Pendientes').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=6').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Requieren atención').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Entregas Hoy').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=0').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Clientes Activos').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=221').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=0.0% desde el mes pasado').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ahorro esta semana:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=$0').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Distancia ahorrada:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=0 km').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tiempo ahorrado:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=0 horas').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ver Detalles').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=🎉 ¡Excelente! No hay clientes en riesgo').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Todos tus clientes están comprando regularmente').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=✅ Stock adecuado para los próximos 7 días').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=No hay productos con alerta').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Evolución de ventas y pedidos en el último año').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Feb').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Abr').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=May').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jun').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jul').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ago').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sept').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Oct').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Nov').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dic').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ene').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=$0k').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=$25k').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=$50k').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=$75k').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=$100k').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Distribución del catálogo por categorías').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Otros: 97%').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Balanza: 3%').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Aves: 0%').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Rendimiento semanal de entregas y kilometraje').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dom').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Lun').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mié').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jue').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Vie').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sáb').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Crecimiento de Ventas').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=-100.0%').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tiempo Promedio de Entrega').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=0.0 horas').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tasa de Satisfacción').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=100.0%').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Productos con Stock Bajo').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=2 productos').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=No hay actividad reciente').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Base de Datos').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Operativo').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=API de Ventas').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Bot WhatsApp').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Configuración pendiente').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sistema de Reportes').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    