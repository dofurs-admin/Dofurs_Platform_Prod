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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_idempotency_keys: {
        Row: {
          actor_user_id: string | null
          created_at: string
          endpoint: string
          id: number
          idempotency_key: string
          request_payload: Json | null
          response_body: Json
          status_code: number
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          endpoint: string
          id?: number
          idempotency_key: string
          request_payload?: Json | null
          response_body: Json
          status_code: number
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          endpoint?: string
          id?: number
          idempotency_key?: string
          request_payload?: Json | null
          response_body?: Json
          status_code?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_rate_limit_windows: {
        Row: {
          key: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          key: string
          request_count?: number
          updated_at?: string
          window_started_at: string
        }
        Update: {
          key?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      automation_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          holder: string
          lock_key: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          holder: string
          lock_key: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          holder?: string
          lock_key?: string
        }
        Relationships: []
      }
      billing_automation_runs: {
        Row: {
          bucket: string
          channel: string
          created_at: string
          dry_run: boolean
          enforce_cadence: boolean
          enforce_cooldown: boolean
          error_message: string | null
          escalated: number
          finished_at: string | null
          id: string
          metadata: Json
          run_scope: string
          scanned: number
          sent: number
          skipped_cadence: number
          skipped_cooldown: number
          started_at: string
          status: string
          trigger_source: string
        }
        Insert: {
          bucket: string
          channel: string
          created_at?: string
          dry_run?: boolean
          enforce_cadence?: boolean
          enforce_cooldown?: boolean
          error_message?: string | null
          escalated?: number
          finished_at?: string | null
          id?: string
          metadata?: Json
          run_scope: string
          scanned?: number
          sent?: number
          skipped_cadence?: number
          skipped_cooldown?: number
          started_at?: string
          status: string
          trigger_source: string
        }
        Update: {
          bucket?: string
          channel?: string
          created_at?: string
          dry_run?: boolean
          enforce_cadence?: boolean
          enforce_cooldown?: boolean
          error_message?: string | null
          escalated?: number
          finished_at?: string | null
          id?: string
          metadata?: Json
          run_scope?: string
          scanned?: number
          sent?: number
          skipped_cadence?: number
          skipped_cooldown?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Relationships: []
      }
      billing_invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          item_type: string
          line_total_inr: number
          metadata: Json
          quantity: number
          unit_amount_inr: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          item_type: string
          line_total_inr: number
          metadata?: Json
          quantity?: number
          unit_amount_inr: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          item_type?: string
          line_total_inr?: number
          metadata?: Json
          quantity?: number
          unit_amount_inr?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          booking_id: number | null
          cgst_inr: number
          created_at: string
          discount_inr: number
          gst_invoice_number: string | null
          gstin: string | null
          hsn_sac_code: string | null
          id: string
          igst_inr: number
          invoice_number: string
          invoice_type: string
          issued_at: string | null
          metadata: Json
          paid_at: string | null
          payment_transaction_id: string | null
          sgst_inr: number
          status: string
          subtotal_inr: number
          tax_inr: number
          total_inr: number
          updated_at: string
          user_id: string
          user_subscription_id: string | null
        }
        Insert: {
          booking_id?: number | null
          cgst_inr?: number
          created_at?: string
          discount_inr?: number
          gst_invoice_number?: string | null
          gstin?: string | null
          hsn_sac_code?: string | null
          id?: string
          igst_inr?: number
          invoice_number: string
          invoice_type: string
          issued_at?: string | null
          metadata?: Json
          paid_at?: string | null
          payment_transaction_id?: string | null
          sgst_inr?: number
          status: string
          subtotal_inr: number
          tax_inr?: number
          total_inr: number
          updated_at?: string
          user_id: string
          user_subscription_id?: string | null
        }
        Update: {
          booking_id?: number | null
          cgst_inr?: number
          created_at?: string
          discount_inr?: number
          gst_invoice_number?: string | null
          gstin?: string | null
          hsn_sac_code?: string | null
          id?: string
          igst_inr?: number
          invoice_number?: string
          invoice_type?: string
          issued_at?: string | null
          metadata?: Json
          paid_at?: string | null
          payment_transaction_id?: string | null
          sgst_inr?: number
          status?: string
          subtotal_inr?: number
          tax_inr?: number
          total_inr?: number
          updated_at?: string
          user_id?: string
          user_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_user_subscription_id_fkey"
            columns: ["user_subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_adjustment_events: {
        Row: {
          actor_id: string | null
          adjustment_amount: number | null
          adjustment_type: string
          booking_id: number
          created_at: string
          id: string
          metadata: Json
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          adjustment_amount?: number | null
          adjustment_type?: string
          booking_id: number
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          adjustment_amount?: number | null
          adjustment_type?: string
          booking_id?: number
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_refund_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_admin_notes: {
        Row: {
          admin_user_id: string
          booking_id: number
          created_at: string
          id: string
          note: string
        }
        Insert: {
          admin_user_id: string
          booking_id: number
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          admin_user_id?: string
          booking_id?: number
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_admin_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payment_collections: {
        Row: {
          amount_inr: number
          booking_id: number
          collection_mode: string
          created_at: string
          id: string
          marked_paid_at: string | null
          marked_paid_by: string | null
          notes: string | null
          provider_id: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          booking_id: number
          collection_mode: string
          created_at?: string
          id?: string
          marked_paid_at?: string | null
          marked_paid_by?: string | null
          notes?: string | null
          provider_id?: number | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          booking_id?: number
          collection_mode?: string
          created_at?: string
          id?: string
          marked_paid_at?: string | null
          marked_paid_by?: string | null
          notes?: string | null
          provider_id?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payment_collections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_transition_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          booking_id: number
          cancellation_by: string | null
          created_at: string
          from_status: string
          id: string
          metadata: Json
          reason: string | null
          source: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          booking_id: number
          cancellation_by?: string | null
          created_at?: string
          from_status: string
          id?: string
          metadata?: Json
          reason?: string | null
          source?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          booking_id?: number
          cancellation_by?: string | null
          created_at?: string
          from_status?: string
          id?: string
          metadata?: Json
          reason?: string | null
          source?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_transition_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_subscription_credit_links: {
        Row: {
          booking_id: number
          created_at: string
          id: string
          service_type: string
          status: string
          updated_at: string
          user_id: string
          user_subscription_id: string
        }
        Insert: {
          booking_id: number
          created_at?: string
          id?: string
          service_type: string
          status: string
          updated_at?: string
          user_id: string
          user_subscription_id: string
        }
        Update: {
          booking_id?: number
          created_at?: string
          id?: string
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string
          user_subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_subscription_credit_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_subscription_credit_links_user_subscription_id_fkey"
            columns: ["user_subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_price_reference: number
          amount: number
          booking_date: string
          booking_end: string
          booking_mode: string
          booking_start: string
          booking_status: string
          cancellation_by: string | null
          cancellation_reason: string | null
          created_at: string
          discount_amount: number
          discount_code: string | null
          end_time: string
          final_price: number | null
          id: number
          internal_notes: string | null
          latitude: number | null
          location_address: string | null
          longitude: number | null
          package_id: string | null
          payment_mode: string | null
          pet_id: number
          platform_fee: number | null
          price_at_booking: number
          provider_id: number
          provider_notes: string | null
          provider_payout_status: string | null
          provider_service_id: string | null
          service_id: number
          service_type: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_price_reference?: number
          amount: number
          booking_date: string
          booking_end: string
          booking_mode?: string
          booking_start: string
          booking_status?: string
          cancellation_by?: string | null
          cancellation_reason?: string | null
          created_at?: string
          discount_amount?: number
          discount_code?: string | null
          end_time: string
          final_price?: number | null
          id?: number
          internal_notes?: string | null
          latitude?: number | null
          location_address?: string | null
          longitude?: number | null
          package_id?: string | null
          payment_mode?: string | null
          pet_id: number
          platform_fee?: number | null
          price_at_booking?: number
          provider_id: number
          provider_notes?: string | null
          provider_payout_status?: string | null
          provider_service_id?: string | null
          service_id: number
          service_type?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_price_reference?: number
          amount?: number
          booking_date?: string
          booking_end?: string
          booking_mode?: string
          booking_start?: string
          booking_status?: string
          cancellation_by?: string | null
          cancellation_reason?: string | null
          created_at?: string
          discount_amount?: number
          discount_code?: string | null
          end_time?: string
          final_price?: number | null
          id?: number
          internal_notes?: string | null
          latitude?: number | null
          location_address?: string | null
          longitude?: number | null
          package_id?: string | null
          payment_mode?: string | null
          pet_id?: number
          platform_fee?: number | null
          price_at_booking?: number
          provider_id?: number
          provider_notes?: string | null
          provider_payout_status?: string | null
          provider_service_id?: string | null
          service_id?: number
          service_type?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_service_id_fkey"
            columns: ["provider_service_id"]
            isOneToOne: false
            referencedRelation: "provider_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_usage_events: {
        Row: {
          booking_credit_link_id: string
          booking_id: number
          created_at: string
          event_type: string
          id: string
          notes: string | null
          service_type: string
          user_id: string
          user_subscription_id: string
        }
        Insert: {
          booking_credit_link_id: string
          booking_id: number
          created_at?: string
          event_type: string
          id?: string
          notes?: string | null
          service_type: string
          user_id: string
          user_subscription_id: string
        }
        Update: {
          booking_credit_link_id?: string
          booking_id?: number
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
          service_type?: string
          user_id?: string
          user_subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_events_booking_credit_link_id_fkey"
            columns: ["booking_credit_link_id"]
            isOneToOne: false
            referencedRelation: "booking_subscription_credit_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_usage_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_usage_events_user_subscription_id_fkey"
            columns: ["user_subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_redemptions: {
        Row: {
          booking_id: number | null
          created_at: string
          discount_amount: number
          discount_id: string
          id: string
          reversal_reason: string | null
          reversed_at: string | null
          user_id: string | null
        }
        Insert: {
          booking_id?: number | null
          created_at?: string
          discount_amount: number
          discount_id: string
          id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: number | null
          created_at?: string
          discount_amount?: number
          discount_id?: string
          id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "platform_discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_profile_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_profile_audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      package_services: {
        Row: {
          created_at: string
          id: string
          is_optional: boolean
          package_id: string
          provider_service_id: string
          sequence_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_optional?: boolean
          package_id: string
          provider_service_id: string
          sequence_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_optional?: boolean
          package_id?: string
          provider_service_id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_services_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_services_provider_service_id_fkey"
            columns: ["provider_service_id"]
            isOneToOne: false
            referencedRelation: "provider_services"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_status: string | null
          event_type: string
          id: string
          payload: Json
          provider: string
          provider_event_id: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          event_status?: string | null
          event_type: string
          id?: string
          payload?: Json
          provider: string
          provider_event_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          event_status?: string | null
          event_type?: string
          id?: string
          payload?: Json
          provider?: string
          provider_event_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_inr: number
          booking_id: number | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          payment_order_id: string | null
          provider: string
          provider_payment_id: string | null
          provider_signature: string | null
          status: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          booking_id?: number | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          payment_order_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          provider_signature?: string | null
          status: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          booking_id?: number | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          payment_order_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          provider_signature?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "subscription_payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string | null
          signature: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
          signature?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
          signature?: string | null
        }
        Relationships: []
      }
      pet_emergency_info: {
        Row: {
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          pet_id: number
          preferred_vet_clinic: string | null
          preferred_vet_phone: string | null
        }
        Insert: {
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          pet_id: number
          preferred_vet_clinic?: string | null
          preferred_vet_phone?: string | null
        }
        Update: {
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          pet_id?: number
          preferred_vet_clinic?: string | null
          preferred_vet_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_emergency_info_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_feeding_info: {
        Row: {
          brand_name: string | null
          created_at: string
          feeding_schedule: string | null
          food_allergies: string | null
          food_type: string | null
          id: string
          pet_id: number
          special_diet_notes: string | null
          treats_allowed: boolean
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          feeding_schedule?: string | null
          food_allergies?: string | null
          food_type?: string | null
          id?: string
          pet_id: number
          special_diet_notes?: string | null
          treats_allowed?: boolean
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          feeding_schedule?: string | null
          food_allergies?: string | null
          food_type?: string | null
          id?: string
          pet_id?: number
          special_diet_notes?: string | null
          treats_allowed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pet_feeding_info_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_grooming_info: {
        Row: {
          coat_type: string | null
          created_at: string
          grooming_frequency: string | null
          id: string
          last_grooming_date: string | null
          matting_prone: boolean
          nail_trim_frequency: string | null
          pet_id: number
        }
        Insert: {
          coat_type?: string | null
          created_at?: string
          grooming_frequency?: string | null
          id?: string
          last_grooming_date?: string | null
          matting_prone?: boolean
          nail_trim_frequency?: string | null
          pet_id: number
        }
        Update: {
          coat_type?: string | null
          created_at?: string
          grooming_frequency?: string | null
          id?: string
          last_grooming_date?: string | null
          matting_prone?: boolean
          nail_trim_frequency?: string | null
          pet_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "pet_grooming_info_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_medical_records: {
        Row: {
          condition_name: string
          created_at: string
          diagnosis_date: string | null
          document_url: string | null
          id: string
          medications: string | null
          ongoing: boolean
          pet_id: number
          special_care_instructions: string | null
          vet_name: string | null
        }
        Insert: {
          condition_name: string
          created_at?: string
          diagnosis_date?: string | null
          document_url?: string | null
          id?: string
          medications?: string | null
          ongoing?: boolean
          pet_id: number
          special_care_instructions?: string | null
          vet_name?: string | null
        }
        Update: {
          condition_name?: string
          created_at?: string
          diagnosis_date?: string | null
          document_url?: string | null
          id?: string
          medications?: string | null
          ongoing?: boolean
          pet_id?: number
          special_care_instructions?: string | null
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_medical_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_passport_audit_events: {
        Row: {
          action: string
          created_at: string
          id: number
          metadata: Json
          pet_id: number
          step_index: number | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          metadata?: Json
          pet_id: number
          step_index?: number | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          metadata?: Json
          pet_id?: number
          step_index?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_passport_audit_events_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_reminder_preferences: {
        Row: {
          created_at: string
          days_ahead: number
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          days_ahead?: number
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          days_ahead?: number
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      pet_shares: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by_user_id: string
          invited_email: string
          owner_user_id: string
          pet_id: number
          revoked_at: string | null
          role: string
          shared_with_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by_user_id: string
          invited_email: string
          owner_user_id: string
          pet_id: number
          revoked_at?: string | null
          role?: string
          shared_with_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by_user_id?: string
          invited_email?: string
          owner_user_id?: string
          pet_id?: number
          revoked_at?: string | null
          role?: string
          shared_with_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_shares_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_vaccinations: {
        Row: {
          administered_date: string
          batch_number: string | null
          brand_name: string | null
          certificate_url: string | null
          clinic_name: string | null
          created_at: string
          dose_number: number | null
          id: string
          next_due_date: string | null
          pet_id: number
          reminder_enabled: boolean
          vaccine_name: string
          veterinarian_name: string | null
        }
        Insert: {
          administered_date: string
          batch_number?: string | null
          brand_name?: string | null
          certificate_url?: string | null
          clinic_name?: string | null
          created_at?: string
          dose_number?: number | null
          id?: string
          next_due_date?: string | null
          pet_id: number
          reminder_enabled?: boolean
          vaccine_name: string
          veterinarian_name?: string | null
        }
        Update: {
          administered_date?: string
          batch_number?: string | null
          brand_name?: string | null
          certificate_url?: string | null
          clinic_name?: string | null
          created_at?: string
          dose_number?: number | null
          id?: string
          next_due_date?: string | null
          pet_id?: number
          reminder_enabled?: boolean
          vaccine_name?: string
          veterinarian_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          age: number | null
          aggression_level:
            | Database["public"]["Enums"]["aggression_enum"]
            | null
          allergies: string | null
          bite_incidents_count: number
          breed: string | null
          color: string | null
          crate_trained: boolean
          created_at: string
          date_of_birth: string | null
          disability_details: string | null
          energy_level: string | null
          gender: string | null
          has_disability: boolean
          house_trained: boolean
          id: number
          is_bite_history: boolean
          leash_trained: boolean
          microchip_number: string | null
          name: string
          neutered_spayed: boolean
          photo_url: string | null
          separation_anxiety: boolean
          size_category: string | null
          social_with_cats: string | null
          social_with_children: string | null
          social_with_dogs: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          age?: number | null
          aggression_level?:
            | Database["public"]["Enums"]["aggression_enum"]
            | null
          allergies?: string | null
          bite_incidents_count?: number
          breed?: string | null
          color?: string | null
          crate_trained?: boolean
          created_at?: string
          date_of_birth?: string | null
          disability_details?: string | null
          energy_level?: string | null
          gender?: string | null
          has_disability?: boolean
          house_trained?: boolean
          id?: number
          is_bite_history?: boolean
          leash_trained?: boolean
          microchip_number?: string | null
          name: string
          neutered_spayed?: boolean
          photo_url?: string | null
          separation_anxiety?: boolean
          size_category?: string | null
          social_with_cats?: string | null
          social_with_children?: string | null
          social_with_dogs?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          age?: number | null
          aggression_level?:
            | Database["public"]["Enums"]["aggression_enum"]
            | null
          allergies?: string | null
          bite_incidents_count?: number
          breed?: string | null
          color?: string | null
          crate_trained?: boolean
          created_at?: string
          date_of_birth?: string | null
          disability_details?: string | null
          energy_level?: string | null
          gender?: string | null
          has_disability?: boolean
          house_trained?: boolean
          id?: number
          is_bite_history?: boolean
          leash_trained?: boolean
          microchip_number?: string | null
          name?: string
          neutered_spayed?: boolean
          photo_url?: string | null
          separation_anxiety?: boolean
          size_category?: string | null
          social_with_cats?: string | null
          social_with_children?: string | null
          social_with_dogs?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_discounts: {
        Row: {
          applies_to_service_type: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          first_booking_only: boolean
          id: string
          is_active: boolean
          max_discount_amount: number | null
          min_booking_amount: number | null
          title: string
          updated_at: string
          usage_limit_per_user: number | null
          usage_limit_total: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applies_to_service_type?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          first_booking_only?: boolean
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_booking_amount?: number | null
          title: string
          updated_at?: string
          usage_limit_per_user?: number | null
          usage_limit_total?: number | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          applies_to_service_type?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          first_booking_only?: boolean
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_booking_amount?: number | null
          title?: string
          updated_at?: string
          usage_limit_per_user?: number | null
          usage_limit_total?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_discounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          average_rating: number
          cancellation_rate: number
          created_at: string
          date_of_birth: string | null
          first_pet_owner: boolean
          flagged_count: number
          full_name: string
          gender: string | null
          government_id_type: string | null
          has_children: boolean
          has_other_pets: boolean
          id: string
          id_document_url: string | null
          is_email_verified: boolean
          is_phone_verified: boolean
          is_suspended: boolean
          kyc_status: string
          last_login_at: string | null
          late_cancellation_count: number
          lives_in: string | null
          no_show_count: number
          number_of_people_in_house: number | null
          phone_number: string
          profile_photo_url: string | null
          risk_score: number
          total_bookings: number
          total_pets: number
          updated_at: string
          years_of_pet_experience: number | null
        }
        Insert: {
          account_status?: string
          average_rating?: number
          cancellation_rate?: number
          created_at?: string
          date_of_birth?: string | null
          first_pet_owner?: boolean
          flagged_count?: number
          full_name: string
          gender?: string | null
          government_id_type?: string | null
          has_children?: boolean
          has_other_pets?: boolean
          id: string
          id_document_url?: string | null
          is_email_verified?: boolean
          is_phone_verified?: boolean
          is_suspended?: boolean
          kyc_status?: string
          last_login_at?: string | null
          late_cancellation_count?: number
          lives_in?: string | null
          no_show_count?: number
          number_of_people_in_house?: number | null
          phone_number: string
          profile_photo_url?: string | null
          risk_score?: number
          total_bookings?: number
          total_pets?: number
          updated_at?: string
          years_of_pet_experience?: number | null
        }
        Update: {
          account_status?: string
          average_rating?: number
          cancellation_rate?: number
          created_at?: string
          date_of_birth?: string | null
          first_pet_owner?: boolean
          flagged_count?: number
          full_name?: string
          gender?: string | null
          government_id_type?: string | null
          has_children?: boolean
          has_other_pets?: boolean
          id?: string
          id_document_url?: string | null
          is_email_verified?: boolean
          is_phone_verified?: boolean
          is_suspended?: boolean
          kyc_status?: string
          last_login_at?: string | null
          late_cancellation_count?: number
          lives_in?: string | null
          no_show_count?: number
          number_of_people_in_house?: number | null
          phone_number?: string
          profile_photo_url?: string | null
          risk_score?: number
          total_bookings?: number
          total_pets?: number
          updated_at?: string
          years_of_pet_experience?: number | null
        }
        Relationships: []
      }
      provider_admin_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          provider_id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          provider_id: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          provider_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_admin_audit_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_availability: {
        Row: {
          admin_locked: boolean
          buffer_time_minutes: number
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          provider_id: number
          set_by: string
          slot_duration_minutes: number
          start_time: string
        }
        Insert: {
          admin_locked?: boolean
          buffer_time_minutes?: number
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean
          provider_id: number
          set_by?: string
          slot_duration_minutes?: number
          start_time: string
        }
        Update: {
          admin_locked?: boolean
          buffer_time_minutes?: number
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          provider_id?: number
          set_by?: string
          slot_duration_minutes?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_blocked_dates: {
        Row: {
          block_end_time: string | null
          block_start_time: string | null
          blocked_date: string
          created_at: string
          id: string
          provider_id: number
          reason: string | null
        }
        Insert: {
          block_end_time?: string | null
          block_start_time?: string | null
          blocked_date: string
          created_at?: string
          id?: string
          provider_id: number
          reason?: string | null
        }
        Update: {
          block_end_time?: string | null
          block_start_time?: string | null
          blocked_date?: string
          created_at?: string
          id?: string
          provider_id?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_blocked_dates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_blocks: {
        Row: {
          block_end: string
          block_start: string
          created_at: string
          id: number
          note: string | null
          provider_id: number
        }
        Insert: {
          block_end: string
          block_start: string
          created_at?: string
          id?: number
          note?: string | null
          provider_id: number
        }
        Update: {
          block_end?: string
          block_start?: string
          created_at?: string
          id?: number
          note?: string | null
          provider_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_blocks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_booking_completion_tasks: {
        Row: {
          booking_id: number
          completed_at: string | null
          created_at: string
          due_at: string
          feedback_text: string | null
          id: string
          prompted_at: string | null
          provider_id: number
          task_status: string
          updated_at: string
        }
        Insert: {
          booking_id: number
          completed_at?: string | null
          created_at?: string
          due_at: string
          feedback_text?: string | null
          id?: string
          prompted_at?: string | null
          provider_id: number
          task_status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: number
          completed_at?: string | null
          created_at?: string
          due_at?: string
          feedback_text?: string | null
          id?: string
          prompted_at?: string | null
          provider_id?: number
          task_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_booking_completion_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_booking_completion_tasks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_clinic_details: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          emergency_services_available: boolean
          gst_number: string | null
          hospitalization_available: boolean
          id: string
          latitude: number | null
          longitude: number | null
          number_of_doctors: number | null
          operating_hours: Json | null
          pincode: string | null
          provider_id: number
          registration_number: string | null
          registration_verified: boolean
          state: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          emergency_services_available?: boolean
          gst_number?: string | null
          hospitalization_available?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          number_of_doctors?: number | null
          operating_hours?: Json | null
          pincode?: string | null
          provider_id: number
          registration_number?: string | null
          registration_verified?: boolean
          state?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          emergency_services_available?: boolean
          gst_number?: string | null
          hospitalization_available?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          number_of_doctors?: number | null
          operating_hours?: Json | null
          pincode?: string | null
          provider_id?: number
          registration_number?: string | null
          registration_verified?: boolean
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_clinic_details_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_documents: {
        Row: {
          created_at: string
          document_type: string | null
          document_url: string | null
          id: string
          provider_id: number
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          document_url?: string | null
          id?: string
          provider_id: number
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string | null
          document_url?: string | null
          id?: string
          provider_id?: number
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_professional_details: {
        Row: {
          created_at: string
          emergency_service_enabled: boolean
          equipment_details: string | null
          id: string
          insurance_document_url: string | null
          license_number: string | null
          license_verified: boolean
          provider_id: number
          specialization: string | null
          teleconsult_enabled: boolean
        }
        Insert: {
          created_at?: string
          emergency_service_enabled?: boolean
          equipment_details?: string | null
          id?: string
          insurance_document_url?: string | null
          license_number?: string | null
          license_verified?: boolean
          provider_id: number
          specialization?: string | null
          teleconsult_enabled?: boolean
        }
        Update: {
          created_at?: string
          emergency_service_enabled?: boolean
          equipment_details?: string | null
          id?: string
          insurance_document_url?: string | null
          license_number?: string | null
          license_verified?: boolean
          provider_id?: number
          specialization?: string | null
          teleconsult_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "provider_professional_details_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_review_response_history: {
        Row: {
          created_at: string
          id: string
          new_response: string
          previous_response: string | null
          provider_id: number
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_response: string
          previous_response?: string | null
          provider_id: number
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_response?: string
          previous_response?: string | null
          provider_id?: number
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_review_response_history_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_review_response_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "provider_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_reviews: {
        Row: {
          booking_id: number | null
          created_at: string
          id: string
          provider_id: number
          provider_response: string | null
          rating: number
          review_text: string | null
          user_id: string | null
        }
        Insert: {
          booking_id?: number | null
          created_at?: string
          id?: string
          provider_id: number
          provider_response?: string | null
          rating: number
          review_text?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: number | null
          created_at?: string
          id?: string
          provider_id?: number
          provider_response?: string | null
          rating?: number
          review_text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_service_pincodes: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          pincode: string
          provider_service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          pincode: string
          provider_service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          pincode?: string
          provider_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_service_pincodes_provider_service_id_fkey"
            columns: ["provider_service_id"]
            isOneToOne: false
            referencedRelation: "provider_services"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_services: {
        Row: {
          banner_image_url: string | null
          base_price: number
          category_id: string | null
          commission_percentage: number | null
          created_at: string
          display_order: number
          full_description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          provider_id: number | null
          requires_location: boolean
          requires_pet_details: boolean
          service_duration_minutes: number | null
          service_mode: string | null
          service_type: string
          short_description: string | null
          slug: string | null
          surge_price: number | null
          updated_at: string
        }
        Insert: {
          banner_image_url?: string | null
          base_price: number
          category_id?: string | null
          commission_percentage?: number | null
          created_at?: string
          display_order?: number
          full_description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          provider_id?: number | null
          requires_location?: boolean
          requires_pet_details?: boolean
          service_duration_minutes?: number | null
          service_mode?: string | null
          service_type: string
          short_description?: string | null
          slug?: string | null
          surge_price?: number | null
          updated_at?: string
        }
        Update: {
          banner_image_url?: string | null
          base_price?: number
          category_id?: string | null
          commission_percentage?: number | null
          created_at?: string
          display_order?: number
          full_description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          provider_id?: number | null
          requires_location?: boolean
          requires_pet_details?: boolean
          service_duration_minutes?: number | null
          service_mode?: string | null
          service_type?: string
          short_description?: string | null
          slug?: string | null
          surge_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          accepts_platform_payment: boolean
          account_status: string
          address: string
          admin_approval_status: string
          average_rating: number
          background_verified: boolean
          bio: string | null
          business_name: string | null
          cancellation_rate: number
          created_at: string
          email: string | null
          end_time: string
          id: number
          is_individual: boolean
          is_verified: boolean
          lat: number | null
          lng: number | null
          name: string
          no_show_count: number
          payout_details: Json | null
          payout_method_type: string | null
          performance_score: number
          phone_number: string | null
          profile_photo_url: string | null
          provider_type: string
          ranking_score: number
          service_radius_km: number | null
          start_time: string
          total_bookings: number
          type: string
          updated_at: string
          user_id: string | null
          verification_status: string
          working_days: string[]
          years_of_experience: number | null
        }
        Insert: {
          accepts_platform_payment?: boolean
          account_status?: string
          address: string
          admin_approval_status?: string
          average_rating?: number
          background_verified?: boolean
          bio?: string | null
          business_name?: string | null
          cancellation_rate?: number
          created_at?: string
          email?: string | null
          end_time: string
          id?: number
          is_individual?: boolean
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          no_show_count?: number
          payout_details?: Json | null
          payout_method_type?: string | null
          performance_score?: number
          phone_number?: string | null
          profile_photo_url?: string | null
          provider_type?: string
          ranking_score?: number
          service_radius_km?: number | null
          start_time: string
          total_bookings?: number
          type: string
          updated_at?: string
          user_id?: string | null
          verification_status?: string
          working_days?: string[]
          years_of_experience?: number | null
        }
        Update: {
          accepts_platform_payment?: boolean
          account_status?: string
          address?: string
          admin_approval_status?: string
          average_rating?: number
          background_verified?: boolean
          bio?: string | null
          business_name?: string | null
          cancellation_rate?: number
          created_at?: string
          email?: string | null
          end_time?: string
          id?: number
          is_individual?: boolean
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          no_show_count?: number
          payout_details?: Json | null
          payout_method_type?: string | null
          performance_score?: number
          phone_number?: string | null
          profile_photo_url?: string | null
          provider_type?: string
          ranking_score?: number
          service_radius_km?: number | null
          start_time?: string
          total_bookings?: number
          type?: string
          updated_at?: string
          user_id?: string | null
          verification_status?: string
          working_days?: string[]
          years_of_experience?: number | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: never
          name: string
        }
        Update: {
          id?: never
          name?: string
        }
        Relationships: []
      }
      service_addons: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          duration_minutes: number | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          provider_service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          provider_service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          provider_service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_addons_provider_service_id_fkey"
            columns: ["provider_service_id"]
            isOneToOne: false
            referencedRelation: "provider_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          banner_image_url: string | null
          created_at: string
          description: string | null
          display_order: number
          icon_url: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          banner_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          banner_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_packages: {
        Row: {
          banner_image_url: string | null
          category_id: string | null
          created_at: string
          discount_type: string | null
          discount_value: number | null
          display_order: number
          full_description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          short_description: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          banner_image_url?: string | null
          category_id?: string | null
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          display_order?: number
          full_description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          short_description?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          banner_image_url?: string | null
          category_id?: string | null
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          display_order?: number
          full_description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          short_description?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_provider_applications: {
        Row: {
          admin_notes: string | null
          city: string
          created_at: string
          email: string
          full_name: string
          id: string
          motivation: string | null
          phone_number: string
          portfolio_url: string | null
          provider_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_areas: string
          service_modes: string[]
          state: string
          status: string
          submitted_by_user_id: string | null
          updated_at: string
          years_of_experience: number
        }
        Insert: {
          admin_notes?: string | null
          city: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          motivation?: string | null
          phone_number: string
          portfolio_url?: string | null
          provider_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_areas: string
          service_modes?: string[]
          state: string
          status?: string
          submitted_by_user_id?: string | null
          updated_at?: string
          years_of_experience?: number
        }
        Update: {
          admin_notes?: string | null
          city?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          motivation?: string | null
          phone_number?: string
          portfolio_url?: string | null
          provider_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_areas?: string
          service_modes?: string[]
          state?: string
          status?: string
          submitted_by_user_id?: string | null
          updated_at?: string
          years_of_experience?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          buffer_minutes: number
          duration_minutes: number
          id: number
          name: string
          price: number
          provider_id: number
        }
        Insert: {
          buffer_minutes?: number
          duration_minutes: number
          id?: number
          name: string
          price: number
          provider_id: number
        }
        Update: {
          buffer_minutes?: number
          duration_minutes?: number
          id?: number
          name?: string
          price?: number
          provider_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payment_orders: {
        Row: {
          amount_inr: number
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          metadata: Json
          plan_id: string
          provider: string
          provider_order_id: string
          receipt: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          plan_id: string
          provider?: string
          provider_order_id: string
          receipt?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          plan_id?: string
          provider?: string
          provider_order_id?: string
          receipt?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payment_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_services: {
        Row: {
          created_at: string
          credit_count: number
          id: string
          plan_id: string
          service_type: string
        }
        Insert: {
          created_at?: string
          credit_count: number
          id?: string
          plan_id: string
          service_type: string
        }
        Update: {
          created_at?: string
          credit_count?: number
          id?: string
          plan_id?: string
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          metadata: Json
          name: string
          price_inr: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          duration_days: number
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          price_inr: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          price_inr?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          latitude: number | null
          location: unknown
          longitude: number | null
          pincode: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          city: string
          country: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          pincode: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          pincode?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_emergency_contacts: {
        Row: {
          contact_name: string
          created_at: string
          id: string
          is_primary: boolean
          phone_number: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          id?: string
          is_primary?: boolean
          phone_number: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          phone_number?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_emergency_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          billing_email: string | null
          communication_preference: string | null
          created_at: string
          id: string
          preferred_groomer_gender: string | null
          preferred_payment_method: string | null
          preferred_service_time: string | null
          preferred_upi_vpa: string | null
          special_instructions: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_email?: string | null
          communication_preference?: string | null
          created_at?: string
          id?: string
          preferred_groomer_gender?: string | null
          preferred_payment_method?: string | null
          preferred_service_time?: string | null
          preferred_upi_vpa?: string | null
          special_instructions?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_email?: string | null
          communication_preference?: string | null
          created_at?: string
          id?: string
          preferred_groomer_gender?: string | null
          preferred_payment_method?: string | null
          preferred_service_time?: string | null
          preferred_upi_vpa?: string | null
          special_instructions?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_service_credits: {
        Row: {
          available_credits: number
          consumed_credits: number
          created_at: string
          id: string
          service_type: string
          total_credits: number
          updated_at: string
          user_id: string
          user_subscription_id: string
        }
        Insert: {
          available_credits: number
          consumed_credits: number
          created_at?: string
          id?: string
          service_type: string
          total_credits: number
          updated_at?: string
          user_id: string
          user_subscription_id: string
        }
        Update: {
          available_credits?: number
          consumed_credits?: number
          created_at?: string
          id?: string
          service_type?: string
          total_credits?: number
          updated_at?: string
          user_id?: string
          user_subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_service_credits_user_subscription_id_fkey"
            columns: ["user_subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          activated_at: string | null
          cancelled_at: string | null
          created_at: string
          ends_at: string | null
          id: string
          metadata: Json
          payment_transaction_id: string | null
          plan_id: string
          starts_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          payment_transaction_id?: string | null
          plan_id: string
          starts_at?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          payment_transaction_id?: string | null
          plan_id?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          age: number | null
          created_at: string
          email: string | null
          gender: string | null
          id: string
          name: string | null
          phone: string
          photo_url: string | null
          role_id: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          created_at?: string
          email?: string | null
          gender?: string | null
          id: string
          name?: string | null
          phone: string
          photo_url?: string | null
          role_id: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          name?: string | null
          phone?: string
          photo_url?: string | null
          role_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      booking_refund_events: {
        Row: {
          actor_id: string | null
          booking_id: number | null
          created_at: string | null
          id: string | null
          metadata: Json | null
          reason: string | null
          refund_amount: number | null
        }
        Insert: {
          actor_id?: string | null
          booking_id?: number | null
          created_at?: string | null
          id?: string | null
          metadata?: Json | null
          reason?: string | null
          refund_amount?: number | null
        }
        Update: {
          actor_id?: string | null
          booking_id?: number | null
          created_at?: string | null
          id?: string | null
          metadata?: Json | null
          reason?: string | null
          refund_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_refund_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_search_bookings: {
        Args: { p_filter?: string; p_limit?: number; p_query?: string }
        Returns: {
          booking_date: string
          booking_mode: string
          booking_start: string
          booking_status: string
          completion_completed_at: string
          completion_due_at: string
          completion_task_status: string
          customer_email: string
          customer_name: string
          customer_phone: string
          end_time: string
          id: number
          provider_id: number
          provider_name: string
          service_type: string
          start_time: string
          status: string
          user_id: string
        }[]
      }
      booking_can_transition: {
        Args: { p_current_status: string; p_next_status: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_key: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: {
          limited: boolean
          remaining: number
          reset_at: string
        }[]
      }
      cleanup_billing_automation_runs: {
        Args: { retain_days?: number }
        Returns: number
      }
      create_booking: {
        Args: {
          p_amount: number
          p_booking_start: string
          p_payment_mode: string
          p_pet_id: number
          p_service_id: number
          p_user_id: string
        }
        Returns: {
          admin_price_reference: number
          amount: number
          booking_date: string
          booking_end: string
          booking_mode: string
          booking_start: string
          booking_status: string
          cancellation_by: string | null
          cancellation_reason: string | null
          created_at: string
          discount_amount: number
          discount_code: string | null
          end_time: string
          final_price: number | null
          id: number
          internal_notes: string | null
          latitude: number | null
          location_address: string | null
          longitude: number | null
          package_id: string | null
          payment_mode: string | null
          pet_id: number
          platform_fee: number | null
          price_at_booking: number
          provider_id: number
          provider_notes: string | null
          provider_payout_status: string | null
          provider_service_id: string | null
          service_id: number
          service_type: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking_atomic: {
        Args: {
          p_add_ons?: Json
          p_booking_date?: string
          p_booking_mode?: string
          p_booking_type?: string
          p_discount_code?: string
          p_latitude?: number
          p_location_address?: string
          p_longitude?: number
          p_package_id?: string
          p_payment_mode?: string
          p_pet_id: number
          p_provider_id: number
          p_provider_notes?: string
          p_provider_service_id?: string
          p_start_time?: string
          p_user_id: string
        }
        Returns: Database["public"]["CompositeTypes"]["booking_creation_response"]
        SetofOptions: {
          from: "*"
          to: "booking_creation_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking_transactional_v1: {
        Args: {
          p_add_ons?: Json
          p_booking_date?: string
          p_booking_mode?: string
          p_booking_type?: string
          p_discount_amount?: number
          p_discount_code?: string
          p_final_price?: number
          p_latitude?: number
          p_location_address?: string
          p_longitude?: number
          p_package_id?: string
          p_payment_mode?: string
          p_pet_id: number
          p_provider_id: number
          p_provider_notes?: string
          p_provider_service_id?: string
          p_start_time?: string
          p_user_id: string
        }
        Returns: {
          admin_price_reference: number
          amount: number
          booking_date: string
          booking_end: string
          booking_mode: string
          booking_start: string
          booking_status: string
          cancellation_by: string | null
          cancellation_reason: string | null
          created_at: string
          discount_amount: number
          discount_code: string | null
          end_time: string
          final_price: number | null
          id: number
          internal_notes: string | null
          latitude: number | null
          location_address: string | null
          longitude: number | null
          package_id: string | null
          payment_mode: string | null
          pet_id: number
          platform_fee: number | null
          price_at_booking: number
          provider_id: number
          provider_notes: string | null
          provider_payout_status: string | null
          provider_service_id: string | null
          service_id: number
          service_type: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking_v2: {
        Args: {
          p_booking_date: string
          p_booking_mode: string
          p_latitude?: number
          p_location_address?: string
          p_longitude?: number
          p_payment_mode?: string
          p_pet_id: number
          p_provider_id: number
          p_provider_notes?: string
          p_provider_service_id: string
          p_start_time: string
          p_user_id: string
        }
        Returns: {
          admin_price_reference: number
          amount: number
          booking_date: string
          booking_end: string
          booking_mode: string
          booking_start: string
          booking_status: string
          cancellation_by: string | null
          cancellation_reason: string | null
          created_at: string
          discount_amount: number
          discount_code: string | null
          end_time: string
          final_price: number | null
          id: number
          internal_notes: string | null
          latitude: number | null
          location_address: string | null
          longitude: number | null
          package_id: string | null
          payment_mode: string | null
          pet_id: number
          platform_fee: number | null
          price_at_booking: number
          provider_id: number
          provider_notes: string | null
          provider_payout_status: string | null
          provider_service_id: string | null
          service_id: number
          service_type: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_provider_id: { Args: never; Returns: number }
      current_role_name: { Args: never; Returns: string }
      expire_overdue_subscriptions: { Args: never; Returns: undefined }
      get_available_slots: {
        Args: {
          p_booking_date: string
          p_provider_id: number
          p_service_duration_minutes?: number
        }
        Returns: {
          end_time: string
          is_available: boolean
          start_time: string
        }[]
      }
      get_platform_schema_health: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_provider: { Args: never; Returns: boolean }
      is_provider_owner: { Args: { p_provider_id: number }; Returns: boolean }
      log_owner_profile_audit_event: {
        Args: {
          p_action: string
          p_actor_id?: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: undefined
      }
      recompute_owner_profile_metrics: {
        Args: { p_user_id?: string }
        Returns: number
      }
      recompute_provider_performance_scores: {
        Args: { p_provider_id?: number }
        Returns: number
      }
      release_automation_lock: {
        Args: { p_holder: string; p_lock_key: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      try_acquire_automation_lock: {
        Args: { p_holder: string; p_lock_key: string; p_ttl_seconds?: number }
        Returns: boolean
      }
    }
    Enums: {
      aggression_enum:
        | "friendly"
        | "docile"
        | "mild_aggression"
        | "aggressive"
        | "sometimes_nervous"
        | "nervous_but_manageable"
        | "not_sure"
        | "other"
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      provider_type_enum:
        | "groomer"
        | "veterinarian"
        | "clinic"
        | "trainer"
        | "walker"
        | "sitter"
        | "boarding_center"
        | "ambulance"
        | "retailer"
    }
    CompositeTypes: {
      booking_creation_response: {
        success: boolean | null
        booking_id: number | null
        user_id: string | null
        provider_id: number | null
        service_type: string | null
        booking_date: string | null
        start_time: string | null
        end_time: string | null
        booking_status: string | null
        base_price: number | null
        discount_code: string | null
        discount_amount: number | null
        add_on_total: number | null
        taxable_amount: number | null
        final_price: number | null
        payment_mode: string | null
        created_at: string | null
        error_code: string | null
        error_message: string | null
      }
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
      aggression_enum: [
        "friendly",
        "docile",
        "mild_aggression",
        "aggressive",
        "sometimes_nervous",
        "nervous_but_manageable",
        "not_sure",
        "other",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      provider_type_enum: [
        "groomer",
        "veterinarian",
        "clinic",
        "trainer",
        "walker",
        "sitter",
        "boarding_center",
        "ambulance",
        "retailer",
      ],
    },
  },
} as const
