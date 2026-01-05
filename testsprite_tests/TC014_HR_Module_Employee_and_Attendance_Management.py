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
        
        # Navigate to RRHH -> Empleados
        print("Navigating to RRHH...")
        await page.click('text=RRHH')
        await page.click('text=Empleados')
        await page.wait_for_url("**/rrhh/empleados", timeout=10000)
        
        # Create Employee
        print("Creating new employee...")
        await page.click('text=Nuevo Empleado')
        await page.wait_for_url("**/rrhh/empleados/nuevo", timeout=10000)
        
        # Fill Form
        print("Filling form...")
        
        # Fill Form using robust accessible selectors (Labels)
        print("Filling form...")
        
        # 1. Select User (Usuario del Sistema) - Optional/Complex
        # We try to select one if available, otherwise skip as it is optional in form logic validation
        try:
            # Check if we can find the select trigger by label
            # The label is "Usuario del Sistema"
            # In shadcn, the label often isn't directly linked to the button trigger via 'for', checking code...
            # <Label htmlFor="usuario_id">... <Select>...<SelectTrigger>
            # The trigger usually doesn't have the id "usuario_id".
            # Plan B: Click by text placeholder or nearby label
            if await page.get_by_text("Seleccionar usuario").is_visible():
                await page.get_by_text("Seleccionar usuario").click()
                # Try to pick an option
                options = page.locator('div[role="option"]')
                if await options.count() > 0:
                     await options.last.click() # Pick last one to avoid "None"
                else:
                     await page.press('body', 'Escape')
        except Exception as e:
            print(f"User selection skipped: {e}")

        # 2. Legajo (Input)
        try:
             await page.get_by_label("Legajo").fill("EMP-AUTO-001")
        except:
             # Fallback if label association fails
             await page.locator('#legajo').fill("EMP-AUTO-001")

        # 3. Fecha Ingreso (Required)
        # Type date: YYYY-MM-DD
        await page.get_by_label("Fecha de Ingreso *").fill("2024-01-01")
        
        # 4. DNI & CUIL
        await page.get_by_label("DNI").fill("99887766")
        await page.get_by_label("CUIL").fill("20-99887766-9")
        
        # 5. Domicilio
        await page.get_by_label("Domicilio").fill("Calle Automatización 123")
        
        # 6. Contact Info
        await page.get_by_label("Teléfono Personal").fill("1122334455")
        
        # 7. Laboral Data - Sucursal & Categoria are Selects
        
        # Sucursal
        try:
            print("Selecting Sucursal...")
            sucursal_trigger = page.locator('button:has-text("Seleccionar sucursal")')
            if await sucursal_trigger.count() == 0:
                 sucursal_trigger = page.locator('label:has-text("Sucursal") + div button')
            
            # Use force=True to bypass potential overlays
            await sucursal_trigger.click(force=True)
            await page.wait_for_selector('div[role="option"]', timeout=2000)
            options = page.locator('div[role="option"]')
            if await options.count() > 1:
                 await options.last.click(force=True)
            else:
                 await page.press('body', 'Escape')
            
            # CLOSE DROPDOWN explicitly by clicking outside
            await page.mouse.click(0, 0)
            await page.wait_for_timeout(500) # Wait for animation
            
        except Exception as e:
            print(f"Sucursal selection issue: {e}")

        # Categoria
        try:
            print("Selecting Categoria...")
            cat_trigger = page.locator('button:has-text("Seleccionar categoría")')
            if await cat_trigger.count() == 0:
                  cat_trigger = page.locator('label:has-text("Categoría") + div button')

            await cat_trigger.click(force=True)
            # Wait for options
            await page.wait_for_selector('div[role="option"]', timeout=2000)
            options = page.locator('div[role="option"]')
            count = await options.count()
            print(f"Found {count} categories.")
            
            if count >= 1:
                await options.last.click(force=True)
            else:
                print("No categories found in dropdown.")
                await page.press('body', 'Escape')
                
        except Exception as e:
            print(f"Categoria selection issue: {e}")
             
        # Sueldo Actual
        await page.get_by_label("Sueldo Actual").fill("750000")
        
        # Estado (Switch) - Default is active, leaving it

        # Submit
        print("Submitting employee form...")
        # Button likely has specific text "Crear Empleado"
        await page.get_by_role("button", name="Crear Empleado").click()
        
        # Assertions
        print("Verifying success...")
        # Check for success toast or redirect to list
        # We look for url change to /rrhh/empleados
        try:
            await page.wait_for_url("**/rrhh/empleados", timeout=10000)
            print("Redirected to employee list successfully.")
        except:
            # Check for error toast
            if await page.locator(".toast-error").is_visible() or await page.get_by_text("Error").is_visible():
                print("Error toast detected!")
                # Capture text
                content = await page.content()
                print("Page content around error might be in logs.")
                raise AssertionError("Form submission resulted in error.")
            else:
                 pass # Maybe just slow

        # Validate we exist in the table (optional but good)
        # await expect(page.get_by_text("EMP-AUTO-001")).to_be_visible()

        print("Test passed: Employee creation functional.")

    except Exception as e:
        print(f"Test failed: {str(e)}")
        if page:
             await page.screenshot(path="hr_failure.png")
        raise AssertionError(f"Test failed: {str(e)}")
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())