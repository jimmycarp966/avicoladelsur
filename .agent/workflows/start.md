---
description: Inicializa el contexto del agente para trabajar en Avícola del Sur
---
# 🚀 Workflow: Start Session (/start)

Este flujo inicializa el contexto de la IA para trabajar en Avícola del Sur.

## Pasos

1. **Leer Leyes**: Leer `.framework/LAWS.md` para entender las restricciones.
2. **Cargar Memoria**: Leer `.context/MEMORY.md` para recordar decisiones pasadas.
3. **Analizar Estado**: Leer `ARCHITECTURE_SUMMARY.md` para entender el estado actual del sistema.
4. **Verificar MCP**: Comprobar que los servidores MCP necesarios (Supabase, Sheets, etc.) estén activos.
5. **Saludar**: Presentarse como Antigravity e informar que el contexto ha sido cargado exitosamente.

// turbo-all
## Comandos de Inicialización
```powershell
# Verificar estructura
ls .framework, .context, .agent
```
