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
      engagement_orders: {
        Row: {
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          quantity: number
          raw_response: Json | null
          room_id: string | null
          smm_order_id: string | null
          smm_service_id: number | null
          status: Database["public"]["Enums"]["engagement_order_status"]
          subscription_id: string | null
          target: string
          type: Database["public"]["Enums"]["engagement_order_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          quantity: number
          raw_response?: Json | null
          room_id?: string | null
          smm_order_id?: string | null
          smm_service_id?: number | null
          status?: Database["public"]["Enums"]["engagement_order_status"]
          subscription_id?: string | null
          target: string
          type: Database["public"]["Enums"]["engagement_order_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          quantity?: number
          raw_response?: Json | null
          room_id?: string | null
          smm_order_id?: string | null
          smm_service_id?: number | null
          status?: Database["public"]["Enums"]["engagement_order_status"]
          subscription_id?: string | null
          target?: string
          type?: Database["public"]["Enums"]["engagement_order_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_engagement_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kirvano_checkout_url: string | null
          monthly_members_quota: number
          monthly_reactions_quota: number
          name: string
          price_brl: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kirvano_checkout_url?: string | null
          monthly_members_quota?: number
          monthly_reactions_quota?: number
          name: string
          price_brl: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kirvano_checkout_url?: string | null
          monthly_members_quota?: number
          monthly_reactions_quota?: number
          name?: string
          price_brl?: number
          slug?: string
          sort_order?: number
          updated_at?: string
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
      room_assets: {
        Row: {
          asset_code: string
          category: string
          created_at: string
          id: string
          is_open: boolean
          payout: number
          room_id: string
          updated_at: string
          user_id: string
          window_id: string | null
        }
        Insert: {
          asset_code: string
          category: string
          created_at?: string
          id?: string
          is_open?: boolean
          payout?: number
          room_id: string
          updated_at?: string
          user_id: string
          window_id?: string | null
        }
        Update: {
          asset_code?: string
          category?: string
          created_at?: string
          id?: string
          is_open?: boolean
          payout?: number
          room_id?: string
          updated_at?: string
          user_id?: string
          window_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_assets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assets_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "room_windows"
            referencedColumns: ["id"]
          },
        ]
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
      room_engagement_settings: {
        Row: {
          auto_members_enabled: boolean
          auto_react_enabled: boolean
          created_at: string
          delay_seconds_max: number
          delay_seconds_min: number
          id: string
          members_per_day: number
          react_emojis: string[]
          reactions_per_signal: number
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_members_enabled?: boolean
          auto_react_enabled?: boolean
          created_at?: string
          delay_seconds_max?: number
          delay_seconds_min?: number
          id?: string
          members_per_day?: number
          react_emojis?: string[]
          reactions_per_signal?: number
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_members_enabled?: boolean
          auto_react_enabled?: boolean
          created_at?: string
          delay_seconds_max?: number
          delay_seconds_min?: number
          id?: string
          members_per_day?: number
          react_emojis?: string[]
          reactions_per_signal?: number
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      room_images: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["room_image_kind"]
          room_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["room_image_kind"]
          room_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["room_image_kind"]
          room_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_images_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reports: {
        Row: {
          created_at: string
          delay_minutes: number
          enabled: boolean
          id: string
          image_path: string | null
          include_stats: boolean
          room_id: string
          send_time: string
          template: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number
          enabled?: boolean
          id?: string
          image_path?: string | null
          include_stats?: boolean
          room_id: string
          send_time?: string
          template?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number
          enabled?: boolean
          id?: string
          image_path?: string | null
          include_stats?: boolean
          room_id?: string
          send_time?: string
          template?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_reports_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_session_messages: {
        Row: {
          content: string
          created_at: string
          enabled: boolean
          id: string
          image_path: string | null
          kind: Database["public"]["Enums"]["session_msg_kind"]
          lead_minutes: number
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          image_path?: string | null
          kind: Database["public"]["Enums"]["session_msg_kind"]
          lead_minutes?: number
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          image_path?: string | null
          kind?: Database["public"]["Enums"]["session_msg_kind"]
          lead_minutes?: number
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_session_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_template_buttons: {
        Row: {
          created_at: string
          id: string
          label: string
          room_id: string
          sort_order: number
          template_kind: Database["public"]["Enums"]["template_kind"]
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          room_id: string
          sort_order?: number
          template_kind: Database["public"]["Enums"]["template_kind"]
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          room_id?: string
          sort_order?: number
          template_kind?: Database["public"]["Enums"]["template_kind"]
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_template_buttons_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["template_kind"]
          parse_mode: string
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["template_kind"]
          parse_mode?: string
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["template_kind"]
          parse_mode?: string
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_templates_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_windows: {
        Row: {
          asset_filter: string[]
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          martingale: number
          max_losses: number
          name: string
          room_id: string
          signal_type: string
          signals_qty: number
          start_time: string
          timeframes: string[]
          updated_at: string
          use_all_assets: boolean
          user_id: string
          weekdays: number[]
        }
        Insert: {
          asset_filter?: string[]
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          martingale?: number
          max_losses?: number
          name: string
          room_id: string
          signal_type?: string
          signals_qty?: number
          start_time: string
          timeframes?: string[]
          updated_at?: string
          use_all_assets?: boolean
          user_id: string
          weekdays?: number[]
        }
        Update: {
          asset_filter?: string[]
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          martingale?: number
          max_losses?: number
          name?: string
          room_id?: string
          signal_type?: string
          signals_qty?: number
          start_time?: string
          timeframes?: string[]
          updated_at?: string
          use_all_assets?: boolean
          user_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "room_windows_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          access_url: string | null
          broker: string | null
          created_at: string
          default_account_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          market_tips_enabled: boolean
          name: string
          photo_updated_at: string | null
          photo_url: string | null
          premium_account_id: string | null
          stop_loss_enabled: boolean
          stop_loss_message: string | null
          stop_loss_value: number | null
          timezone: string
          user_id: string
          welcome_message: string | null
        }
        Insert: {
          access_url?: string | null
          broker?: string | null
          created_at?: string
          default_account_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          market_tips_enabled?: boolean
          name: string
          photo_updated_at?: string | null
          photo_url?: string | null
          premium_account_id?: string | null
          stop_loss_enabled?: boolean
          stop_loss_message?: string | null
          stop_loss_value?: number | null
          timezone?: string
          user_id: string
          welcome_message?: string | null
        }
        Update: {
          access_url?: string | null
          broker?: string | null
          created_at?: string
          default_account_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          market_tips_enabled?: boolean
          name?: string
          photo_updated_at?: string | null
          photo_url?: string | null
          premium_account_id?: string | null
          stop_loss_enabled?: boolean
          stop_loss_message?: string | null
          stop_loss_value?: number | null
          timezone?: string
          user_id?: string
          welcome_message?: string | null
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
      user_engagement_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          kirvano_customer_email: string | null
          kirvano_sale_id: string | null
          last_event: Json | null
          members_used: number
          plan_id: string
          reactions_used: number
          status: Database["public"]["Enums"]["engagement_sub_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          kirvano_customer_email?: string | null
          kirvano_sale_id?: string | null
          last_event?: Json | null
          members_used?: number
          plan_id: string
          reactions_used?: number
          status?: Database["public"]["Enums"]["engagement_sub_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          kirvano_customer_email?: string | null
          kirvano_sale_id?: string | null
          last_event?: Json | null
          members_used?: number
          plan_id?: string
          reactions_used?: number
          status?: Database["public"]["Enums"]["engagement_sub_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_engagement_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "engagement_plans"
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
      engagement_order_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "partial"
        | "canceled"
        | "failed"
      engagement_order_type: "reaction" | "members"
      engagement_sub_status: "pending" | "active" | "canceled" | "expired"
      message_status: "pending" | "sending" | "sent" | "failed" | "cancelled"
      room_image_kind: "gain" | "loss"
      session_msg_kind: "open" | "close"
      template_kind:
        | "entry"
        | "gain"
        | "loss"
        | "event"
        | "signal"
        | "win"
        | "win_martingale"
        | "buy_direction"
        | "sell_direction"
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
      engagement_order_status: [
        "pending",
        "in_progress",
        "completed",
        "partial",
        "canceled",
        "failed",
      ],
      engagement_order_type: ["reaction", "members"],
      engagement_sub_status: ["pending", "active", "canceled", "expired"],
      message_status: ["pending", "sending", "sent", "failed", "cancelled"],
      room_image_kind: ["gain", "loss"],
      session_msg_kind: ["open", "close"],
      template_kind: [
        "entry",
        "gain",
        "loss",
        "event",
        "signal",
        "win",
        "win_martingale",
        "buy_direction",
        "sell_direction",
      ],
    },
  },
} as const
