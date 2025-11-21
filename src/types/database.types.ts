// Auto-generated Supabase types with tesoreria_cajas fix
export type Database = {
  public: {
    Tables: {
      usuarios: any;
      clientes: any;
      productos: any;
      lotes: any;
      movimientos_stock: any;
      checklists_calidad: any;
      pedidos: any;
      detalles_pedido: any;
      cotizaciones: any;
      detalles_cotizacion: any;
      reclamos: any;
      vehiculos: any;
      checklists_vehiculos: any;
      rutas_reparto: any;
      detalles_ruta: any;
      ubicaciones_repartidores: any;
      alertas_reparto: any;
      zonas: any;
      presupuestos: any;
      detalles_presupuesto: any;
      cuentas_corrientes: any;
      gastos: any;
      tesoreria_cajas: {
        Row: {
          id: string;
          sucursal_id: string | null;
          nombre: string;
          saldo_inicial: number;
          saldo_actual: number;
          moneda: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sucursal_id?: string | null;
          nombre: string;
          saldo_inicial?: number;
          saldo_actual?: number;
          moneda?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sucursal_id?: string | null;
          nombre?: string;
          saldo_inicial?: number;
          saldo_actual?: number;
          moneda?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tesoreria_movimientos: any;
      rutas_planificadas: any;
      [key: string]: any;
    };
    Views: {
      [key: string]: any;
    };
    Functions: {
      [key: string]: any;
    };
    Enums: {
      [key: string]: any;
    };
  };
};
