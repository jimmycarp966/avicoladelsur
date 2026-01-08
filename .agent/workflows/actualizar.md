# 🔄 Workflow: Actualizar Documentación (/actualizar)

Este flujo sincroniza los cambios realizados en el código con los documentos maestros.

## Pasos

1. **Analizar Cambios**: Revisar los commits y ediciones recientes en el código.
2. **Actualizar Resumen**: Modificar `ARCHITECTURE_SUMMARY.md` agregando las nuevas funcionalidades en "Actualizaciones Recientes".
3. **Actualizar README**: Asegurar que el `README.md` refleje las capacidades actuales del sistema.
4. **Verificar Consistencia**: Asegurar que las leyes en `.framework/LAWS.md` sigan siendo válidas o actualizarlas si la arquitectura cambió.
5. **Reportar**: Informar al usuario que la documentación ha sido sincronizada.

// turbo-all
## Ejecución
```powershell
# Este comando puede invocar scripts de auto-generación si existieran
echo "Sincronizando documentación..."
```
