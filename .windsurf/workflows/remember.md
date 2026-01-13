---
description: Guarda una lección o decisión importante en la memoria sin cerrar sesión
---
# 🧠 Workflow: Remember (/remember)

Guarda aprendizajes en `.context/MEMORY.md` siguiendo `.framework/LAWS.md` §6.

## Uso
El usuario dice: `/remember "La tabla gastos fue recreada por hotfix"`

## Pasos

1. **Recibir Input**: Identificar el aprendizaje que el usuario quiere persistir.

2. **Clasificar Criticidad**:
   - **Alta**: Cambio de arquitectura, hotfix, bug recurrente, decisión de diseño crítica
   - **Media**: Solución a problema específico, patrón útil
   - **Baja**: Nota operativa, recordatorio temporal

3. **Actualizar Memoria**:
   - **Siempre**: Agregar a `.context/MEMORY.md` bajo la fecha actual
   - **Formato de entrada**:
     ```markdown
     ### Sesión: [Título Descriptivo]
     - **Fecha**: YYYY-MM-DD
     - **[Problema/Decisión/Log]**: [Descripción]
     - **[Solución/Resultado/Estado]**: [Detalles]
     - **Aprendizaje**: [Lección clave]
     ```

4. **Si es Criticidad Alta**:
   - Agregar también a `GEMINI.md` tabla "Lecciones Recientes" (máximo 10, FIFO)
   - Considerar actualizar `.framework/LAWS.md` si afecta reglas del framework

5. **Confirmar**:
   - Avisar al usuario: "✅ Guardado en `.context/MEMORY.md`"
   - Si también fue a `GEMINI.md`: "⚠️ Lección crítica agregada a `GEMINI.md` también"

## Ejemplo de Entrada Bien Formada

```markdown
### Sesión: Fix Vertex AI Auth en Vercel
- **Fecha**: 2026-01-13
- **Problema**: Vertex AI fallaba en Vercel con "ADC not found"
- **Solución**: Decodificar `GOOGLE_CLOUD_CREDENTIALS_BASE64` a archivo temporal y setear `GOOGLE_APPLICATION_CREDENTIALS`
- **Aprendizaje**: Vercel no soporta ADC nativo; usar credenciales base64 + helper `ensureGoogleApplicationCredentials()`
```
