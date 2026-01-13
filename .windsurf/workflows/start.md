---
description: Inicializa el contexto del agente para trabajar en Avícola del Sur
---
# 🚀 Workflow: Start Session (/start)

Este flujo inicializa el contexto de Cascade para trabajar en el ERP de Avícola del Sur.

## Pasos

1. **Leer Contexto Esencial**:
   - `GEMINI.md` (contexto automático con stack y lecciones recientes)
   - `.framework/LAWS.md` (reglas inamovibles del proyecto)
   - `.context/MEMORY.md` (historial de decisiones críticas)

2. **Cargar Arquitectura**:
   - `ARCHITECTURE_SUMMARY.md` (vista general del sistema)
   - `README.md` (guía operativa y setup)

3. **Verificar Entorno Crítico**:
   - ✅ Variables Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - ✅ Variables Vertex AI: `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_CREDENTIALS_BASE64`
   - ✅ Variables WhatsApp: `TWILIO_*` o Meta credentials
   - ✅ MCP Supabase activo (verificar `mcp0_list_projects`)

4. **Identificar Área de Trabajo**:
   - ¿En qué módulo voy a trabajar? (Ventas/Reparto/Almacén/Tesorería/RRHH/Sucursales/Bot)
   - ¿Qué módulos NO tocar? (evitar cambios no solicitados)

5. **Confirmar Inicio**:
   - Presentar resumen de contexto cargado
   - Listar módulos principales y estado del stack
   - Preguntar: "¿En qué puedo ayudarte hoy?"

// turbo
## Verificación de Estructura
```powershell
# Verificar archivos de contexto
Get-ChildItem .framework, .context, GEMINI.md, ARCHITECTURE_SUMMARY.md

# Verificar módulos principales
Get-ChildItem src/actions -Directory | Select-Object Name
```
