import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session
        pw = await async_api.async_playwright().start()
        
        # Launch browser
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        
        # Create context and page
        context = await browser.new_context()
        context.set_default_timeout(10000)
        page = await context.new_page()
        
        # Navigate to login
        print("Navigating to login page...")
        await page.goto("http://localhost:3000/login", wait_until="commit", timeout=15000)
        await page.wait_for_load_state("domcontentloaded")
        
        # Interact with login form
        print("Filling credentials...")
        # Use robust selectors based on standard HTML attributes
        await page.fill('input[type="email"]', 'admin@avicoladelsur.com')
        await page.fill('input[type="password"]', '123456')
        
        # Submit
        print("Submitting form...")
        await page.click('button[type="submit"]')
        
        # Wait for navigation to dashboard
        print("Waiting for dashboard...")
        await page.wait_for_url("**/dashboard", timeout=20000)
        
        # Assertions
        print("Verifying dashboard elements...")
        # Check for "Dashboard" title
        await expect(page.locator('h1')).to_contain_text("Dashboard")
        
        # Check for welcome message
        await expect(page.locator('text=Bienvenido')).to_be_visible()
        
        print("Test passed: Login successful and Dashboard verified.")
        
    except Exception as e:
        print(f"Test failed: {str(e)}")
        # Capture screenshot on failure
        if page:
             await page.screenshot(path="login_failure.png")
        raise AssertionError(f"Test failed: {str(e)}")
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())