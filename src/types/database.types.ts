// Este archivo se generará automáticamente con los tipos de Supabase
// Una vez configurado el proyecto de Supabase, ejecutar:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > src/types/database.types.ts

// Tipos temporales hasta configurar Supabase
export interface Database {
  public: {
    Tables: {
      productos: any
      clientes: any
      vehiculos: any
      usuarios: any
      lotes: any
      movimientos_stock: any
      checklists_calidad: any
      pedidos: any
      detalles_pedido: any
      cotizaciones: any
      detalles_cotizacion: any
      reclamos: any
      checklists_vehiculos: any
      rutas_reparto: any
      detalles_ruta: any
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_crear_pedido_bot: any
      fn_validar_entrega: any
    }
    Enums: {
      [_ in never]: never
    }
  }
}
