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
      credit_transactions: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          chat_id: number
          created_at: string
          error: string | null
          id: string
          ok: boolean
          scheduled_message_id: string | null
          telegram_message_id: number | null
          user_id: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          error?: string | null
          id?: string
          ok: boolean
          scheduled_message_id?: string | null
          telegram_message_id?: number | null
          user_id: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          error?: string | null
          id?: string
          ok?: boolean
          scheduled_message_id?: string | null
          telegram_message_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_emojis: {
        Row: {
          created_at: string
          custom_emoji_id: string
          id: string
          name: string
          preview_char: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_emoji_id: string
          id?: string
          name: string
          preview_char?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          custom_emoji_id?: string
          id?: string
          name?: string
          preview_char?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits: number
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_schedules: {
        Row: {
          account_id: string | null
          content: string | null
          created_at: string
          id: string
          is_active: boolean
          is_premium: boolean
          last_fire_key: string | null
          last_sent_at: string | null
          parse_mode: string
          room_id: string
          times: string[]
          timezone: string
          title: string
          updated_at: string
          user_id: string
          video_id: string | null
          weekdays: number[]
        }
        Insert: {
          account_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          last_fire_key?: string | null
          last_sent_at?: string | null
          parse_mode?: string
          room_id: string
          times?: string[]
          timezone?: string
          title: string
          updated_at?: string
          user_id: string
          video_id?: string | null
          weekdays?: number[]
        }
        Update: {
          account_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          last_fire_key?: string | null
          last_sent_at?: string | null
          parse_mode?: string
          room_id?: string
          times?: string[]
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
          video_id?: string | null
          weekdays?: number[]
        }
        Relationships: []
      }
      room_chats: {
        Row: {
          chat_id: number
          chat_title: string | null
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          chat_id: number
          chat_title?: string | null
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          chat_id?: number
          chat_title?: string | null
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_chats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          default_account_id: string | null
          description: string | null
          id: string
          name: string
          photo_updated_at: string | null
          photo_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          default_account_id?: string | null
          description?: string | null
          id?: string
          name: string
          photo_updated_at?: string | null
          photo_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          default_account_id?: string | null
          description?: string | null
          id?: string
          name?: string
          photo_updated_at?: string | null
          photo_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "telegram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          account_id: string | null
          content: string | null
          created_at: string
          id: string
          last_error: string | null
          parse_mode: string
          room_id: string
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          user_id: string
          video_id: string | null
        }
        Insert: {
          account_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          parse_mode?: string
          room_id: string
          scheduled_at: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          user_id: string
          video_id?: string | null
        }
        Update: {
          account_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          parse_mode?: string
          room_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "telegram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          bot_first_name: string | null
          bot_token: string
          bot_username: string | null
          created_at: string
          daily_limit: number
          id: string
          is_active: boolean
          label: string
          last_check_at: string | null
          last_error: string | null
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          bot_first_name?: string | null
          bot_token: string
          bot_username?: string | null
          created_at?: string
          daily_limit?: number
          id?: string
          is_active?: boolean
          label: string
          last_check_at?: string | null
          last_error?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          bot_first_name?: string | null
          bot_token?: string
          bot_username?: string | null
          created_at?: string
          daily_limit?: number
          id?: string
          is_active?: boolean
          label?: string
          last_check_at?: string | null
          last_error?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_chats: {
        Row: {
          account_id: string
          cached_at: string
          chat_id: number
          id: string
          title: string | null
          type: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          account_id: string
          cached_at?: string
          chat_id: number
          id?: string
          title?: string | null
          type?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          account_id?: string
          cached_at?: string
          chat_id?: number
          id?: string
          title?: string | null
          type?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_chats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "telegram_accounts"
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
      videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "unknown" | "ok" | "error"
      account_type: "bot" | "premium"
      app_role: "admin" | "user"
      message_status: "pending" | "sending" | "sent" | "failed" | "cancelled"
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
      account_status: ["unknown", "ok", "error"],
      account_type: ["bot", "premium"],
      app_role: ["admin", "user"],
      message_status: ["pending", "sending", "sent", "failed", "cancelled"],
    },
  },
} as const
