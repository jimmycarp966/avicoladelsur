---
description: Guarda una lección o decisión importante en la memoria sin cerrar sesión
---
# 🧠 Workflow: Remember (/remember)

Este flujo permite guardar rápidamente un aprendizaje sin cerrar la sesión.

## Uso
El usuario dice: `/remember "La tabla gastos fue recreada por hotfix"`

## Pasos

1. **Recibir Input**: Identificar el texto que el usuario quiere recordar.
2. **Actualizar Memoria**: Agregar la entrada a `.context/MEMORY.md` bajo la fecha actual.
3. **Validar Crítico**: Si el aprendizaje es crítico (cambio de arquitectura, hotfix, bug recurrente), sugerir agregarlo también a `GEMINI.md`.
4. **Confirmar**: Avisar al usuario que el dato fue persistido exitosamente (ej: "✅ Guardado en memoria").
