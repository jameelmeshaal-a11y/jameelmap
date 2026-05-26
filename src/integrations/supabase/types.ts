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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      scrape_job_cities: {
        Row: {
          city: string
          created_at: string
          current_step: string
          error_message: string
          id: string
          job_id: string
          progress: number
          results_count: number
          status: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          current_step?: string
          error_message?: string
          id?: string
          job_id: string
          progress?: number
          results_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          current_step?: string
          error_message?: string
          id?: string
          job_id?: string
          progress?: number
          results_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          activity: string
          cities_done: number
          cities_total: number
          country: string
          created_at: string
          current_city: string | null
          error_message: string | null
          from_cache: boolean | null
          id: string
          last_page_token: string | null
          max_results: number | null
          processed_cities: string[] | null
          results_count: number
          status: string
          stopped_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activity: string
          cities_done?: number
          cities_total?: number
          country: string
          created_at?: string
          current_city?: string | null
          error_message?: string | null
          from_cache?: boolean | null
          id?: string
          last_page_token?: string | null
          max_results?: number | null
          processed_cities?: string[] | null
          results_count?: number
          status?: string
          stopped_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activity?: string
          cities_done?: number
          cities_total?: number
          country?: string
          created_at?: string
          current_city?: string | null
          error_message?: string | null
          from_cache?: boolean | null
          id?: string
          last_page_token?: string | null
          max_results?: number | null
          processed_cities?: string[] | null
          results_count?: number
          status?: string
          stopped_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scrape_results: {
        Row: {
          address: string | null
          all_emails: string | null
          category: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          email_scraped_at: string | null
          facebook: string | null
          id: string
          instagram: string | null
          job_id: string
          maps_url: string | null
          name: string | null
          phone: string | null
          place_id: string
          snapchat: string | null
          state: string | null
          tiktok: string | null
          twitter: string | null
          website: string | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          address?: string | null
          all_emails?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          email_scraped_at?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          job_id: string
          maps_url?: string | null
          name?: string | null
          phone?: string | null
          place_id: string
          snapchat?: string | null
          state?: string | null
          tiktok?: string | null
          twitter?: string | null
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          address?: string | null
          all_emails?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          email_scraped_at?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          job_id?: string
          maps_url?: string | null
          name?: string | null
          phone?: string | null
          place_id?: string
          snapchat?: string | null
          state?: string | null
          tiktok?: string | null
          twitter?: string | null
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scrape_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      search_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
          expires_at: string
          result_count: number
        }
        Insert: {
          cache_key: string
          created_at?: string
          data: Json
          expires_at?: string
          result_count?: number
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
          expires_at?: string
          result_count?: number
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          allowed_countries: string[]
          can_delete: boolean
          can_export: boolean
          can_search: boolean
          can_view_library: boolean
          created_at: string
          id: string
          max_searches_per_day: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_countries?: string[]
          can_delete?: boolean
          can_export?: boolean
          can_search?: boolean
          can_view_library?: boolean
          created_at?: string
          id?: string
          max_searches_per_day?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_countries?: string[]
          can_delete?: boolean
          can_export?: boolean
          can_search?: boolean
          can_view_library?: boolean
          created_at?: string
          id?: string
          max_searches_per_day?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
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
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_any_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "viewer"
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
      app_role: ["admin", "manager", "viewer"],
    },
  },
} as const
