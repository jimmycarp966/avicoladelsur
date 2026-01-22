# Catálogo de Opciones: Objetivación de Evaluaciones

Esta guía presenta diversas opciones para nutrir los 5 criterios de evaluación originales con datos reales del ERP, permitiendo que el evaluador elija la fuente más relevante según el rol del empleado.

---

## ⏰ 1. Puntualidad
*Opciones para medir el cumplimiento de horarios:*

*   **Opción A (Biometría):** Minutos de retraso y cantidad de faltas registradas vía Hikvision (`rrhh_asistencia`).
*   **Opción B (Inicio Operativo):** Diferencia horaria entre el inicio del turno y la **primera transacción** del empleado (primer ticket de venta, primer pesaje o primer reporte de carga).
*   **Opción C (Cierre de Jornada):** Puntualidad en la entrega del Arqueo de Caja o la finalización de la última Hoja de Ruta.

## 📈 2. Rendimiento
*Opciones para medir la productividad según el sector:*

*   **Opción A (Producción):** Comparación de **Kg Producidos vs. Metas** de rendimiento esperado (`rendimientos_esperados`).
*   **Opción B (Ventas):** Cumplimiento de cuotas de facturación y cantidad de tickets emitidos por hora (Cajeros).
*   **Opción C (Logística):** Tiempo promedio de entrega por cliente y % de efectividad en la entrega de pedidos de la ruta asignada.
*   **Opción D (Almacén):** Volumen de bultos movidos en transferencias de stock y precisión en los conteos rotativos.

## 🎯 3. Responsabilidad
*Opciones para medir el compromiso y cuidado de recursos:*

*   **Opción A (Tesorería):** Frecuencia y magnitud de **diferencias de caja** (faltantes) detectadas en los cierres.
*   **Opción B (Mermas):** Control de desperdicio sólido y líquido generado bajo su supervisión en el desposte.
*   **Opción C (Documentación):** Calidad de la carga de datos (ej. pedidos con datos de geolocalización o contactos de clientes completos).
*   **Opción D (Activos):** Registro puntual de mantenimientos preventivos o avisos de fallas en vehículos y maquinaria.

## 🤝 4. Trabajo en Equipo
*Opciones para medir la colaboración interna:*

*   **Opción A (Comunicación):** Tiempo de respuesta (`SLA`) a mensajes internos de coordinación recibidos de otros compañeros.
*   **Opción B (Comunicación Grupal):** Confirmación de lectura y feedback oportuno en el tablero de `Novedades RRHH`.
*   **Opción C (Apoyo Operativo):** Registro de actividad en sucursales o depósitos distintos al habitual (indicando cobertura de ausencias o picos de demanda).

## 😊 5. Actitud
*Opciones para medir la disposición y comportamiento:*

*   **Opción A (Historial Disciplinario):** Relación entre **Menciones Positivas vs. Sanciones** registradas en el historial del empleado.
*   **Opción B (Iniciativa de Mejora):** Cantidad de propuestas de optimización de procesos enviadas voluntariamente al administrador vía mensajería interna.
*   **Opción C (Disponibilidad):** Historial de adaptabilidad ante cambios de turnos solicitados por la empresa por necesidades operativas.

---

### ¿Cómo aplicar esto en el ERP?

El objetivo es que al crear una evaluación, el sistema muestre un panel de **"Soporte de Decisión"** donde el evaluador pueda ver estas métricas antes de asignar el puntaje manual. 

> [!NOTE]
> Estas métricas actúan como una "Ayudantía" objetiva, pero el evaluador sigue teniendo la última palabra para considerar contextos humanos (ej. un retraso justificado por fuerza mayor).
