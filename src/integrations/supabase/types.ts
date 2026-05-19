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
      bot_execution_logs: {
        Row: {
          account_id: string | null
          bot_type: string
          chat_id: number | null
          created_at: string
          details: Json | null
          error: string | null
          event: string
          id: string
          message: string | null
          room_id: string | null
          target_chat_id: number | null
          tg_first_name: string | null
          tg_user_id: number | null
          tg_username: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          bot_type: string
          chat_id?: number | null
          created_at?: string
          details?: Json | null
          error?: string | null
          event: string
          id?: string
          message?: string | null
          room_id?: string | null
          target_chat_id?: number | null
          tg_first_name?: string | null
          tg_user_id?: number | null
          tg_username?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          bot_type?: string
          chat_id?: number | null
          created_at?: string
          details?: Json | null
          error?: string | null
          event?: string
          id?: string
          message?: string | null
          room_id?: string | null
          target_chat_id?: number | null
          tg_first_name?: string | null
          tg_user_id?: number | null
          tg_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
          bot_type: Database["public"]["Enums"]["engagement_bot_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kirvano_checkout_url: string | null
          monthly_members_quota: number
          monthly_quota: number
          monthly_reactions_quota: number
          name: string
          price_brl: number
          slug: string
          smm_default_quantity: number | null
          smm_service_id: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bot_type: Database["public"]["Enums"]["engagement_bot_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kirvano_checkout_url?: string | null
          monthly_members_quota?: number
          monthly_quota?: number
          monthly_reactions_quota?: number
          name: string
          price_brl: number
          slug: string
          smm_default_quantity?: number | null
          smm_service_id?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bot_type?: Database["public"]["Enums"]["engagement_bot_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kirvano_checkout_url?: string | null
          monthly_members_quota?: number
          monthly_quota?: number
          monthly_reactions_quota?: number
          name?: string
          price_brl?: number
          slug?: string
          smm_default_quantity?: number | null
          smm_service_id?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      followup_dispatch_log: {
        Row: {
          day_number: number
          error: string | null
          id: number
          lead_id: string
          ok: boolean
          sent_at: string
          user_id: string
        }
        Insert: {
          day_number: number
          error?: string | null
          id?: number
          lead_id: string
          ok: boolean
          sent_at?: string
          user_id: string
        }
        Update: {
          day_number?: number
          error?: string | null
          id?: number
          lead_id?: string
          ok?: boolean
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      followup_leads: {
        Row: {
          account_id: string
          chat_id: number
          created_at: string
          first_name: string | null
          id: string
          last_sent_at: string | null
          last_sent_day: number | null
          room_id: string
          started_at: string
          status: string
          stopped_at: string | null
          stopped_reason: string | null
          tg_user_id: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          account_id: string
          chat_id: number
          created_at?: string
          first_name?: string | null
          id?: string
          last_sent_at?: string | null
          last_sent_day?: number | null
          room_id: string
          started_at?: string
          status?: string
          stopped_at?: string | null
          stopped_reason?: string | null
          tg_user_id: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          account_id?: string
          chat_id?: number
          created_at?: string
          first_name?: string | null
          id?: string
          last_sent_at?: string | null
          last_sent_day?: number | null
          room_id?: string
          started_at?: string
          status?: string
          stopped_at?: string | null
          stopped_reason?: string | null
          tg_user_id?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      followup_messages: {
        Row: {
          button_text: string | null
          button_url: string | null
          content: string | null
          created_at: string
          day_number: number
          id: string
          image_mime: string | null
          image_path: string | null
          parse_mode: string
          premium_account_id: string | null
          premium_enabled: boolean
          room_id: string
          send_time: string
          sort_order: number
          updated_at: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          day_number: number
          id?: string
          image_mime?: string | null
          image_path?: string | null
          parse_mode?: string
          premium_account_id?: string | null
          premium_enabled?: boolean
          room_id: string
          send_time?: string
          sort_order?: number
          updated_at?: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          day_number?: number
          id?: string
          image_mime?: string | null
          image_path?: string | null
          parse_mode?: string
          premium_account_id?: string | null
          premium_enabled?: boolean
          room_id?: string
          send_time?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: []
      }
      followup_settings: {
        Row: {
          created_at: string
          enabled: boolean
          room_id: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          room_id: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          room_id?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forwarder_dedupe: {
        Row: {
          chat_id: number
          created_at: string
          message_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          message_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          message_id?: number
        }
        Relationships: []
      }
      market_tips_sent: {
        Row: {
          created_at: string
          id: string
          link: string | null
          link_hash: string
          room_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          link_hash: string
          room_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          link_hash?: string
          room_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          account_id: string | null
          chat_id: number
          created_at: string
          error: string | null
          id: string
          ok: boolean
          premium_status: string | null
          room_id: string | null
          scheduled_message_id: string | null
          source: string | null
          telegram_message_id: number | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          chat_id: number
          created_at?: string
          error?: string | null
          id?: string
          ok: boolean
          premium_status?: string | null
          room_id?: string | null
          scheduled_message_id?: string | null
          source?: string | null
          telegram_message_id?: number | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          chat_id?: number
          created_at?: string
          error?: string | null
          id?: string
          ok?: boolean
          premium_status?: string | null
          room_id?: string | null
          scheduled_message_id?: string | null
          source?: string | null
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
      meta_event_logs: {
        Row: {
          created_at: string
          error: string | null
          event_id: string | null
          event_name: string
          id: string
          ok: boolean
          request_payload: Json | null
          response_payload: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          event_name: string
          id?: string
          ok: boolean
          request_payload?: Json | null
          response_payload?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          event_name?: string
          id?: string
          ok?: boolean
          request_payload?: Json | null
          response_payload?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      meta_integrations: {
        Row: {
          access_token: string
          created_at: string
          event_mappings: Json
          id: string
          is_active: boolean
          pixel_id: string
          test_event_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          event_mappings?: Json
          id?: string
          is_active?: boolean
          pixel_id: string
          test_event_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          event_mappings?: Json
          id?: string
          is_active?: boolean
          pixel_id?: string
          test_event_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      quick_send_templates: {
        Row: {
          content: string
          created_at: string
          default_account_id: string | null
          default_room_id: string | null
          id: string
          image_ext: string | null
          image_mime: string | null
          image_path: string | null
          is_premium: boolean
          name: string
          parse_mode: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          default_account_id?: string | null
          default_room_id?: string | null
          id?: string
          image_ext?: string | null
          image_mime?: string | null
          image_path?: string | null
          is_premium?: boolean
          name: string
          parse_mode?: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          default_account_id?: string | null
          default_room_id?: string | null
          id?: string
          image_ext?: string | null
          image_mime?: string | null
          image_path?: string | null
          is_premium?: boolean
          name?: string
          parse_mode?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_pending_followups: {
        Row: {
          account_id: string | null
          button_text: string | null
          button_url: string | null
          content: string | null
          created_at: string
          id: string
          image_mime: string | null
          image_path: string | null
          last_error: string | null
          parse_mode: string
          room_id: string
          schedule_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          account_id?: string | null
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_mime?: string | null
          image_path?: string | null
          last_error?: string | null
          parse_mode?: string
          room_id: string
          schedule_id: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          account_id?: string | null
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_mime?: string | null
          image_path?: string | null
          last_error?: string | null
          parse_mode?: string
          room_id?: string
          schedule_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_pending_followups_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          account_id: string | null
          button_text: string | null
          button_url: string | null
          content: string | null
          created_at: string
          folder_id: string | null
          follow_ups: Json
          id: string
          image_mime: string | null
          image_path: string | null
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
          weekday_overrides: Json
          weekdays: number[]
        }
        Insert: {
          account_id?: string | null
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          folder_id?: string | null
          follow_ups?: Json
          id?: string
          image_mime?: string | null
          image_path?: string | null
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
          weekday_overrides?: Json
          weekdays?: number[]
        }
        Update: {
          account_id?: string | null
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          folder_id?: string | null
          follow_ups?: Json
          id?: string
          image_mime?: string | null
          image_path?: string | null
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
          weekday_overrides?: Json
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "schedule_folders"
            referencedColumns: ["id"]
          },
        ]
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
          followup_cta_button_text: string
          followup_cta_enabled: boolean
          forwarder_allowed_types: string[]
          forwarder_enabled: boolean
          forwarder_marked_recurring: string[]
          forwarder_marked_scheduled: string[]
          forwarder_marked_templates: string[]
          forwarder_premium_account_id: string | null
          forwarder_premium_enabled: boolean
          forwarder_source_chat_id: number | null
          forwarder_target_chat_ids: number[]
          id: string
          members_per_day: number
          react_emojis: string[]
          reactions_per_signal: number
          room_id: string
          updated_at: string
          user_id: string
          welcome_bot_enabled: boolean
          welcome_image_mime: string | null
          welcome_image_path: string | null
          welcome_message: string | null
          welcome_parse_mode: string
          welcome_premium_account_id: string | null
          welcome_premium_enabled: boolean
          welcome_video_id: string | null
        }
        Insert: {
          auto_members_enabled?: boolean
          auto_react_enabled?: boolean
          created_at?: string
          delay_seconds_max?: number
          delay_seconds_min?: number
          followup_cta_button_text?: string
          followup_cta_enabled?: boolean
          forwarder_allowed_types?: string[]
          forwarder_enabled?: boolean
          forwarder_marked_recurring?: string[]
          forwarder_marked_scheduled?: string[]
          forwarder_marked_templates?: string[]
          forwarder_premium_account_id?: string | null
          forwarder_premium_enabled?: boolean
          forwarder_source_chat_id?: number | null
          forwarder_target_chat_ids?: number[]
          id?: string
          members_per_day?: number
          react_emojis?: string[]
          reactions_per_signal?: number
          room_id: string
          updated_at?: string
          user_id: string
          welcome_bot_enabled?: boolean
          welcome_image_mime?: string | null
          welcome_image_path?: string | null
          welcome_message?: string | null
          welcome_parse_mode?: string
          welcome_premium_account_id?: string | null
          welcome_premium_enabled?: boolean
          welcome_video_id?: string | null
        }
        Update: {
          auto_members_enabled?: boolean
          auto_react_enabled?: boolean
          created_at?: string
          delay_seconds_max?: number
          delay_seconds_min?: number
          followup_cta_button_text?: string
          followup_cta_enabled?: boolean
          forwarder_allowed_types?: string[]
          forwarder_enabled?: boolean
          forwarder_marked_recurring?: string[]
          forwarder_marked_scheduled?: string[]
          forwarder_marked_templates?: string[]
          forwarder_premium_account_id?: string | null
          forwarder_premium_enabled?: boolean
          forwarder_source_chat_id?: number | null
          forwarder_target_chat_ids?: number[]
          id?: string
          members_per_day?: number
          react_emojis?: string[]
          reactions_per_signal?: number
          room_id?: string
          updated_at?: string
          user_id?: string
          welcome_bot_enabled?: boolean
          welcome_image_mime?: string | null
          welcome_image_path?: string | null
          welcome_message?: string | null
          welcome_parse_mode?: string
          welcome_premium_account_id?: string | null
          welcome_premium_enabled?: boolean
          welcome_video_id?: string | null
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
      room_report_runs: {
        Row: {
          created_at: string
          id: string
          message_ids: Json
          report_key: string
          room_id: string
          user_id: string
          window_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_ids?: Json
          report_key: string
          room_id: string
          user_id: string
          window_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_ids?: Json
          report_key?: string
          room_id?: string
          user_id?: string
          window_id?: string
        }
        Relationships: []
      }
      room_reports: {
        Row: {
          created_at: string
          delay_minutes: number
          enabled: boolean
          id: string
          image_ext: string | null
          image_mime: string | null
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
          image_ext?: string | null
          image_mime?: string | null
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
          image_ext?: string | null
          image_mime?: string | null
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
          image_ext: string | null
          image_mime: string | null
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
          image_ext?: string | null
          image_mime?: string | null
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
          image_ext?: string | null
          image_mime?: string | null
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
          image_ext: string | null
          image_mime: string | null
          image_path: string | null
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
          image_ext?: string | null
          image_mime?: string | null
          image_path?: string | null
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
          image_ext?: string | null
          image_mime?: string | null
          image_path?: string | null
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
          last_session_fire: Json
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
          last_session_fire?: Json
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
          last_session_fire?: Json
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
          market_tips_categories: string[]
          market_tips_enabled: boolean
          market_tips_interval_hours: number
          market_tips_last_fire_at: string | null
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
          market_tips_categories?: string[]
          market_tips_enabled?: boolean
          market_tips_interval_hours?: number
          market_tips_last_fire_at?: string | null
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
          market_tips_categories?: string[]
          market_tips_enabled?: boolean
          market_tips_interval_hours?: number
          market_tips_last_fire_at?: string | null
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
      schedule_folders: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          account_id: string | null
          content: string | null
          created_at: string
          id: string
          is_premium: boolean
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
          is_premium?: boolean
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
          is_premium?: boolean
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
      signal_events: {
        Row: {
          asset_category: string | null
          asset_code: string
          close_price: number | null
          created_at: string
          direction: string
          entry_at: string
          entry_price: number | null
          expires_at: string
          gale_level: number
          id: string
          last_error: string | null
          max_gales: number
          result_message_ids: Json
          room_id: string
          signal_message_ids: Json
          status: Database["public"]["Enums"]["signal_event_status"]
          timeframe: string
          updated_at: string
          user_id: string
          window_id: string
        }
        Insert: {
          asset_category?: string | null
          asset_code: string
          close_price?: number | null
          created_at?: string
          direction: string
          entry_at: string
          entry_price?: number | null
          expires_at: string
          gale_level?: number
          id?: string
          last_error?: string | null
          max_gales?: number
          result_message_ids?: Json
          room_id: string
          signal_message_ids?: Json
          status?: Database["public"]["Enums"]["signal_event_status"]
          timeframe?: string
          updated_at?: string
          user_id: string
          window_id: string
        }
        Update: {
          asset_category?: string | null
          asset_code?: string
          close_price?: number | null
          created_at?: string
          direction?: string
          entry_at?: string
          entry_price?: number | null
          expires_at?: string
          gale_level?: number
          id?: string
          last_error?: string | null
          max_gales?: number
          result_message_ids?: Json
          room_id?: string
          signal_message_ids?: Json
          status?: Database["public"]["Enums"]["signal_event_status"]
          timeframe?: string
          updated_at?: string
          user_id?: string
          window_id?: string
        }
        Relationships: []
      }
      telegram_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          bot_first_name: string | null
          bot_token: string | null
          bot_username: string | null
          created_at: string
          daily_limit: number
          id: string
          is_active: boolean
          label: string
          last_check_at: string | null
          last_error: string | null
          member_tracking_enabled: boolean
          member_tracking_last_check: string | null
          member_tracking_last_error: string | null
          member_tracking_recovered_at: string | null
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          tg_api_hash: string | null
          tg_api_id: number | null
          tg_phone_code_hash: string | null
          tg_session: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          bot_first_name?: string | null
          bot_token?: string | null
          bot_username?: string | null
          created_at?: string
          daily_limit?: number
          id?: string
          is_active?: boolean
          label: string
          last_check_at?: string | null
          last_error?: string | null
          member_tracking_enabled?: boolean
          member_tracking_last_check?: string | null
          member_tracking_last_error?: string | null
          member_tracking_recovered_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tg_api_hash?: string | null
          tg_api_id?: number | null
          tg_phone_code_hash?: string | null
          tg_session?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          bot_first_name?: string | null
          bot_token?: string | null
          bot_username?: string | null
          created_at?: string
          daily_limit?: number
          id?: string
          is_active?: boolean
          label?: string
          last_check_at?: string | null
          last_error?: string | null
          member_tracking_enabled?: boolean
          member_tracking_last_check?: string | null
          member_tracking_last_error?: string | null
          member_tracking_recovered_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tg_api_hash?: string | null
          tg_api_id?: number | null
          tg_phone_code_hash?: string | null
          tg_session?: string | null
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
      telegram_member_events: {
        Row: {
          account_id: string
          chat_id: number
          chat_title: string | null
          created_at: string
          event_type: string
          id: string
          new_status: string | null
          occurred_at: string
          old_status: string | null
          tg_first_name: string | null
          tg_user_id: number
          tg_username: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          chat_id: number
          chat_title?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_status?: string | null
          occurred_at?: string
          old_status?: string | null
          tg_first_name?: string | null
          tg_user_id: number
          tg_username?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          chat_id?: number
          chat_title?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_status?: string | null
          occurred_at?: string
          old_status?: string | null
          tg_first_name?: string | null
          tg_user_id?: number
          tg_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tracking_clicks: {
        Row: {
          click_id: string
          clicked_offer_at: string | null
          created_at: string
          deposited_at: string | null
          external_id: string | null
          external_user_id: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gclid: string | null
          id: string
          ip: string | null
          joined_at: string | null
          kwai_click_id: string | null
          landing_url: string | null
          meta_events_sent: Json
          pixel_id: string
          referrer: string | null
          registered_at: string | null
          sale_currency: string | null
          sale_value: number | null
          tg_user_id: number | null
          tg_username: string | null
          ttclid: string | null
          user_agent: string | null
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          click_id: string
          clicked_offer_at?: string | null
          created_at?: string
          deposited_at?: string | null
          external_id?: string | null
          external_user_id?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          ip?: string | null
          joined_at?: string | null
          kwai_click_id?: string | null
          landing_url?: string | null
          meta_events_sent?: Json
          pixel_id: string
          referrer?: string | null
          registered_at?: string | null
          sale_currency?: string | null
          sale_value?: number | null
          tg_user_id?: number | null
          tg_username?: string | null
          ttclid?: string | null
          user_agent?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          click_id?: string
          clicked_offer_at?: string | null
          created_at?: string
          deposited_at?: string | null
          external_id?: string | null
          external_user_id?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          ip?: string | null
          joined_at?: string | null
          kwai_click_id?: string | null
          landing_url?: string | null
          meta_events_sent?: Json
          pixel_id?: string
          referrer?: string | null
          registered_at?: string | null
          sale_currency?: string | null
          sale_value?: number | null
          tg_user_id?: number | null
          tg_username?: string | null
          ttclid?: string | null
          user_agent?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_clicks_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "tracking_pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      tracking_integrations: {
        Row: {
          created_at: string
          custom_event_name: string | null
          event_type: string
          id: string
          is_active: boolean
          meta_currency: string | null
          meta_custom_event: string | null
          meta_value: number | null
          name: string
          pixel_id: string
          redirect_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_event_name?: string | null
          event_type: string
          id?: string
          is_active?: boolean
          meta_currency?: string | null
          meta_custom_event?: string | null
          meta_value?: number | null
          name: string
          pixel_id: string
          redirect_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_event_name?: string | null
          event_type?: string
          id?: string
          is_active?: boolean
          meta_currency?: string | null
          meta_custom_event?: string | null
          meta_value?: number | null
          name?: string
          pixel_id?: string
          redirect_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_integrations_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "tracking_pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_offers: {
        Row: {
          created_at: string
          default_currency: string
          default_event: string
          default_value: number | null
          destination_url: string
          id: string
          name: string
          pixel_id: string
          slug: string
          subid_param: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          default_event?: string
          default_value?: number | null
          destination_url: string
          id?: string
          name: string
          pixel_id: string
          slug: string
          subid_param?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          default_event?: string
          default_value?: number | null
          destination_url?: string
          id?: string
          name?: string
          pixel_id?: string
          slug?: string
          subid_param?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_offers_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "tracking_pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_pixels: {
        Row: {
          account_id: string | null
          bot_username: string | null
          created_at: string
          event_on_deposit: string
          event_on_join: string
          event_on_offer_click: string
          event_on_register: string
          id: string
          is_active: boolean
          meta_access_token: string | null
          meta_integration_id: string | null
          meta_pixel_id: string | null
          meta_test_event_code: string | null
          name: string
          postback_secret: string
          room_id: string | null
          updated_at: string
          user_id: string
          vertical: string
        }
        Insert: {
          account_id?: string | null
          bot_username?: string | null
          created_at?: string
          event_on_deposit?: string
          event_on_join?: string
          event_on_offer_click?: string
          event_on_register?: string
          id?: string
          is_active?: boolean
          meta_access_token?: string | null
          meta_integration_id?: string | null
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          name: string
          postback_secret?: string
          room_id?: string | null
          updated_at?: string
          user_id: string
          vertical?: string
        }
        Update: {
          account_id?: string | null
          bot_username?: string | null
          created_at?: string
          event_on_deposit?: string
          event_on_join?: string
          event_on_offer_click?: string
          event_on_register?: string
          id?: string
          is_active?: boolean
          meta_access_token?: string | null
          meta_integration_id?: string | null
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          name?: string
          postback_secret?: string
          room_id?: string | null
          updated_at?: string
          user_id?: string
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_pixels_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "telegram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_pixels_meta_integration_id_fkey"
            columns: ["meta_integration_id"]
            isOneToOne: false
            referencedRelation: "meta_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_pixels_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_postbacks: {
        Row: {
          created_at: string
          event: string
          id: string
          is_active: boolean
          name: string
          pixel_id: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          is_active?: boolean
          name: string
          pixel_id: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          is_active?: boolean
          name?: string
          pixel_id?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_postbacks_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "tracking_pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_engagement_subscriptions: {
        Row: {
          auto_dispatched_at: string | null
          bot_type: Database["public"]["Enums"]["engagement_bot_type"] | null
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
          target_link: string | null
          target_room_id: string | null
          units_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_dispatched_at?: string | null
          bot_type?: Database["public"]["Enums"]["engagement_bot_type"] | null
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
          target_link?: string | null
          target_room_id?: string | null
          units_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_dispatched_at?: string | null
          bot_type?: Database["public"]["Enums"]["engagement_bot_type"] | null
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
          target_link?: string | null
          target_room_id?: string | null
          units_used?: number
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
          {
            foreignKeyName: "user_engagement_subscriptions_target_room_id_fkey"
            columns: ["target_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
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
          kind: string
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
          kind?: string
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
          kind?: string
          mime_type?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      welcome_extra_messages: {
        Row: {
          content: string | null
          created_at: string
          delay_seconds: number
          id: string
          image_mime: string | null
          image_path: string | null
          parse_mode: string
          premium_account_id: string | null
          premium_enabled: boolean
          room_id: string
          sort_order: number
          updated_at: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          delay_seconds?: number
          id?: string
          image_mime?: string | null
          image_path?: string | null
          parse_mode?: string
          premium_account_id?: string | null
          premium_enabled?: boolean
          room_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          delay_seconds?: number
          id?: string
          image_mime?: string | null
          image_path?: string | null
          parse_mode?: string
          premium_account_id?: string | null
          premium_enabled?: boolean
          room_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          video_id?: string | null
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
      tracking_attribution: {
        Args: {
          _from: string
          _group_col: string
          _pixel_id: string
          _to: string
        }
        Returns: {
          clicks: number
          deposits: number
          dimension: string
          joins: number
          offer_clicks: number
          registers: number
          revenue: number
        }[]
      }
    }
    Enums: {
      account_status: "unknown" | "ok" | "error"
      account_type: "bot" | "premium"
      app_role: "admin" | "user"
      engagement_bot_type:
        | "inscritos"
        | "interacoes"
        | "boasvindas"
        | "encaminhador"
        | "salas"
        | "followup"
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
      signal_event_status:
        | "scheduled"
        | "sent"
        | "win"
        | "win_g1"
        | "win_g2"
        | "loss"
        | "error"
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
        | "gale"
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
      engagement_bot_type: [
        "inscritos",
        "interacoes",
        "boasvindas",
        "encaminhador",
        "salas",
        "followup",
      ],
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
      signal_event_status: [
        "scheduled",
        "sent",
        "win",
        "win_g1",
        "win_g2",
        "loss",
        "error",
      ],
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
        "gale",
      ],
    },
  },
} as const
