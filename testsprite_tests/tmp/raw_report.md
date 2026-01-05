
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** Avicola del Sur
- **Date:** 2026-01-03
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001
- **Test Name:** User Authentication with Valid Credentials
- **Test Code:** [TC001_User_Authentication_with_Valid_Credentials.py](./TC001_User_Authentication_with_Valid_Credentials.py)
- **Test Error:** Tested login for admin role successfully with valid credentials. Admin dashboard and reports are accessible, confirming role-based data visibility. However, JWT token is not visible in UI or storage. Logout option is missing, preventing testing of other roles and full verification of RLS permissions. Recommend backend or API verification for tokens and permissions. Reporting missing logout functionality as a critical issue.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error: Route "/reportes/sucursales" used `searchParams.sucursal`. `searchParams` is a Promise and must be unwrapped with `await` or `React.use()` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
    at ReportesSucursalesPage (about://React/Server/D:%5CDaniel%5CPaginas%5CClientes%5CAvicola%20del%20Sur%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__875dbca5._.js?407:600:34)
    at resolveErrorDev (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1864:106)
    at getOutlinedModel (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1414:28)
    at parseModelString (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1528:50)
    at Object.<anonymous> (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2457:51)
    at JSON.parse (<anonymous>)
    at initializeModelChunk (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1047:30)
    at getOutlinedModel (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1352:17)
    at parseModelString (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1582:50)
    at Array.<anonymous> (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2457:51)
    at JSON.parse (<anonymous>)
    at initializeModelChunk (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1047:30)
    at resolveConsoleEntry (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1990:96)
    at processFullStringRow (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2391:17)
    at processFullBinaryRow (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2331:9)
    at processBinaryChunk (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2441:98)
    at progress (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2610:13) (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] %c%s%c D:\Daniel\Paginas\Clientes\Avicola del Sur\.next\dev\server\chunks\ssr\node_modules_473cc24e._.js: Invalid source map. Only conformant source maps can be used to find the original code. Cause: Error: sourceMapURL could not be parsed background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] %c%s%c D:\Daniel\Paginas\Clientes\Avicola del Sur\.next\dev\server\chunks\ssr\[root-of-the-server]__875dbca5._.js: Invalid source map. Only conformant source maps can be used to find the original code. Cause: Error: sourceMapURL could not be parsed background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/0a4c830c-ca8f-42ec-819d-3f79a3e460d0
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002
- **Test Name:** User Authentication with Invalid Credentials
- **Test Code:** [TC002_User_Authentication_with_Invalid_Credentials.py](./TC002_User_Authentication_with_Invalid_Credentials.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/c72fafea-f4c9-4de4-8e1a-5f82a68fcd26
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003
- **Test Name:** Role-Based Access Control Enforcement
- **Test Code:** [TC003_Role_Based_Access_Control_Enforcement.py](./TC003_Role_Based_Access_Control_Enforcement.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/f31bf1e8-2b75-4f1b-9e61-5272ea7b5373
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004
- **Test Name:** WhatsApp Bot Order Placement with Stock Validation
- **Test Code:** [TC004_WhatsApp_Bot_Order_Placement_with_Stock_Validation.py](./TC004_WhatsApp_Bot_Order_Placement_with_Stock_Validation.py)
- **Test Error:** Testing stopped because the WhatsApp chatbot interface is not accessible from the dashboard or IA menu. The IA menu leads to AI predictions and alerts, not the chatbot. Unable to proceed with testing the WhatsApp chatbot functionality as required.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/1e7ec278-4fe2-4464-aaea-6ffe16d631eb
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005
- **Test Name:** WhatsApp Bot Order Placement with Insufficient Stock
- **Test Code:** [TC005_WhatsApp_Bot_Order_Placement_with_Insufficient_Stock.py](./TC005_WhatsApp_Bot_Order_Placement_with_Insufficient_Stock.py)
- **Test Error:** The WhatsApp bot stock detection test could not be fully completed. Login and navigation to relevant sections were successful, and product stock was set to simulate limited stock. However, when attempting to create a new order to simulate sending an order via the WhatsApp bot exceeding stock, the 'Nuevo Pedido' button triggered a keyboard shortcuts help modal instead of the new order creation page. This UI issue blocked the critical step to test if the bot correctly detects insufficient stock and sends the appropriate out-of-stock notification. The task is incomplete due to this blocker.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] [useRealtime] ⚠️ Canal cerrado para pedidos (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] [useRealtime] ❌ Error al suscribirse a pedidos: undefined (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] [useRealtime] ❌ Error al suscribirse a pedidos: undefined (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/ce1c8643-2496-4b62-a731-66a45147a06b
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006
- **Test Name:** Order Conversion from Budget to Confirmed Order
- **Test Code:** [TC006_Order_Conversion_from_Budget_to_Confirmed_Order.py](./TC006_Order_Conversion_from_Budget_to_Confirmed_Order.py)
- **Test Error:** The sales budget was successfully created with client AGUSTIN OLEA (MONTEROS), sale type 'Reparto (entrega a domicilio)', delivery zone 'Monteros', price list 'MAYORISTA - Lista Mayorista (20% margen)', and product 'ALAS KG.' with quantity 1 and unit price 19200. The next steps to trigger conversion to confirmed order, verify atomic conversion, inventory reservation with FIFO logic, and order assignment of delivery date and shift are ready but not executed in this session. Task is marked as partially complete as per user instructions.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] Select is changing from uncontrolled to controlled. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component. (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/87837809-d510-4918-8bdb-03d49cd5693d
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007
- **Test Name:** Inventory Management FIFO Lot Validation
- **Test Code:** [TC007_Inventory_Management_FIFO_Lot_Validation.py](./TC007_Inventory_Management_FIFO_Lot_Validation.py)
- **Test Error:** Reported issue with lot creation blocking FIFO inventory test. Stopping further actions.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] Failed to load resource: net::ERR_TIMED_OUT (at https://tvijhnglmryjmrstfvbv.supabase.co/rest/v1/usuarios?select=*&id=eq.458cfb59-c420-4249-8d39-180e2b0115f0:0:0)
[ERROR] [AUTH LOG 2026-01-03T18:43:23.289Z] Error fetching user data: {userId: 458cfb59-c420-4249-8d39-180e2b0115f0, error: TypeError: Failed to fetch, code: N/A, details: TypeError: Failed to fetch
    at http://localhost…000/_next/static/chunks/src_14004e08._.js:850:49), hint: N/A} (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[WARNING] [AUTH LOG 2026-01-03T18:42:43.277Z] Usuario desactivado o no encontrado en verificación periódica: {userId: 458cfb59-c420-4249-8d39-180e2b0115f0, encontrado: false, activo: false, reason: Usuario desactivado en BD o no encontrado} (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/170b6935-d543-4fbe-9c99-acaf30bdc988
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008
- **Test Name:** Anomalous Weight Detection in Production and Desposte
- **Test Code:** [TC008_Anomalous_Weight_Detection_in_Production_and_Desposte.py](./TC008_Anomalous_Weight_Detection_in_Production_and_Desposte.py)
- **Test Error:** Testing stopped due to 404 error on production order detail page. Unable to access detailed weighing interface to perform production and desposte weighing anomaly detection tests. Please fix the broken link or page to continue testing.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/almacen/produccion/bf5825b3-0cab-4c37-8bac-d792745e0e78?_rsc=13jxp:0:0)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/almacen/produccion/bf5825b3-0cab-4c37-8bac-d792745e0e78:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/edeeb44f-f508-40c4-8f79-71658491967d
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009
- **Test Name:** Route Generation and Optimization with Google Directions API
- **Test Code:** [TC009_Route_Generation_and_Optimization_with_Google_Directions_API.py](./TC009_Route_Generation_and_Optimization_with_Google_Directions_API.py)
- **Test Error:** The system allows selection of vehicle, repartidor, date, and turno for route creation. However, no available delivery orders appeared after these selections, preventing creation of a delivery route to test automatic route generation and optimization. Therefore, the task to verify that the system generates optimized delivery routes automatically using Google Directions API, respecting vehicle capacity and visit order, could not be fully completed due to missing or unavailable delivery orders matching the selected parameters. Further data setup or UI adjustments may be needed to fully test this functionality.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/85c00bc2-e0c3-4edd-bd05-c05555b21362
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010
- **Test Name:** Route Optimization Fallback Handling
- **Test Code:** [TC010_Route_Optimization_Fallback_Handling.py](./TC010_Route_Optimization_Fallback_Handling.py)
- **Test Error:** The task to verify the system gracefully falls back to local optimization if Google Directions API returns an error or timeout is not fully completed. We have logged in, navigated to the route creation page, and partially filled the form by selecting a vehicle. However, the Turno and Zona fields remain unselected, so the route creation and optimization process was not triggered. Therefore, the simulation of the Google Directions API failure and verification of the local fallback optimization could not be performed. Task incomplete.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/74b1af4f-a091-47c1-9df5-46502bf61b29
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011
- **Test Name:** Delivery PWA - Route Navigation with Voice Guidance
- **Test Code:** [TC011_Delivery_PWA___Route_Navigation_with_Voice_Guidance.py](./TC011_Delivery_PWA___Route_Navigation_with_Voice_Guidance.py)
- **Test Error:** The delivery personnel can log in and see assigned routes with multiple stops. However, after clicking 'Iniciar Navegación', there is no indication that step-by-step voice navigation in Spanish or GPS tracking updates every 5 seconds have started. No voice instructions or GPS updates are observable on the UI, preventing full verification of the task requirements. Please investigate the issue with voice navigation and GPS tracking activation on the PWA.
Browser Console Logs:
[WARNING] As of February 21st, 2024, google.maps.Marker is deprecated. Please use google.maps.marker.AdvancedMarkerElement instead. At this time, google.maps.Marker is not scheduled to be discontinued, but google.maps.marker.AdvancedMarkerElement is recommended over google.maps.Marker. While google.maps.Marker will continue to receive bug fixes for any major regressions, existing bugs in google.maps.Marker will not be addressed. At least 12 months notice will be given before support is discontinued. Please see https://developers.google.com/maps/deprecations for additional details and https://developers.google.com/maps/documentation/javascript/advanced-markers/migration for the migration guide. (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] %c[useLocationTracker] ❌ getCurrentPosition error: color: red User denied Geolocation (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] [useLocationTracker] Error: Permisos de ubicación denegados. Habilítalos en la configuración. (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] %c[useLocationTracker] ❌ getCurrentPosition error: color: red User denied Geolocation (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] [useLocationTracker] Error: Permisos de ubicación denegados. Habilítalos en la configuración. (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] [useLocationTracker] Error: Permisos de ubicación denegados. Habilítalos en la configuración. (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] [useLocationTracker] Error: Permisos de ubicación denegados. Habilítalos en la configuración. (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/10954eed-db80-43c0-bb18-b0acc887ef0c
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012
- **Test Name:** Delivery PWA - Delivery Registration with Digital Signature and Payment Status
- **Test Code:** [TC012_Delivery_PWA___Delivery_Registration_with_Digital_Signature_and_Payment_Status.py](./TC012_Delivery_PWA___Delivery_Registration_with_Digital_Signature_and_Payment_Status.py)
- **Test Error:** Testing stopped due to navigation issue. The 'Entregas' button on the repartidor dashboard does not work, preventing access to delivery list and further testing of delivery completion features.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/50a96960-8a33-4bcd-aca5-aa7012045d5c
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013
- **Test Name:** Treasury Module - Validation of Payments and Moras Calculation
- **Test Code:** [TC013_Treasury_Module___Validation_of_Payments_and_Moras_Calculation.py](./TC013_Treasury_Module___Validation_of_Payments_and_Moras_Calculation.py)
- **Test Error:** Reported issue with opening budget details for payment input. Stopping further testing as the treasury module payment input cannot be accessed. Please fix the navigation issue to proceed with testing.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/aa5ef248-3d9d-4522-bd22-8e12bc1d0fc1
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014
- **Test Name:** Multi-Sucursal Inventory and Transfer Management
- **Test Code:** [TC014_Multi_Sucursal_Inventory_and_Transfer_Management.py](./TC014_Multi_Sucursal_Inventory_and_Transfer_Management.py)
- **Test Error:** The task to verify inventory segregation, stock transfers, and low stock alerts could not be completed because the login process failed. The issue has been reported. No further actions are possible without successful login.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] Failed to load resource: net::ERR_INCOMPLETE_CHUNKED_ENCODING (at http://localhost:3000/dashboard:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/51b17c35-6368-4dbc-8b8a-15109f35a7ef
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015
- **Test Name:** Real-time GPS Monitoring and Alerts
- **Test Code:** [TC015_Real_time_GPS_Monitoring_and_Alerts.py](./TC015_Real_time_GPS_Monitoring_and_Alerts.py)
- **Test Error:** Login failed with valid credentials, blocking access to GPS monitor. Cannot proceed with testing GPS monitor updates or alert notifications. Reporting issue and stopping.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/f1e9ddc8-60f6-4cbb-be16-f4916da18546
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC016
- **Test Name:** Server Actions with Atomic Transactions
- **Test Code:** [TC016_Server_Actions_with_Atomic_Transactions.py](./TC016_Server_Actions_with_Atomic_Transactions.py)
- **Test Error:** Testing stopped due to failure in triggering order creation from budget. The 'Convertir a Pedido' action does not work as expected, preventing further verification of atomic transactions and data consistency in critical workflows. Issue reported for resolution.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] ImmutableStateInvariantMiddleware took 52ms, which is more than the warning threshold of 32ms. 
If your state or actions are very large, you may want to disable the middleware as it might cause too much of a slowdown in development mode. See https://redux-toolkit.js.org/api/getDefaultMiddleware for instructions.
It is disabled in production builds, so you don't need to worry about that. (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/66312b74-f37e-425d-ac22-1bcc553cc441
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017
- **Test Name:** AI Services Latency and Accuracy for Anomaly Detection and Classification
- **Test Code:** [TC017_AI_Services_Latency_and_Accuracy_for_Anomaly_Detection_and_Classification.py](./TC017_AI_Services_Latency_and_Accuracy_for_Anomaly_Detection_and_Classification.py)
- **Test Error:** Testing stopped due to critical Gemini API error preventing AI report generation for expense classification. Weight data anomaly detection tests completed successfully with results extracted and verified. Classification tests could not be completed due to backend model unavailability.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] Failed to load resource: the server responded with a status of 500 (Internal Server Error) (at http://localhost:3000/api/reportes/ia/generate:0:0)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/761e3b57-8ddb-41c7-bfa0-ac50f73a2829
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC018
- **Test Name:** Report Generation and Export Accuracy
- **Test Code:** [TC018_Report_Generation_and_Export_Accuracy.py](./TC018_Report_Generation_and_Export_Accuracy.py)
- **Test Error:** The PDF export functionality on the 'Reporte de Stock y Mermas' page is not working as expected. Clicking the PDF export button does not trigger any download or feedback. CSV export works fine. This issue prevents full verification of the inventory movements report exports. Stopping further testing until this issue is resolved.
Browser Console Logs:
[ERROR] Failed to load resource: net::ERR_EMPTY_RESPONSE (at http://localhost:3000/dashboard?_rsc=1n1rs:0:0)
[ERROR] Failed to fetch RSC payload for http://localhost:3000/dashboard. Falling back to browser navigation. TypeError: Failed to fetch
    at createFetch (http://localhost:3000/_next/static/chunks/node_modules_next_dist_client_aaee43fe._.js:2552:24)
    at fetchServerResponse (http://localhost:3000/_next/static/chunks/node_modules_next_dist_client_aaee43fe._.js:2456:27)
    at refreshReducer (http://localhost:3000/_next/static/chunks/node_modules_next_dist_client_aaee43fe._.js:11746:67)
    at clientReducer (http://localhost:3000/_next/static/chunks/node_modules_next_dist_client_aaee43fe._.js:12258:59)
    at Object.action (http://localhost:3000/_next/static/chunks/node_modules_next_dist_client_aaee43fe._.js:12492:55)
    at runAction (http://localhost:3000/_next/static/chunks/node_modules_next_dist_client_aaee43fe._.js:12397:38)
    at runRemainingActions (http://localhost:3000/_next/static/chunks/node_modules_next_dist_client_aaee43fe._.js:12374:13)
    at handleResult (http://localhost:3000/_next/static/chunks/node_modules_next_dist_client_aaee43fe._.js:12413:9) (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error: Route "/reportes/stock" used `searchParams.fechaHasta`. `searchParams` is a Promise and must be unwrapped with `await` or `React.use()` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
    at ReporteStockPage (about://React/Server/D:%5CDaniel%5CPaginas%5CClientes%5CAvicola%20del%20Sur%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__67bbaa5d._.js?369:93:37)
    at resolveErrorDev (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1864:106)
    at getOutlinedModel (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1414:28)
    at parseModelString (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1528:50)
    at Object.<anonymous> (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2457:51)
    at JSON.parse (<anonymous>)
    at initializeModelChunk (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1047:30)
    at getOutlinedModel (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1352:17)
    at parseModelString (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1582:50)
    at Array.<anonymous> (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2457:51)
    at JSON.parse (<anonymous>)
    at initializeModelChunk (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1047:30)
    at resolveConsoleEntry (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:1990:96)
    at processFullStringRow (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2391:17)
    at processFullBinaryRow (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2331:9)
    at processBinaryChunk (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2441:98)
    at progress (http://localhost:3000/_next/static/chunks/node_modules_next_dist_compiled_react-server-dom-turbopack_9212ccad._.js:2610:13) (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] %c%s%c D:\Daniel\Paginas\Clientes\Avicola del Sur\.next\dev\server\chunks\ssr\node_modules_473cc24e._.js: Invalid source map. Only conformant source maps can be used to find the original code. Cause: Error: sourceMapURL could not be parsed background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] %c%s%c D:\Daniel\Paginas\Clientes\Avicola del Sur\.next\dev\server\chunks\ssr\[root-of-the-server]__67bbaa5d._.js: Invalid source map. Only conformant source maps can be used to find the original code. Cause: Error: sourceMapURL could not be parsed background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] Failed to load resource: the server responded with a status of 400 (Bad Request) (at http://localhost:3000/api/reportes/export:0:0)
[ERROR] Error al exportar: Error: Error al exportar
    at handleExport (http://localhost:3000/_next/static/chunks/src_dff8d1f4._.js:2700:33)
    at async handleExport (http://localhost:3000/_next/static/chunks/src_dff8d1f4._.js:1599:13) (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] Failed to load resource: the server responded with a status of 400 (Bad Request) (at http://localhost:3000/api/reportes/export:0:0)
[ERROR] Error al exportar: Error: Error al exportar
    at handleExport (http://localhost:3000/_next/static/chunks/src_dff8d1f4._.js:2700:33)
    at async handleExport (http://localhost:3000/_next/static/chunks/src_dff8d1f4._.js:1599:13) (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/be6f7e88-90f9-4a8a-8e26-72308b7d5b46
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019
- **Test Name:** Notification System Filtering and Push Notifications
- **Test Code:** [TC019_Notification_System_Filtering_and_Push_Notifications.py](./TC019_Notification_System_Filtering_and_Push_Notifications.py)
- **Test Error:** Testing stopped due to non-functional notification toggle button for 'Stock' category. The toggle does not change state when clicked, blocking further verification of notification filtering and push notifications. Issue reported for developer investigation.
Browser Console Logs:
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) (at http://localhost:3000/generate-notifications:0:0)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[WARNING] %c%s%c [DEV WARN] background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   Error al obtener métricas de rutas (puede ser que la función no exista aún): relation "rutas_metricas_semana" does not exist (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:2287:27)
[ERROR] Failed to load resource: the server responded with a status of 404 () (at https://tvijhnglmryjmrstfvbv.supabase.co/rest/v1/configuracion_notificaciones?select=*&usuario_id=eq.458cfb59-c420-4249-8d39-180e2b0115f0:0:0)
[ERROR] Error cargando configuración: {code: PGRST205, details: null, hint: Perhaps you meant the table 'public.notificaciones', message: Could not find the table 'public.configuracion_notificaciones' in the schema cache} (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
[ERROR] Failed to load resource: the server responded with a status of 404 () (at https://tvijhnglmryjmrstfvbv.supabase.co/rest/v1/configuracion_notificaciones?select=*&usuario_id=eq.458cfb59-c420-4249-8d39-180e2b0115f0:0:0)
[ERROR] Error cargando configuración: {code: PGRST205, details: null, hint: Perhaps you meant the table 'public.notificaciones', message: Could not find the table 'public.configuracion_notificaciones' in the schema cache} (at http://localhost:3000/_next/static/chunks/node_modules_next_dist_7a8122d0._.js:3117:31)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/59c31ff7-1b8e-47d4-a5e2-26ddf85eacb7
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020
- **Test Name:** Responsive UI on Desktop and PWA for Delivery Personnel
- **Test Code:** [TC020_Responsive_UI_on_Desktop_and_PWA_for_Delivery_Personnel.py](./TC020_Responsive_UI_on_Desktop_and_PWA_for_Delivery_Personnel.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/c9889468-7f48-4dce-a34d-46677bd98b9a/d4a26511-2336-4263-ad10-442269c5155b
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **15.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---