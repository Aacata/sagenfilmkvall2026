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
      booking_holds: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          seats: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id: string
          seats: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          seats?: number
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_number: string
          created_at: string
          email: string
          id: string
        }
        Insert: {
          booking_number: string
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          booking_number?: string
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      event_settings: {
        Row: {
          capacity: number
          created_at: string
          event_info: string | null
          event_location: string | null
          event_time: string | null
          event_title: string | null
          id: number
          poster_url: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          event_info?: string | null
          event_location?: string | null
          event_time?: string | null
          event_title?: string | null
          id?: number
          poster_url?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          event_info?: string | null
          event_location?: string | null
          event_time?: string | null
          event_title?: string | null
          id?: number
          poster_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          booking_id: string
          checked_in: boolean
          checked_in_at: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
        }
        Insert: {
          booking_id: string
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
        }
        Update: {
          booking_id?: string
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_guests: {
        Row: {
          checked_in: boolean
          checked_in_at: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          note: string | null
        }
        Insert: {
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          note?: string | null
        }
        Update: {
          checked_in?: boolean
          checked_in_at?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          note?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking: { Args: { _booking_id: string }; Returns: Json }
      cancel_ticket: {
        Args: { _booking_id: string; _ticket_id: string }
        Returns: Json
      }
      check_in_ticket: { Args: { _ticket_id: string }; Returns: Json }
      create_booking_with_names:
        | { Args: { _email: string; _names: Json }; Returns: Json }
        | {
            Args: { _email: string; _hold_id?: string; _names: Json }
            Returns: Json
          }
      find_booking_by_number: { Args: { _number: string }; Returns: Json }
      find_user_by_email_fn: { Args: { _email: string }; Returns: string }
      fix_auth_user_nulls: { Args: { _user_id: string }; Returns: undefined }
      get_availability: { Args: never; Returns: Json }
      get_booking_public: { Args: { _booking_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hold_seats: { Args: { _hold_id: string; _seats: number }; Returns: Json }
      purge_expired_holds: { Args: never; Returns: undefined }
      release_hold: { Args: { _hold_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
