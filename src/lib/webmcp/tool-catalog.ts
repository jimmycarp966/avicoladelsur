import type { UserRole } from "@/lib/config";

export type WebMcpToolKind = "navigation" | "api";
export type WebMcpRisk = "low" | "medium" | "high";
export type WebMcpMethod = "GET" | "POST";
export type WebMcpConfirmationMode = "none" | "soft" | "hard";

export interface WebMcpToolBase {
  id: string;
  title: string;
  description: string;
  kind: WebMcpToolKind;
  roles: UserRole[];
  risk: WebMcpRisk;
  confirmationRequired: boolean;
  confirmationMode?: WebMcpConfirmationMode;
  confirmationCode?: string;
  inputSchema: Record<string, unknown>;
}

export interface WebMcpNavigationTool extends WebMcpToolBase {
  kind: "navigation";
  path: string;
}

export interface WebMcpApiTool extends WebMcpToolBase {
  kind: "api";
  endpoint: string;
  method: WebMcpMethod;
}

export type WebMcpTool = WebMcpNavigationTool | WebMcpApiTool;

const ALL_BACKOFFICE_ROLES: UserRole[] = [
  "admin",
  "vendedor",
  "almacenista",
  "tesorero",
  "encargado_sucursal",
];

export const WEBMCP_TOOLS: WebMcpTool[] = [
  {
    id: "abrir_dashboard",
    title: "Abrir dashboard",
    description: "Navega al dashboard principal del ERP.",
    kind: "navigation",
    roles: ["admin", "vendedor", "almacenista"],
    path: "/dashboard",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_almacen",
    title: "Abrir modulo almacen",
    description: "Navega al modulo de almacen y stock.",
    kind: "navigation",
    roles: ["admin", "vendedor", "almacenista"],
    path: "/almacen",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_ventas",
    title: "Abrir modulo ventas",
    description: "Navega al modulo de ventas y clientes.",
    kind: "navigation",
    roles: ["admin", "vendedor"],
    path: "/ventas",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_reparto",
    title: "Abrir modulo reparto",
    description: "Navega al modulo de rutas, entregas y monitoreo.",
    kind: "navigation",
    roles: ["admin", "vendedor", "almacenista"],
    path: "/reparto",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_tesoreria",
    title: "Abrir modulo tesoreria",
    description: "Navega al modulo de tesoreria y movimientos de caja.",
    kind: "navigation",
    roles: ["admin", "tesorero", "encargado_sucursal"],
    path: "/tesoreria",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_rrhh",
    title: "Abrir modulo rrhh",
    description: "Navega al modulo de recursos humanos.",
    kind: "navigation",
    roles: ["admin"],
    path: "/rrhh",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "listar_empleados_rrhh_activos",
    title: "Listar empleados RRHH",
    description: "Obtiene empleados activos para flujos de asistencia, adelantos y liquidaciones.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rrhh/empleados/activos",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "marcar_asistencia_rrhh",
    title: "Marcar asistencia RRHH",
    description: "Registra asistencia de un empleado para una fecha y turno.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rrhh/asistencia/marcar",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            empleado_id: { type: "string" },
            fecha: { type: "string" },
            hora_entrada: { type: "string" },
            hora_salida: { type: "string" },
            turno: { type: "string" },
            estado: { type: "string" },
            observaciones: { type: "string" },
          },
          required: ["empleado_id", "fecha"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "crear_adelanto_rrhh",
    title: "Crear adelanto RRHH",
    description: "Crea un adelanto de empleado (dinero o producto) aplicando reglas de limite.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rrhh/adelantos/crear",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            empleado_id: { type: "string" },
            tipo: { type: "string" },
            monto: { type: "number" },
            producto_id: { type: "string" },
            cantidad: { type: "number" },
            precio_unitario: { type: "number" },
            fecha_solicitud: { type: "string" },
            observaciones: { type: "string" },
          },
          required: ["empleado_id", "tipo"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "aprobar_adelanto_rrhh",
    title: "Aprobar adelanto RRHH",
    description: "Aprueba un adelanto pendiente.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rrhh/adelantos/:id/aprobar",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "rechazar_adelanto_rrhh",
    title: "Rechazar adelanto RRHH",
    description: "Rechaza un adelanto pendiente.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rrhh/adelantos/:id/rechazar",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "calcular_liquidacion_rrhh",
    title: "Calcular liquidacion RRHH",
    description: "Calcula una liquidacion mensual para un empleado.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rrhh/liquidaciones/calcular",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        confirmationCode: { type: "string" },
        body: {
          type: "object",
          properties: {
            empleado_id: { type: "string" },
            mes: { type: "number" },
            anio: { type: "number" },
          },
          required: ["empleado_id", "mes", "anio"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "aprobar_liquidacion_rrhh",
    title: "Aprobar liquidacion RRHH",
    description: "Aprueba una liquidacion calculada.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rrhh/liquidaciones/:id/aprobar",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        confirmationCode: { type: "string" },
        pathParams: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "pagar_liquidacion_rrhh",
    title: "Pagar liquidacion RRHH",
    description: "Marca una liquidacion aprobada como pagada.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rrhh/liquidaciones/:id/pagar",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        confirmationCode: { type: "string" },
        pathParams: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "abrir_sucursales",
    title: "Abrir modulo sucursales",
    description: "Navega al modulo de sucursales y transferencias.",
    kind: "navigation",
    roles: ["admin", "encargado_sucursal"],
    path: "/sucursales",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_reportes",
    title: "Abrir modulo reportes",
    description: "Navega al modulo de reportes consolidados.",
    kind: "navigation",
    roles: ALL_BACKOFFICE_ROLES,
    path: "/reportes",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_repartidor_home",
    title: "Abrir home repartidor",
    description: "Navega al inicio de la PWA del repartidor.",
    kind: "navigation",
    roles: ["repartidor"],
    path: "/home",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_repartidor_entregas",
    title: "Abrir entregas repartidor",
    description: "Navega a la vista de entregas del repartidor.",
    kind: "navigation",
    roles: ["repartidor"],
    path: "/entregas",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "abrir_sucursal_dashboard",
    title: "Abrir dashboard sucursal",
    description: "Navega al dashboard de la sucursal.",
    kind: "navigation",
    roles: ["admin", "encargado_sucursal"],
    path: "/sucursal/dashboard",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "consultar_productos",
    title: "Consultar productos",
    description: "Obtiene productos activos del catalogo interno.",
    kind: "api",
    roles: [...ALL_BACKOFFICE_ROLES, "repartidor"],
    endpoint: "/api/listar-productos",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "crear_presupuesto",
    title: "Crear presupuesto",
    description: "Crea un presupuesto de venta con cliente, productos y fecha de entrega.",
    kind: "api",
    roles: ["admin", "vendedor"],
    endpoint: "/api/ventas/presupuestos/crear",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            cliente_id: { type: "string" },
            zona_id: { type: "string" },
            fecha_entrega_estimada: { type: "string" },
            observaciones: { type: "string" },
            lista_precio_id: { type: "string" },
            tipo_venta: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  producto_id: { type: "string" },
                  cantidad_solicitada: { type: "number" },
                  precio_unit_est: { type: "number" },
                  lista_precio_id: { type: "string" },
                },
                required: ["producto_id", "cantidad_solicitada", "precio_unit_est"],
              },
            },
          },
          required: ["cliente_id", "items"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "listar_presupuestos",
    title: "Listar presupuestos",
    description: "Lista presupuestos de ventas con filtros por estado, zona y fechas.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista", "tesorero"],
    endpoint: "/api/ventas/presupuestos/listar",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          properties: {
            estado: { type: "string" },
            zona_id: { type: "string" },
            fecha_desde: { type: "string" },
            fecha_hasta: { type: "string" },
          },
        },
      },
    },
  },
  {
    id: "obtener_presupuesto",
    title: "Obtener presupuesto",
    description: "Obtiene detalle completo de un presupuesto por ID.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista", "tesorero"],
    endpoint: "/api/ventas/presupuestos/:id",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: {
      type: "object",
      properties: {
        pathParams: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "listar_presupuestos_dia",
    title: "Listar presupuestos del dia",
    description: "Lista presupuestos en almacen para una fecha, con filtros operativos.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista"],
    endpoint: "/api/almacen/presupuestos-dia/listar",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          properties: {
            fecha: { type: "string" },
            zona_id: { type: "string" },
            turno: { type: "string" },
            buscar: { type: "string" },
            page: { type: "number" },
            pageSize: { type: "number" },
          },
        },
      },
    },
  },
  {
    id: "buscar_productos_por_codigo",
    title: "Buscar productos por codigo",
    description: "Busca productos por una lista de codigos.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista", "encargado_sucursal"],
    endpoint: "/api/productos/buscar",
    method: "POST",
    risk: "low",
    confirmationRequired: false,
    inputSchema: {
      type: "object",
      properties: {
        body: {
          type: "object",
          properties: {
            codigos: { type: "array", items: { type: "string" } },
          },
          required: ["codigos"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "consultar_rutas_activas",
    title: "Consultar rutas activas",
    description: "Obtiene rutas planificadas o en curso por fecha y zona.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista", "repartidor"],
    endpoint: "/api/reparto/rutas-activas",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          properties: {
            fecha: { type: "string" },
            zona_id: { type: "string" },
          },
        },
      },
    },
  },
  {
    id: "consultar_movimientos_caja",
    title: "Consultar movimientos de caja",
    description: "Consulta movimientos de caja por caja y fecha.",
    kind: "api",
    roles: ["admin", "tesorero", "encargado_sucursal"],
    endpoint: "/api/tesoreria/movimientos",
    method: "GET",
    risk: "medium",
    confirmationRequired: false,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          properties: {
            cajaId: { type: "string" },
            fecha: { type: "string" },
          },
        },
      },
    },
  },
  {
    id: "registrar_movimiento_caja",
    title: "Registrar movimiento de caja",
    description: "Registra un movimiento de caja (ingreso o egreso).",
    kind: "api",
    roles: ["admin", "tesorero", "encargado_sucursal"],
    endpoint: "/api/tesoreria/movimientos",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: { type: "object" },
      },
      required: ["body"],
    },
  },
  {
    id: "consultar_alertas_sucursal",
    title: "Consultar alertas de sucursal",
    description: "Obtiene alertas de stock de una sucursal.",
    kind: "api",
    roles: ["admin", "encargado_sucursal"],
    endpoint: "/api/sucursales/:sucursalId/alerts",
    method: "GET",
    risk: "medium",
    confirmationRequired: false,
    inputSchema: {
      type: "object",
      properties: {
        pathParams: {
          type: "object",
          properties: {
            sucursalId: { type: "string" },
          },
          required: ["sucursalId"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "crear_alerta_sucursal",
    title: "Crear alerta de sucursal",
    description: "Crea una alerta manual de stock en sucursal.",
    kind: "api",
    roles: ["admin", "encargado_sucursal"],
    endpoint: "/api/sucursales/:sucursalId/alerts",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            sucursalId: { type: "string" },
          },
          required: ["sucursalId"],
        },
        body: {
          type: "object",
          properties: {
            productoId: { type: "string" },
            cantidadActual: { type: "number" },
            umbral: { type: "number" },
          },
          required: ["productoId", "cantidadActual", "umbral"],
        },
      },
      required: ["pathParams", "body"],
    },
  },
  {
    id: "consultar_transferencias_sucursal",
    title: "Consultar solicitudes de transferencia",
    description: "Obtiene solicitudes de transferencia vigentes de una sucursal.",
    kind: "api",
    roles: ["admin", "encargado_sucursal"],
    endpoint: "/api/sucursales/:sucursalId/transfer-request",
    method: "GET",
    risk: "medium",
    confirmationRequired: false,
    inputSchema: {
      type: "object",
      properties: {
        pathParams: {
          type: "object",
          properties: {
            sucursalId: { type: "string" },
          },
          required: ["sucursalId"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "solicitar_transferencia_sucursal",
    title: "Solicitar transferencia sucursal",
    description: "Solicita una transferencia de stock desde sucursal.",
    kind: "api",
    roles: ["admin", "encargado_sucursal"],
    endpoint: "/api/sucursales/:sucursalId/transfer-request",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            sucursalId: { type: "string" },
          },
          required: ["sucursalId"],
        },
        body: {
          type: "object",
          properties: {
            productoId: { type: "string" },
            cantidadSolicitada: { type: "number" },
            motivo: { type: "string" },
          },
          required: ["productoId", "cantidadSolicitada"],
        },
      },
      required: ["pathParams", "body"],
    },
  },
  {
    id: "listar_transferencias_stock",
    title: "Listar transferencias de stock",
    description: "Lista transferencias entre sucursales con filtros por sucursal y estado.",
    kind: "api",
    roles: ["admin", "almacenista", "encargado_sucursal"],
    endpoint: "/api/sucursales/transferencias/listar",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          properties: {
            sucursal_id: { type: "string" },
            estado: { type: "string" },
          },
        },
      },
    },
  },
  {
    id: "obtener_transferencia_stock",
    title: "Obtener transferencia de stock",
    description: "Obtiene el detalle completo de una transferencia por ID.",
    kind: "api",
    roles: ["admin", "almacenista", "encargado_sucursal"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: {
      type: "object",
      properties: {
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "crear_transferencia_stock",
    title: "Crear transferencia de stock",
    description: "Crea una transferencia desde sucursal origen hacia sucursal destino.",
    kind: "api",
    roles: ["admin", "almacenista", "encargado_sucursal"],
    endpoint: "/api/sucursales/transferencias/crear",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            sucursal_origen_id: { type: "string" },
            sucursal_destino_id: { type: "string" },
            motivo: { type: "string" },
            observaciones: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  producto_id: { type: "string" },
                  cantidad: { type: "number" },
                },
                required: ["producto_id", "cantidad"],
              },
            },
          },
          required: ["sucursal_origen_id", "sucursal_destino_id", "items"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "aprobar_transferencia_stock",
    title: "Aprobar transferencia",
    description: "Aprueba una transferencia pendiente y la envía a tránsito.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId/aprobar",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "preparar_transferencia_stock",
    title: "Preparar transferencia",
    description: "Marca la transferencia como preparada en almacén.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId/preparar",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
        body: {
          type: "object",
          properties: {
            items_pesados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_id: { type: "string" },
                  peso_preparado: { type: "number" },
                },
              },
            },
          },
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "asignar_transferencia_ruta",
    title: "Asignar transferencia a ruta",
    description: "Asigna una transferencia preparada a la ruta de reparto correspondiente.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId/asignar-ruta",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "marcar_transferencia_entregada",
    title: "Marcar transferencia entregada",
    description: "Marca una transferencia en ruta como entregada en destino.",
    kind: "api",
    roles: ["admin", "almacenista", "repartidor"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId/entregar",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "confirmar_recepcion_transferencia",
    title: "Confirmar recepcion de transferencia",
    description: "Confirma la recepción final de la transferencia en sucursal destino.",
    kind: "api",
    roles: ["admin", "encargado_sucursal", "almacenista"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId/confirmar-recepcion",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        confirmationCode: { type: "string" },
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
        body: {
          type: "object",
          properties: {
            items_recibidos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_id: { type: "string" },
                  cantidad_recibida: { type: "number" },
                },
              },
            },
          },
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "cancelar_transferencia_stock",
    title: "Cancelar transferencia de stock",
    description: "Cancela una transferencia y devuelve el stock reservado.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId/cancelar",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        confirmationCode: { type: "string" },
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
        body: {
          type: "object",
          properties: {
            motivo: { type: "string" },
          },
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "listar_transferencias_pendientes_recepcion",
    title: "Listar pendientes de recepcion",
    description: "Lista transferencias pendientes de recepción para una sucursal.",
    kind: "api",
    roles: ["admin", "encargado_sucursal", "almacenista"],
    endpoint: "/api/sucursales/transferencias/pendientes-recepcion",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          properties: {
            sucursal_id: { type: "string" },
          },
          required: ["sucursal_id"],
        },
      },
      required: ["query"],
    },
  },
  {
    id: "listar_solicitudes_automaticas_transferencia",
    title: "Listar solicitudes automaticas",
    description: "Obtiene solicitudes automáticas generadas por stock bajo.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/sucursales/transferencias/solicitudes-automaticas",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "aprobar_solicitud_automatica_transferencia",
    title: "Aprobar solicitud automatica",
    description: "Aprueba una solicitud automática y la pasa al flujo de almacén.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId/aprobar-solicitud",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
        body: {
          type: "object",
          properties: {
            items_modificados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_id: { type: "string" },
                  cantidad: { type: "number" },
                },
              },
            },
          },
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "rechazar_solicitud_automatica_transferencia",
    title: "Rechazar solicitud automatica",
    description: "Rechaza una solicitud automática de transferencia.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/sucursales/transferencias/:transferenciaId/rechazar-solicitud",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            transferenciaId: { type: "string" },
          },
          required: ["transferenciaId"],
        },
        body: {
          type: "object",
          properties: {
            motivo: { type: "string" },
          },
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "ejecutar_stock_bajo_sucursales",
    title: "Ejecutar evaluacion stock bajo",
    description: "Ejecuta la evaluación de stock bajo para todas las sucursales.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/sucursales/low-stock-run",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            sucursal_id: { type: "string" },
            producto_id: { type: "string" },
          },
        },
      },
    },
  },
  {
    id: "analizar_clientes_riesgo",
    title: "Analizar clientes en riesgo",
    description: "Detecta clientes en riesgo de abandono por historial de compra.",
    kind: "api",
    roles: ["admin", "vendedor"],
    endpoint: "/api/predictions/customer-risk",
    method: "GET",
    risk: "medium",
    confirmationRequired: false,
    inputSchema: { type: "object", properties: {} },
  },
  {
    id: "predecir_demanda_stock",
    title: "Predecir demanda de stock",
    description: "Predice demanda futura de stock por producto y horizonte temporal.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista"],
    endpoint: "/api/predictions/stock-coverage",
    method: "POST",
    risk: "medium",
    confirmationRequired: false,
    inputSchema: {
      type: "object",
      properties: {
        body: {
          type: "object",
          properties: {
            productoId: { type: "string" },
            diasFuturos: { type: "number" },
          },
        },
      },
    },
  },
  {
    id: "enviar_presupuesto_a_almacen",
    title: "Enviar presupuesto a almacen",
    description: "Pasa un presupuesto pendiente al flujo de preparacion en almacen.",
    kind: "api",
    roles: ["admin", "vendedor"],
    endpoint: "/api/ventas/presupuestos/enviar-almacen",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            presupuesto_id: { type: "string" },
          },
          required: ["presupuesto_id"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "actualizar_peso_item_presupuesto",
    title: "Actualizar peso de item",
    description: "Actualiza el peso final de un item pesable en almacen.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/almacen/presupuesto/pesaje",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            presupuesto_item_id: { type: "string" },
            peso_final: { type: "number" },
          },
          required: ["presupuesto_item_id", "peso_final"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "finalizar_pesaje_presupuesto",
    title: "Finalizar pesaje de presupuesto",
    description: "Finaliza el pesaje y recalcula totales del presupuesto.",
    kind: "api",
    roles: ["admin", "almacenista"],
    endpoint: "/api/almacen/presupuesto/finalizar",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            presupuesto_id: { type: "string" },
          },
          required: ["presupuesto_id"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "facturar_presupuesto",
    title: "Facturar presupuesto",
    description: "Convierte presupuesto en pedido y factura en el flujo oficial.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista"],
    endpoint: "/api/ventas/presupuestos/facturar",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        confirmationCode: { type: "string" },
        body: {
          type: "object",
          properties: {
            presupuesto_id: { type: "string" },
            caja_id: { type: "string" },
          },
          required: ["presupuesto_id"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "asignar_pedido_a_ruta_almacen",
    title: "Asignar pedido a ruta",
    description: "Asigna un pedido preparando a una ruta diaria desde almacen.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista"],
    endpoint: "/api/reparto/pedidos/:pedidoId/asignar-ruta",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        pathParams: {
          type: "object",
          properties: {
            pedidoId: { type: "string" },
          },
          required: ["pedidoId"],
        },
      },
      required: ["pathParams"],
    },
  },
  {
    id: "generar_ruta_optimizada",
    title: "Generar ruta optimizada",
    description: "Genera ruta optimizada para reparto con motor standard.",
    kind: "api",
    roles: ["admin", "vendedor", "almacenista"],
    endpoint: "/api/rutas/generar",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: {
          type: "object",
          properties: {
            rutaId: { type: "string" },
            usarGoogle: { type: "boolean" },
          },
          required: ["rutaId"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "optimizar_ruta_avanzada",
    title: "Optimizar ruta avanzada",
    description: "Ejecuta optimizacion avanzada de ruta usando Google Cloud.",
    kind: "api",
    roles: ["admin"],
    endpoint: "/api/rutas/optimize-advanced",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        confirmationCode: { type: "string" },
        body: {
          type: "object",
          properties: {
            rutaId: { type: "string" },
            options: { type: "object" },
          },
          required: ["rutaId"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "registrar_entrega_reparto",
    title: "Registrar entrega",
    description: "Registra una entrega realizada por el repartidor.",
    kind: "api",
    roles: ["repartidor"],
    endpoint: "/api/reparto/entrega",
    method: "POST",
    risk: "high",
    confirmationRequired: true,
    confirmationMode: "hard",
    confirmationCode: "CONFIRMAR",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        confirmationCode: { type: "string" },
        body: { type: "object" },
      },
      required: ["body"],
    },
  },
  {
    id: "registrar_devolucion_reparto",
    title: "Registrar devolucion",
    description: "Registra devolucion de producto durante reparto.",
    kind: "api",
    roles: ["repartidor"],
    endpoint: "/api/reparto/devolucion",
    method: "POST",
    risk: "medium",
    confirmationRequired: true,
    confirmationMode: "soft",
    inputSchema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
        body: { type: "object" },
      },
      required: ["body"],
    },
  },
  {
    id: "registrar_ubicacion_reparto",
    title: "Registrar ubicacion GPS",
    description: "Registra posicion GPS actual del repartidor.",
    kind: "api",
    roles: ["repartidor"],
    endpoint: "/api/reparto/ubicacion",
    method: "POST",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: {
      type: "object",
      properties: {
        body: {
          type: "object",
          properties: {
            vehiculoId: { type: "string" },
            lat: { type: "number" },
            lng: { type: "number" },
          },
          required: ["vehiculoId", "lat", "lng"],
        },
      },
      required: ["body"],
    },
  },
  {
    id: "consultar_auditoria_webmcp",
    title: "Consultar auditoria webmcp",
    description: "Consulta trazabilidad de ejecuciones WebMCP.",
    kind: "api",
    roles: ["admin", "tesorero", "encargado_sucursal", "vendedor", "almacenista", "repartidor"],
    endpoint: "/api/webmcp/auditoria",
    method: "GET",
    risk: "low",
    confirmationRequired: false,
    confirmationMode: "none",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          properties: {
            limit: { type: "number" },
            tool_id: { type: "string" },
            status: { type: "string" },
            user_id: { type: "string" },
          },
        },
      },
    },
  },
];

export function getWebMcpToolById(id: string): WebMcpTool | undefined {
  return WEBMCP_TOOLS.find((tool) => tool.id === id);
}

export function getWebMcpToolsForRole(role: UserRole | null | undefined): WebMcpTool[] {
  if (!role) return [];
  return WEBMCP_TOOLS.filter((tool) => tool.roles.includes(role));
}

export function getWebMcpConfirmationMode(tool: WebMcpTool): WebMcpConfirmationMode {
  if (tool.confirmationMode) return tool.confirmationMode;
  if (!tool.confirmationRequired) return "none";
  return tool.risk === "high" ? "hard" : "soft";
}
