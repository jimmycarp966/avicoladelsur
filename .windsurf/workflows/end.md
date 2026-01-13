---
description: Cierra la sesión, guarda aprendizajes y actualiza documentación
---
# 🏁 Workflow: End Session (/end)

Cierre estructurado de sesión, asegurando persistencia de conocimiento.

## Pasos

1. **Extraer Aprendizajes de la Sesión**:
   - ¿Qué decisiones críticas se tomaron?
   - ¿Qué patrones o soluciones se descubrieron?
   - ¿Qué bugs/issues se resolvieron?
   - ¿Qué NO funcionó? (para evitar repetir)

2. **Actualizar Memoria**:
   - Registrar aprendizajes en `.context/MEMORY.md` con formato estructurado
   - Si es crítico: agregar también a `GEMINI.md` tabla "Lecciones Recientes"

3. **Actualizar Documentación**:
   - Ejecutar `/actualizar` si hubo cambios estructurales
   - Verificar que `ARCHITECTURE_SUMMARY.md` §15 "Cambios Recientes" esté actualizado

4. **Checklist de Cierre** (verificación de estado):
   ```
   □ Procesos activos (dev server, watchers, scripts):
     - Si `npm run dev` está corriendo: informar al usuario
     - Si hay scripts en background: listar y preguntar si detener
   
   □ Archivos temporales:
     - Verificar `/tmp/gcp-service-account.json` (credenciales Vertex AI)
     - Verificar logs de debug en consola
   
   □ Código:
     - ¿Hay `console.log('[DEBUG]')` que deben limpiarse?
     - ¿Hay TODOs o FIXMEs nuevos que documentar?
   
   □ Git:
     - ¿Hay cambios sin commit que el usuario quiera guardar?
     - Listar archivos modificados (staged/unstaged)
   ```

5. **Pendientes (max 3 bullets)**:
   - Listar tareas NO completadas de la sesión
   - Sugerir próximos pasos lógicos
   - Formato: "⏭️ Pendiente: [acción concreta]"

6. **Resumen Final**:
   ```markdown
   ## 📊 Resumen de Sesión
   
   **Módulos trabajados**: [lista]
   **Archivos modificados**: [número] archivos
   **Aprendizajes clave**: [1-2 bullets]
   **Estado del sistema**: ✅ Funcional / ⚠️ En desarrollo / 🔧 Con issues
   
   **Próximos pasos**:
   1. [Acción 1]
   2. [Acción 2]
   3. [Acción 3 - opcional]
   ```

## Comando de Cierre

```powershell
// turbo
# Ver archivos modificados en la sesión
git status --short

# Ver procesos Node/npm activos
Get-Process node, npm -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime
```
