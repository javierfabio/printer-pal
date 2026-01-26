export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      filiales: {
        Row: {
          activo: boolean | null
          created_at: string
          direccion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      historial_cambios: {
        Row: {
          campo_modificado: string
          created_at: string
          id: string
          impresora_id: string
          motivo: string | null
          usuario_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          campo_modificado: string
          created_at?: string
          id?: string
          impresora_id: string
          motivo?: string | null
          usuario_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          campo_modificado?: string
          created_at?: string
          id?: string
          impresora_id?: string
          motivo?: string | null
          usuario_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_cambios_impresora_id_fkey"
            columns: ["impresora_id"]
            isOneToOne: false
            referencedRelation: "impresoras"
            referencedColumns: ["id"]
          },
        ]
      }
      impresoras: {
        Row: {
          contador_color_actual: number | null
          contador_color_inicial: number | null
          contador_negro_actual: number | null
          contador_negro_inicial: number | null
          created_at: string
          descripcion: string | null
          editado_por: string | null
          estado: Database["public"]["Enums"]["impresora_estado"]
          fecha_registro: string
          filial_id: string | null
          id: string
          modelo: string
          nombre: string
          sector_id: string | null
          serie: string
          tipo_consumo: Database["public"]["Enums"]["consumo_tipo"]
          tipo_impresion: Database["public"]["Enums"]["impresion_tipo"]
          updated_at: string
        }
        Insert: {
          contador_color_actual?: number | null
          contador_color_inicial?: number | null
          contador_negro_actual?: number | null
          contador_negro_inicial?: number | null
          created_at?: string
          descripcion?: string | null
          editado_por?: string | null
          estado?: Database["public"]["Enums"]["impresora_estado"]
          fecha_registro?: string
          filial_id?: string | null
          id?: string
          modelo: string
          nombre: string
          sector_id?: string | null
          serie: string
          tipo_consumo: Database["public"]["Enums"]["consumo_tipo"]
          tipo_impresion: Database["public"]["Enums"]["impresion_tipo"]
          updated_at?: string
        }
        Update: {
          contador_color_actual?: number | null
          contador_color_inicial?: number | null
          contador_negro_actual?: number | null
          contador_negro_inicial?: number | null
          created_at?: string
          descripcion?: string | null
          editado_por?: string | null
          estado?: Database["public"]["Enums"]["impresora_estado"]
          fecha_registro?: string
          filial_id?: string | null
          id?: string
          modelo?: string
          nombre?: string
          sector_id?: string | null
          serie?: string
          tipo_consumo?: Database["public"]["Enums"]["consumo_tipo"]
          tipo_impresion?: Database["public"]["Enums"]["impresion_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impresoras_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impresoras_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
      }
      lecturas_contadores: {
        Row: {
          contador_color: number | null
          contador_negro: number | null
          fecha_lectura: string
          id: string
          impresora_id: string
          notas: string | null
          registrado_por: string
        }
        Insert: {
          contador_color?: number | null
          contador_negro?: number | null
          fecha_lectura?: string
          id?: string
          impresora_id: string
          notas?: string | null
          registrado_por: string
        }
        Update: {
          contador_color?: number | null
          contador_negro?: number | null
          fecha_lectura?: string
          id?: string
          impresora_id?: string
          notas?: string | null
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecturas_contadores_impresora_id_fkey"
            columns: ["impresora_id"]
            isOneToOne: false
            referencedRelation: "impresoras"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sectores: {
        Row: {
          activo: boolean | null
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      consumo_tipo: "tinta" | "toner"
      impresion_tipo: "monocromatico" | "color"
      impresora_estado: "activa" | "inactiva" | "en_reparacion" | "baja"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      consumo_tipo: ["tinta", "toner"],
      impresion_tipo: ["monocromatico", "color"],
      impresora_estado: ["activa", "inactiva", "en_reparacion", "baja"],
    },
  },
} as const
