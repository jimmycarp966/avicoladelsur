# 🔄 Workflow: Actualizar Documentación (/actualizar)

Este flujo sincroniza los cambios realizados en el código con los documentos maestros.

## Pasos

1. **Analizar Cambios**: Revisar los commits y ediciones recientes en el código.
2. **Actualizar Resumen**: Modificar `ARCHITECTURE_SUMMARY.md`:
   - Agregar entrada en "Cambios Recientes" (máximo 5, FIFO - el más viejo se elimina).
   - Actualizar secciones de módulos si hay cambios estructurales.
3. **Actualizar README**: Asegurar que el `README.md` refleje las capacidades actuales del sistema.
4. **Verificar Consistencia**: Asegurar que las leyes en `.framework/LAWS.md` sigan siendo válidas o actualizarlas si la arquitectura cambió.
5. **Reportar**: Informar al usuario que la documentación ha sido sincronizada.

> **Nota**: Los cambios en ARCHITECTURE_SUMMARY.md son ACUMULATIVOS en la sección "Cambios Recientes". No borrar entradas anteriores, solo agregar nuevas y eliminar las más antiguas si hay más de 5.

// turbo-all
## Ejecución
```powershell
# Este comando puede invocar scripts de auto-generación si existieran
echo "Sincronizando documentación..."
```
