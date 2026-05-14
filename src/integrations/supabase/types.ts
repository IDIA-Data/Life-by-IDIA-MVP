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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      aca_consent_artifacts: {
        Row: {
          created_at: string | null
          expires_at: string | null
          hash: string
          id: string
          metadata: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          hash: string
          id?: string
          metadata?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          hash?: string
          id?: string
          metadata?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      account_conversion_requests: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street1: string | null
          address_street2: string | null
          address_zip: string | null
          company_name: string
          contact_role: string
          created_at: string | null
          denial_cause: string | null
          denial_remediation: string | null
          denied_at: string | null
          denied_by: string | null
          document_paths: string[]
          ein: string | null
          entity_type: string | null
          id: string
          industry: string | null
          logo_path: string | null
          request_type: string | null
          status: string | null
          submodule_id: string | null
          updated_at: string | null
          user_id: string
          vertical_id: string | null
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street1?: string | null
          address_street2?: string | null
          address_zip?: string | null
          company_name: string
          contact_role: string
          created_at?: string | null
          denial_cause?: string | null
          denial_remediation?: string | null
          denied_at?: string | null
          denied_by?: string | null
          document_paths?: string[]
          ein?: string | null
          entity_type?: string | null
          id?: string
          industry?: string | null
          logo_path?: string | null
          request_type?: string | null
          status?: string | null
          submodule_id?: string | null
          updated_at?: string | null
          user_id: string
          vertical_id?: string | null
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street1?: string | null
          address_street2?: string | null
          address_zip?: string | null
          company_name?: string
          contact_role?: string
          created_at?: string | null
          denial_cause?: string | null
          denial_remediation?: string | null
          denied_at?: string | null
          denied_by?: string | null
          document_paths?: string[]
          ein?: string | null
          entity_type?: string | null
          id?: string
          industry?: string | null
          logo_path?: string | null
          request_type?: string | null
          status?: string | null
          submodule_id?: string | null
          updated_at?: string | null
          user_id?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_conversion_requests_submodule_id_fkey"
            columns: ["submodule_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_submodules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_conversion_requests_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_campaigns: {
        Row: {
          budget: number | null
          budget_allocation: number | null
          business_id: string
          campaign_name: string | null
          campaign_type: string | null
          commission_rate: number | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          metadata: Json | null
          name: string
          start_date: string | null
          status: string | null
          target_audience: Json | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          budget_allocation?: number | null
          business_id: string
          campaign_name?: string | null
          campaign_type?: string | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json | null
          name: string
          start_date?: string | null
          status?: string | null
          target_audience?: Json | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          budget_allocation?: number | null
          business_id?: string
          campaign_name?: string | null
          campaign_type?: string | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          start_date?: string | null
          status?: string | null
          target_audience?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_transactions: {
        Row: {
          amount: number
          business_id: string
          campaign_id: string | null
          commission_amount: number | null
          created_at: string
          creator_id: string | null
          customer_reference: string | null
          id: string
          metadata: Json | null
          status: string | null
          transaction_date: string | null
          transaction_type: string | null
          transaction_value: number | null
        }
        Insert: {
          amount?: number
          business_id: string
          campaign_id?: string | null
          commission_amount?: number | null
          created_at?: string
          creator_id?: string | null
          customer_reference?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          transaction_date?: string | null
          transaction_type?: string | null
          transaction_value?: number | null
        }
        Update: {
          amount?: number
          business_id?: string
          campaign_id?: string | null
          commission_amount?: number | null
          created_at?: string
          creator_id?: string | null
          customer_reference?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          transaction_date?: string | null
          transaction_type?: string | null
          transaction_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "affiliate_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          environment: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          environment?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          environment?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_metrics: {
        Row: {
          endpoint: string
          error_details: string | null
          id: string
          key_id: string | null
          latency_ms: number
          status_code: number
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          endpoint: string
          error_details?: string | null
          id?: string
          key_id?: string | null
          latency_ms: number
          status_code: number
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          endpoint?: string
          error_details?: string | null
          id?: string
          key_id?: string | null
          latency_ms?: number
          status_code?: number
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_metrics_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_campaign_performance: {
        Row: {
          business_id: string
          conversion_count: number | null
          created_at: string
          date: string
          engagement_duration_avg: number | null
          experience_id: string | null
          id: string
          metadata: Json | null
          revenue_attributed: number | null
          revenue_generated: number | null
          total_interactions: number | null
          unique_users: number | null
        }
        Insert: {
          business_id: string
          conversion_count?: number | null
          created_at?: string
          date?: string
          engagement_duration_avg?: number | null
          experience_id?: string | null
          id?: string
          metadata?: Json | null
          revenue_attributed?: number | null
          revenue_generated?: number | null
          total_interactions?: number | null
          unique_users?: number | null
        }
        Update: {
          business_id?: string
          conversion_count?: number | null
          created_at?: string
          date?: string
          engagement_duration_avg?: number | null
          experience_id?: string | null
          id?: string
          metadata?: Json | null
          revenue_attributed?: number | null
          revenue_generated?: number | null
          total_interactions?: number | null
          unique_users?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ar_campaign_performance_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "ar_experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_experiences: {
        Row: {
          business_id: string
          conversion_rate: number | null
          created_at: string
          description: string | null
          experience_type: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          revenue_attributed: number | null
          status: string | null
          title: string
          total_interactions: number | null
          total_views: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          conversion_rate?: number | null
          created_at?: string
          description?: string | null
          experience_type?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          revenue_attributed?: number | null
          status?: string | null
          title: string
          total_interactions?: number | null
          total_views?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          conversion_rate?: number | null
          created_at?: string
          description?: string | null
          experience_type?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          revenue_attributed?: number | null
          status?: string | null
          title?: string
          total_interactions?: number | null
          total_views?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ar_menu_items: {
        Row: {
          ar_model_type: string | null
          ar_model_url: string | null
          average_view_time_seconds: number | null
          business_id: string
          conversion_rate: number | null
          created_at: string | null
          experience_type: string | null
          id: string
          interaction_count: number | null
          is_active: boolean | null
          menu_item_id: string
          updated_at: string | null
        }
        Insert: {
          ar_model_type?: string | null
          ar_model_url?: string | null
          average_view_time_seconds?: number | null
          business_id: string
          conversion_rate?: number | null
          created_at?: string | null
          experience_type?: string | null
          id?: string
          interaction_count?: number | null
          is_active?: boolean | null
          menu_item_id: string
          updated_at?: string | null
        }
        Update: {
          ar_model_type?: string | null
          ar_model_url?: string | null
          average_view_time_seconds?: number | null
          business_id?: string
          conversion_rate?: number | null
          created_at?: string | null
          experience_type?: string | null
          id?: string
          interaction_count?: number | null
          is_active?: boolean | null
          menu_item_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ar_menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_placement_zones: {
        Row: {
          ar_experience_id: string | null
          business_id: string
          created_at: string | null
          geospatial_bounds: Json
          id: string
          is_active: boolean | null
          location_id: string | null
          placement_rules: Json | null
          zone_name: string
        }
        Insert: {
          ar_experience_id?: string | null
          business_id: string
          created_at?: string | null
          geospatial_bounds: Json
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          placement_rules?: Json | null
          zone_name: string
        }
        Update: {
          ar_experience_id?: string | null
          business_id?: string
          created_at?: string | null
          geospatial_bounds?: Json
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          placement_rules?: Json | null
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_placement_zones_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_placement_zones_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_user_interactions: {
        Row: {
          ar_experience_id: string | null
          created_at: string | null
          device_info: Json | null
          duration_seconds: number | null
          id: string
          interaction_data: Json
          interaction_type: string
          location_data: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          ar_experience_id?: string | null
          created_at?: string | null
          device_info?: Json | null
          duration_seconds?: number | null
          id?: string
          interaction_data: Json
          interaction_type: string
          location_data?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          ar_experience_id?: string | null
          created_at?: string | null
          device_info?: Json | null
          duration_seconds?: number | null
          id?: string
          interaction_data?: Json
          interaction_type?: string
          location_data?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bin_assignments: {
        Row: {
          created_at: string | null
          id: string
          inventory_item_id: string
          is_primary_location: boolean | null
          last_movement_date: string | null
          quantity: number
          reserved_quantity: number | null
          updated_at: string | null
          warehouse_bin_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_item_id: string
          is_primary_location?: boolean | null
          last_movement_date?: string | null
          quantity?: number
          reserved_quantity?: number | null
          updated_at?: string | null
          warehouse_bin_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_item_id?: string
          is_primary_location?: boolean | null
          last_movement_date?: string | null
          quantity?: number
          reserved_quantity?: number | null
          updated_at?: string | null
          warehouse_bin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bin_assignments_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bin_assignments_warehouse_bin_id_fkey"
            columns: ["warehouse_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_generation_logs: {
        Row: {
          bundle_id: string | null
          created_at: string | null
          data_source_count: number | null
          generation_type: string
          id: string
          processing_duration: string | null
          quality_metrics: Json | null
        }
        Insert: {
          bundle_id?: string | null
          created_at?: string | null
          data_source_count?: number | null
          generation_type: string
          id?: string
          processing_duration?: string | null
          quality_metrics?: Json | null
        }
        Update: {
          bundle_id?: string | null
          created_at?: string | null
          data_source_count?: number | null
          generation_type?: string
          id?: string
          processing_duration?: string | null
          quality_metrics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_generation_logs_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "marketplace_bundles"
            referencedColumns: ["bundle_id"]
          },
        ]
      }
      business_health_metrics: {
        Row: {
          business_id: string
          created_at: string | null
          customer_score: number | null
          id: string
          inventory_score: number | null
          labor_score: number | null
          location_id: string | null
          metric_date: string
          overall_bhi_score: number | null
          sales_score: number | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          customer_score?: number | null
          id?: string
          inventory_score?: number | null
          labor_score?: number | null
          location_id?: string | null
          metric_date: string
          overall_bhi_score?: number | null
          sales_score?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          customer_score?: number | null
          id?: string
          inventory_score?: number | null
          labor_score?: number | null
          location_id?: string | null
          metric_date?: string
          overall_bhi_score?: number | null
          sales_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_health_metrics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_health_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          business_id: string
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string
        }
        Insert: {
          business_id: string
          close_time?: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time?: string
        }
        Update: {
          business_id?: string
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string
        }
        Relationships: []
      }
      business_locations: {
        Row: {
          address: string
          business_id: string
          contact_email: string | null
          created_at: string | null
          facility_type: string | null
          id: string
          is_active: boolean | null
          last_health_check: string | null
          manager_name: string | null
          name: string
          operating_hours: Json | null
          phone: string | null
          pos_terminal_count: number | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          business_id: string
          contact_email?: string | null
          created_at?: string | null
          facility_type?: string | null
          id?: string
          is_active?: boolean | null
          last_health_check?: string | null
          manager_name?: string | null
          name: string
          operating_hours?: Json | null
          phone?: string | null
          pos_terminal_count?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          business_id?: string
          contact_email?: string | null
          created_at?: string | null
          facility_type?: string | null
          id?: string
          is_active?: boolean | null
          last_health_check?: string | null
          manager_name?: string | null
          name?: string
          operating_hours?: Json | null
          phone?: string | null
          pos_terminal_count?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_permits: {
        Row: {
          business_id: string
          created_at: string
          expiration_date: string
          id: string
          inspector_name: string | null
          is_valid: boolean
          location: string
          permit_number: string
          permit_type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          expiration_date: string
          id?: string
          inspector_name?: string | null
          is_valid?: boolean
          location: string
          permit_number: string
          permit_type: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          expiration_date?: string
          id?: string
          inspector_name?: string | null
          is_valid?: boolean
          location?: string
          permit_number?: string
          permit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_processing_queue: {
        Row: {
          business_id: string
          created_at: string | null
          data_category: string | null
          error_details: Json | null
          id: string
          processing_stage: string | null
          processing_status: string | null
          retry_count: number | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          data_category?: string | null
          error_details?: Json | null
          id?: string
          processing_stage?: string | null
          processing_status?: string | null
          retry_count?: number | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          data_category?: string | null
          error_details?: Json | null
          id?: string
          processing_stage?: string | null
          processing_status?: string | null
          retry_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      business_user_permissions: {
        Row: {
          business_user_id: string
          created_at: string | null
          id: string
          permission_key: string
          permission_value: boolean | null
          updated_at: string | null
        }
        Insert: {
          business_user_id: string
          created_at?: string | null
          id?: string
          permission_key: string
          permission_value?: boolean | null
          updated_at?: string | null
        }
        Update: {
          business_user_id?: string
          created_at?: string | null
          id?: string
          permission_key?: string
          permission_value?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_user_permissions_business_user_id_fkey"
            columns: ["business_user_id"]
            isOneToOne: false
            referencedRelation: "business_users"
            referencedColumns: ["id"]
          },
        ]
      }
      business_users: {
        Row: {
          accepted_at: string | null
          assigned_locations: string[] | null
          business_id: string
          created_at: string | null
          id: string
          invited_at: string | null
          is_active: boolean | null
          last_login: string | null
          notification_preferences: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_locations?: string[] | null
          business_id: string
          created_at?: string | null
          id?: string
          invited_at?: string | null
          is_active?: boolean | null
          last_login?: string | null
          notification_preferences?: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          assigned_locations?: string[] | null
          business_id?: string
          created_at?: string | null
          id?: string
          invited_at?: string | null
          is_active?: boolean | null
          last_login?: string | null
          notification_preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_wallets: {
        Row: {
          balance: number | null
          business_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          wallet_address: string
          wallet_type: string | null
        }
        Insert: {
          balance?: number | null
          business_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          wallet_address: string
          wallet_type?: string | null
        }
        Update: {
          balance?: number | null
          business_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          wallet_address?: string
          wallet_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_wallets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_health_score: number | null
          business_type: string
          city: string | null
          country: string | null
          created_at: string | null
          data_coop_enabled: boolean | null
          email: string | null
          entity_type: string | null
          franchise_parent_id: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          provisioning_code: string
          state: string | null
          street_address_1: string | null
          street_address_2: string | null
          submodule_id: string | null
          subscription_tier: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          business_health_score?: number | null
          business_type: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          data_coop_enabled?: boolean | null
          email?: string | null
          entity_type?: string | null
          franchise_parent_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          provisioning_code?: string
          state?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          submodule_id?: string | null
          subscription_tier?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          business_health_score?: number | null
          business_type?: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          data_coop_enabled?: boolean | null
          email?: string | null
          entity_type?: string | null
          franchise_parent_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          provisioning_code?: string
          state?: string | null
          street_address_1?: string | null
          street_address_2?: string | null
          submodule_id?: string | null
          subscription_tier?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_franchise_parent_id_fkey"
            columns: ["franchise_parent_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_submodule_id_fkey"
            columns: ["submodule_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_submodules"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_performance: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          location_id: string | null
          new_customers_acquired: number | null
          report_date: string | null
          revenue_generated: number | null
          total_discount_given: number | null
          usage_count: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          location_id?: string | null
          new_customers_acquired?: number | null
          report_date?: string | null
          revenue_generated?: number | null
          total_discount_given?: number | null
          usage_count?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          location_id?: string | null
          new_customers_acquired?: number | null
          report_date?: string | null
          revenue_generated?: number | null
          total_discount_given?: number | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_performance_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promotional_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_performance_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_applications: {
        Row: {
          aca_hash_key: string
          aca_payload: Json
          committee_id: string
          created_at: string | null
          id: string
          statement_of_competence: string
          status: string
          user_id: string
        }
        Insert: {
          aca_hash_key: string
          aca_payload: Json
          committee_id: string
          created_at?: string | null
          id?: string
          statement_of_competence: string
          status?: string
          user_id: string
        }
        Update: {
          aca_hash_key?: string
          aca_payload?: Json
          committee_id?: string
          created_at?: string | null
          id?: string
          statement_of_competence?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      community_pool_ledger: {
        Row: {
          id: string
          pool_type: string
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          pool_type: string
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          pool_type?: string
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      competitive_analysis: {
        Row: {
          analysis_date: string
          business_id: string
          business_value: number
          competitive_gap: number
          created_at: string | null
          id: string
          industry_average: number
          metric_category: string
          percentile_rank: number
          recommendations: Json | null
        }
        Insert: {
          analysis_date?: string
          business_id: string
          business_value: number
          competitive_gap: number
          created_at?: string | null
          id?: string
          industry_average: number
          metric_category: string
          percentile_rank: number
          recommendations?: Json | null
        }
        Update: {
          analysis_date?: string
          business_id?: string
          business_value?: number
          competitive_gap?: number
          created_at?: string | null
          id?: string
          industry_average?: number
          metric_category?: string
          percentile_rank?: number
          recommendations?: Json | null
        }
        Relationships: []
      }
      connection_ratings: {
        Row: {
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          stars: number
        }
        Insert: {
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          stars: number
        }
        Update: {
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          stars?: number
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          created_at: string | null
          creator_handle: string
          engagement_rate: number | null
          follower_count: number | null
          id: string
          performance_rating: number | null
          profile_metadata: Json | null
          specialty_categories: string[] | null
          total_earnings: number | null
          updated_at: string | null
          user_id: string
          verification_status: string | null
        }
        Insert: {
          created_at?: string | null
          creator_handle: string
          engagement_rate?: number | null
          follower_count?: number | null
          id?: string
          performance_rating?: number | null
          profile_metadata?: Json | null
          specialty_categories?: string[] | null
          total_earnings?: number | null
          updated_at?: string | null
          user_id: string
          verification_status?: string | null
        }
        Update: {
          created_at?: string | null
          creator_handle?: string
          engagement_rate?: number | null
          follower_count?: number | null
          id?: string
          performance_rating?: number | null
          profile_metadata?: Json | null
          specialty_categories?: string[] | null
          total_earnings?: number | null
          updated_at?: string | null
          user_id?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      cross_platform_insights: {
        Row: {
          analysis_period: Json
          business_health_impact: Json | null
          confidence_score: number | null
          created_at: string | null
          economic_indicators: Json | null
          geographic_region: string | null
          health_lifestyle_correlation: Json | null
          id: string
          insight_type: string
          sample_size: number | null
          updated_at: string | null
        }
        Insert: {
          analysis_period: Json
          business_health_impact?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          economic_indicators?: Json | null
          geographic_region?: string | null
          health_lifestyle_correlation?: Json | null
          id?: string
          insight_type: string
          sample_size?: number | null
          updated_at?: string | null
        }
        Update: {
          analysis_period?: Json
          business_health_impact?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          economic_indicators?: Json | null
          geographic_region?: string | null
          health_lifestyle_correlation?: Json | null
          id?: string
          insight_type?: string
          sample_size?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_analytics: {
        Row: {
          analysis_date: string | null
          average_spend: number | null
          business_id: string
          created_at: string | null
          customer_segment: string
          id: string
          last_visit_days: number | null
          lifetime_value: number | null
          total_visits: number | null
          visit_frequency: number | null
        }
        Insert: {
          analysis_date?: string | null
          average_spend?: number | null
          business_id: string
          created_at?: string | null
          customer_segment: string
          id?: string
          last_visit_days?: number | null
          lifetime_value?: number | null
          total_visits?: number | null
          visit_frequency?: number | null
        }
        Update: {
          analysis_date?: string | null
          average_spend?: number | null
          business_id?: string
          created_at?: string | null
          customer_segment?: string
          id?: string
          last_visit_days?: number | null
          lifetime_value?: number | null
          total_visits?: number | null
          visit_frequency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_analytics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_count_items: {
        Row: {
          counted_at: string | null
          counted_by: string | null
          counted_quantity: number | null
          created_at: string | null
          cycle_count_id: string
          expected_quantity: number
          id: string
          inventory_item_id: string
          notes: string | null
          reason_code: string | null
          status: string | null
          variance: number | null
          variance_value: number | null
          warehouse_bin_id: string | null
        }
        Insert: {
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string | null
          cycle_count_id: string
          expected_quantity: number
          id?: string
          inventory_item_id: string
          notes?: string | null
          reason_code?: string | null
          status?: string | null
          variance?: number | null
          variance_value?: number | null
          warehouse_bin_id?: string | null
        }
        Update: {
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string | null
          cycle_count_id?: string
          expected_quantity?: number
          id?: string
          inventory_item_id?: string
          notes?: string | null
          reason_code?: string | null
          status?: string | null
          variance?: number | null
          variance_value?: number | null
          warehouse_bin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_count_items_cycle_count_id_fkey"
            columns: ["cycle_count_id"]
            isOneToOne: false
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_items_warehouse_bin_id_fkey"
            columns: ["warehouse_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_counts: {
        Row: {
          accuracy_percentage: number | null
          assigned_to: string | null
          business_id: string
          completed_at: string | null
          count_number: string
          count_type: string
          created_at: string | null
          created_by: string | null
          discrepancies_found: number | null
          id: string
          items_counted: number | null
          location_id: string
          scheduled_date: string
          started_at: string | null
          status: string
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          accuracy_percentage?: number | null
          assigned_to?: string | null
          business_id: string
          completed_at?: string | null
          count_number: string
          count_type?: string
          created_at?: string | null
          created_by?: string | null
          discrepancies_found?: number | null
          id?: string
          items_counted?: number | null
          location_id: string
          scheduled_date: string
          started_at?: string | null
          status?: string
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          accuracy_percentage?: number | null
          assigned_to?: string | null
          business_id?: string
          completed_at?: string | null
          count_number?: string
          count_type?: string
          created_at?: string | null
          created_by?: string | null
          discrepancies_found?: number | null
          id?: string
          items_counted?: number | null
          location_id?: string
          scheduled_date?: string
          started_at?: string | null
          status?: string
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dao_hats: {
        Row: {
          created_at: string | null
          eligibility_status: string | null
          granted_at: string
          hat_type: string
          id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          eligibility_status?: string | null
          granted_at?: string
          hat_type: string
          id?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          eligibility_status?: string | null
          granted_at?: string
          hat_type?: string
          id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dao_msa_metrics: {
        Row: {
          current_value: number | null
          id: string
          measured_at: string | null
          sla_name: string
          status: string | null
          target_value: number | null
        }
        Insert: {
          current_value?: number | null
          id?: string
          measured_at?: string | null
          sla_name: string
          status?: string | null
          target_value?: number | null
        }
        Update: {
          current_value?: number | null
          id?: string
          measured_at?: string | null
          sla_name?: string
          status?: string | null
          target_value?: number | null
        }
        Relationships: []
      }
      dao_pending_actions: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          status: string | null
          timelock_expires_at: string
          title: string
          veto_count: number | null
          veto_threshold: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          status?: string | null
          timelock_expires_at: string
          title: string
          veto_count?: number | null
          veto_threshold?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          status?: string | null
          timelock_expires_at?: string
          title?: string
          veto_count?: number | null
          veto_threshold?: number | null
        }
        Relationships: []
      }
      dao_proposals: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          lifecycle_phase: string | null
          proposer_id: string | null
          quorum_threshold: number | null
          status: string | null
          title: string
          vote_type: string | null
          voting_modality: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          lifecycle_phase?: string | null
          proposer_id?: string | null
          quorum_threshold?: number | null
          status?: string | null
          title: string
          vote_type?: string | null
          voting_modality?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          lifecycle_phase?: string | null
          proposer_id?: string | null
          quorum_threshold?: number | null
          status?: string | null
          title?: string
          vote_type?: string | null
          voting_modality?: string | null
        }
        Relationships: []
      }
      dao_treasury_flows: {
        Row: {
          amount_usd: number
          asset: string
          counterparty_label: string | null
          direction: string
          id: string
          recorded_at: string | null
        }
        Insert: {
          amount_usd: number
          asset: string
          counterparty_label?: string | null
          direction: string
          id?: string
          recorded_at?: string | null
        }
        Update: {
          amount_usd?: number
          asset?: string
          counterparty_label?: string | null
          direction?: string
          id?: string
          recorded_at?: string | null
        }
        Relationships: []
      }
      dao_vetoes: {
        Row: {
          aca_hash_key: string
          aca_payload: Json
          action_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          aca_hash_key: string
          aca_payload: Json
          action_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          aca_hash_key?: string
          aca_payload?: Json
          action_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dao_vetoes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "dao_pending_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      dao_votes: {
        Row: {
          aca_hash_key: string | null
          aca_payload: Json | null
          created_at: string | null
          credits_spent: number
          id: string
          proposal_id: string | null
          user_id: string | null
          vote_weight: number
        }
        Insert: {
          aca_hash_key?: string | null
          aca_payload?: Json | null
          created_at?: string | null
          credits_spent: number
          id?: string
          proposal_id?: string | null
          user_id?: string | null
          vote_weight: number
        }
        Update: {
          aca_hash_key?: string | null
          aca_payload?: Json | null
          created_at?: string | null
          credits_spent?: number
          id?: string
          proposal_id?: string | null
          user_id?: string | null
          vote_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "dao_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "dao_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      data_connections: {
        Row: {
          access_token: string | null
          connection_name: string
          connection_type: string
          created_at: string
          id: string
          is_active: boolean | null
          last_successful_sync: string | null
          last_sync_at: string | null
          metadata: Json | null
          refresh_token: string | null
          sync_failure_count: number | null
          sync_status: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connection_name?: string
          connection_type: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_successful_sync?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          sync_failure_count?: number | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connection_name?: string
          connection_type?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_successful_sync?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          sync_failure_count?: number | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_lineage_index: {
        Row: {
          aca_hash_key: string
          created_at: string | null
          data_category: string | null
          source_table: string
        }
        Insert: {
          aca_hash_key: string
          created_at?: string | null
          data_category?: string | null
          source_table: string
        }
        Update: {
          aca_hash_key?: string
          created_at?: string | null
          data_category?: string | null
          source_table?: string
        }
        Relationships: []
      }
      data_sharing_preferences: {
        Row: {
          anonymization_level: string | null
          business_id: string
          category: string
          compensation_rate: number | null
          id: string
          sharing_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          anonymization_level?: string | null
          business_id: string
          category: string
          compensation_rate?: number | null
          id?: string
          sharing_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          anonymization_level?: string | null
          business_id?: string
          category?: string
          compensation_rate?: number | null
          id?: string
          sharing_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_sharing_preferences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          created_at: string | null
          encrypted_token: string | null
          id: string
          last_sync_at: string | null
          source_name: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_token?: string | null
          id?: string
          last_sync_at?: string | null
          source_name: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_token?: string | null
          id?: string
          last_sync_at?: string | null
          source_name?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      decentralized_community_pool: {
        Row: {
          created_at: string | null
          description: string | null
          fiat_amount: number
          id: string
          pool_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          fiat_amount?: number
          id?: string
          pool_type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          fiat_amount?: number
          id?: string
          pool_type?: string
        }
        Relationships: []
      }
      delt_transfers: {
        Row: {
          aca_hash: string
          action_type: string
          amount: number | null
          created_at: string | null
          credit_cost: number | null
          details: Json | null
          enterprise_id: string | null
          id: string
          payload_summary: string | null
          user_id: string | null
        }
        Insert: {
          aca_hash: string
          action_type: string
          amount?: number | null
          created_at?: string | null
          credit_cost?: number | null
          details?: Json | null
          enterprise_id?: string | null
          id?: string
          payload_summary?: string | null
          user_id?: string | null
        }
        Update: {
          aca_hash?: string
          action_type?: string
          amount?: number | null
          created_at?: string | null
          credit_cost?: number | null
          details?: Json | null
          enterprise_id?: string | null
          id?: string
          payload_summary?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delt_transfers_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
        ]
      }
      demographic_clusters: {
        Row: {
          behavior_patterns: Json
          cluster_name: string
          cluster_size: number | null
          confidence_score: number | null
          created_at: string | null
          demographic_profile: Json
          geographic_bounds: Json
          id: string
          updated_at: string | null
        }
        Insert: {
          behavior_patterns: Json
          cluster_name: string
          cluster_size?: number | null
          confidence_score?: number | null
          created_at?: string | null
          demographic_profile: Json
          geographic_bounds: Json
          id?: string
          updated_at?: string | null
        }
        Update: {
          behavior_patterns?: Json
          cluster_name?: string
          cluster_size?: number | null
          confidence_score?: number | null
          created_at?: string | null
          demographic_profile?: Json
          geographic_bounds?: Json
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      device_events: {
        Row: {
          anonymized_at: string | null
          beacon_id: string | null
          bundled_at: string | null
          data_category: string | null
          event_timestamp: string
          event_type: string
          id: number
          json_payload: Json
          processed_at: string | null
          processing_status: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          anonymized_at?: string | null
          beacon_id?: string | null
          bundled_at?: string | null
          data_category?: string | null
          event_timestamp?: string
          event_type: string
          id?: number
          json_payload: Json
          processed_at?: string | null
          processing_status?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          anonymized_at?: string | null
          beacon_id?: string | null
          bundled_at?: string | null
          data_category?: string | null
          event_timestamp?: string
          event_type?: string
          id?: number
          json_payload?: Json
          processed_at?: string | null
          processing_status?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      device_provisioning_blueprints: {
        Row: {
          business_id: string
          code: string
          created_at: string
          id: string
          label: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          code: string
          created_at?: string
          id?: string
          label?: string
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string
          id?: string
          label?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_provisioning_blueprints_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      digiramp_testnet_migration: {
        Row: {
          digiramp_id: string
          id: string
          last_sync_at: string | null
          mint_tx_hash: string | null
          platform_guid: string | null
          status: string | null
          testnet_address: string
          token_balance_minted: number | null
        }
        Insert: {
          digiramp_id: string
          id?: string
          last_sync_at?: string | null
          mint_tx_hash?: string | null
          platform_guid?: string | null
          status?: string | null
          testnet_address: string
          token_balance_minted?: number | null
        }
        Update: {
          digiramp_id?: string
          id?: string
          last_sync_at?: string | null
          mint_tx_hash?: string | null
          platform_guid?: string | null
          status?: string | null
          testnet_address?: string
          token_balance_minted?: number | null
        }
        Relationships: []
      }
      economic_impact_metrics: {
        Row: {
          business_id: string | null
          calculated_at: string | null
          comparison_period: Json
          confidence_interval: Json | null
          id: string
          location_id: string | null
          methodology: string | null
          metric_category: string
          metric_value: number
        }
        Insert: {
          business_id?: string | null
          calculated_at?: string | null
          comparison_period: Json
          confidence_interval?: Json | null
          id?: string
          location_id?: string | null
          methodology?: string | null
          metric_category: string
          metric_value: number
        }
        Update: {
          business_id?: string | null
          calculated_at?: string | null
          comparison_period?: Json
          confidence_interval?: Json | null
          id?: string
          location_id?: string | null
          methodology?: string | null
          metric_category?: string
          metric_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "economic_impact_metrics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economic_impact_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      egress_logs: {
        Row: {
          aca_record_ids: string[] | null
          aca_record_references: string[]
          batch_checksum: string | null
          bundle_id: string | null
          buyer_intent: string | null
          circle_idempotency_key: string | null
          client_id: string | null
          consumption_weight: number | null
          country_of_origin: string
          created_at: string
          data_payload_summary: Json | null
          data_points_count: number | null
          digiramp_anchor_id: string
          egress_type: string
          id: string
          informational_mass: number | null
          intent_type: string | null
          liability_token_hash: string | null
          manifest_hashes: string[] | null
          on_chain_status: string | null
          on_chain_tx_hash: string | null
          pseudo_user_id: string | null
          purchaser_id: string | null
          query_complexity: number | null
          settled_at: string | null
          settlement_status: string | null
          staged_data_ids: string[] | null
          status: string | null
          synapse_ledger_entry_id: string | null
          user_id: string
          verification_status: string | null
        }
        Insert: {
          aca_record_ids?: string[] | null
          aca_record_references?: string[]
          batch_checksum?: string | null
          bundle_id?: string | null
          buyer_intent?: string | null
          circle_idempotency_key?: string | null
          client_id?: string | null
          consumption_weight?: number | null
          country_of_origin?: string
          created_at?: string
          data_payload_summary?: Json | null
          data_points_count?: number | null
          digiramp_anchor_id: string
          egress_type?: string
          id?: string
          informational_mass?: number | null
          intent_type?: string | null
          liability_token_hash?: string | null
          manifest_hashes?: string[] | null
          on_chain_status?: string | null
          on_chain_tx_hash?: string | null
          pseudo_user_id?: string | null
          purchaser_id?: string | null
          query_complexity?: number | null
          settled_at?: string | null
          settlement_status?: string | null
          staged_data_ids?: string[] | null
          status?: string | null
          synapse_ledger_entry_id?: string | null
          user_id: string
          verification_status?: string | null
        }
        Update: {
          aca_record_ids?: string[] | null
          aca_record_references?: string[]
          batch_checksum?: string | null
          bundle_id?: string | null
          buyer_intent?: string | null
          circle_idempotency_key?: string | null
          client_id?: string | null
          consumption_weight?: number | null
          country_of_origin?: string
          created_at?: string
          data_payload_summary?: Json | null
          data_points_count?: number | null
          digiramp_anchor_id?: string
          egress_type?: string
          id?: string
          informational_mass?: number | null
          intent_type?: string | null
          liability_token_hash?: string | null
          manifest_hashes?: string[] | null
          on_chain_status?: string | null
          on_chain_tx_hash?: string | null
          pseudo_user_id?: string | null
          purchaser_id?: string | null
          query_complexity?: number | null
          settled_at?: string | null
          settlement_status?: string | null
          staged_data_ids?: string[] | null
          status?: string | null
          synapse_ledger_entry_id?: string | null
          user_id?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      employee_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          location_id: string
          notes: string | null
          role_assignment: string | null
          shift_end: string
          shift_start: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          location_id: string
          notes?: string | null
          role_assignment?: string | null
          shift_end: string
          shift_start: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          location_id?: string
          notes?: string | null
          role_assignment?: string | null
          shift_end?: string
          shift_start?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "business_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shift_schedules: {
        Row: {
          break_minutes: number | null
          business_id: string
          created_at: string
          end_time: string
          id: string
          location: string | null
          notes: string | null
          schedule_date: string
          start_time: string
          status: string
          team_member_id: string
        }
        Insert: {
          break_minutes?: number | null
          business_id: string
          created_at?: string
          end_time: string
          id?: string
          location?: string | null
          notes?: string | null
          schedule_date: string
          start_time: string
          status?: string
          team_member_id: string
        }
        Update: {
          break_minutes?: number | null
          business_id?: string
          created_at?: string
          end_time?: string
          id?: string
          location?: string | null
          notes?: string | null
          schedule_date?: string
          start_time?: string
          status?: string
          team_member_id?: string
        }
        Relationships: []
      }
      employee_time_entries: {
        Row: {
          break_minutes: number | null
          business_id: string
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          location: string | null
          notes: string | null
          overtime_hours: number | null
          status: string
          team_member_id: string
          total_hours: number | null
        }
        Insert: {
          break_minutes?: number | null
          business_id: string
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          overtime_hours?: number | null
          status?: string
          team_member_id: string
          total_hours?: number | null
        }
        Update: {
          break_minutes?: number | null
          business_id?: string
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          overtime_hours?: number | null
          status?: string
          team_member_id?: string
          total_hours?: number | null
        }
        Relationships: []
      }
      employee_timesheets: {
        Row: {
          approval_status: string | null
          approved_by: string | null
          break_minutes: number | null
          clock_in: string
          clock_in_method: string | null
          clock_out: string | null
          clock_out_method: string | null
          created_at: string | null
          employee_id: string
          hourly_rate: number | null
          id: string
          location_id: string
          notes: string | null
          overtime_hours: number | null
          overtime_rate: number | null
          total_hours: number | null
          updated_at: string | null
        }
        Insert: {
          approval_status?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          clock_in: string
          clock_in_method?: string | null
          clock_out?: string | null
          clock_out_method?: string | null
          created_at?: string | null
          employee_id: string
          hourly_rate?: number | null
          id?: string
          location_id: string
          notes?: string | null
          overtime_hours?: number | null
          overtime_rate?: number | null
          total_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          approval_status?: string | null
          approved_by?: string | null
          break_minutes?: number | null
          clock_in?: string
          clock_in_method?: string | null
          clock_out?: string | null
          clock_out_method?: string | null
          created_at?: string | null
          employee_id?: string
          hourly_rate?: number | null
          id?: string
          location_id?: string
          notes?: string | null
          overtime_hours?: number | null
          overtime_rate?: number | null
          total_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_timesheets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          aca_secured: boolean
          address: string | null
          assigned_locations: string[] | null
          business_id: string
          city: string | null
          created_at: string
          direct_deposit_enabled: boolean | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          is_ephemeral: boolean
          job_title: string | null
          last_login: string | null
          name: string
          notes: string | null
          overtime_rate: number | null
          pay_frequency: string | null
          permission_template_id: string | null
          permissions: Json | null
          phone: string | null
          platform_role: string
          role: string
          salary_type: string | null
          state: string | null
          status: string
          tax_filing_status: string | null
          updated_at: string
          user_id: string | null
          zip: string | null
        }
        Insert: {
          aca_secured?: boolean
          address?: string | null
          assigned_locations?: string[] | null
          business_id: string
          city?: string | null
          created_at?: string
          direct_deposit_enabled?: boolean | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_ephemeral?: boolean
          job_title?: string | null
          last_login?: string | null
          name: string
          notes?: string | null
          overtime_rate?: number | null
          pay_frequency?: string | null
          permission_template_id?: string | null
          permissions?: Json | null
          phone?: string | null
          platform_role?: string
          role?: string
          salary_type?: string | null
          state?: string | null
          status?: string
          tax_filing_status?: string | null
          updated_at?: string
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          aca_secured?: boolean
          address?: string | null
          assigned_locations?: string[] | null
          business_id?: string
          city?: string | null
          created_at?: string
          direct_deposit_enabled?: boolean | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_ephemeral?: boolean
          job_title?: string | null
          last_login?: string | null
          name?: string
          notes?: string | null
          overtime_rate?: number | null
          pay_frequency?: string | null
          permission_template_id?: string | null
          permissions?: Json | null
          phone?: string | null
          platform_role?: string
          role?: string
          salary_type?: string | null
          state?: string | null
          status?: string
          tax_filing_status?: string | null
          updated_at?: string
          user_id?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      endorsements: {
        Row: {
          created_at: string | null
          endorsee_id: string
          endorser_id: string
          id: string
          message: string | null
          skill_text: string
        }
        Insert: {
          created_at?: string | null
          endorsee_id: string
          endorser_id: string
          id?: string
          message?: string | null
          skill_text: string
        }
        Update: {
          created_at?: string | null
          endorsee_id?: string
          endorser_id?: string
          id?: string
          message?: string | null
          skill_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "endorsements_endorsee_id_fkey"
            columns: ["endorsee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "endorsements_endorser_id_fkey"
            columns: ["endorser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      enterprises: {
        Row: {
          available_credits: number | null
          created_at: string | null
          id: string
          industry: string | null
          kyb_status: string | null
          name: string
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          available_credits?: number | null
          created_at?: string | null
          id?: string
          industry?: string | null
          kyb_status?: string | null
          name: string
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          available_credits?: number | null
          created_at?: string | null
          id?: string
          industry?: string | null
          kyb_status?: string | null
          name?: string
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      facility_assignments: {
        Row: {
          assigned_at: string | null
          facility_id: string
          id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          facility_id: string
          id?: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          facility_id?: string
          id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_feeds: {
        Row: {
          description: string | null
          id: string
          latency: string | null
          name: string
          status: string | null
          subscribers: number | null
          topic: string
        }
        Insert: {
          description?: string | null
          id?: string
          latency?: string | null
          name: string
          status?: string | null
          subscribers?: number | null
          topic: string
        }
        Update: {
          description?: string | null
          id?: string
          latency?: string | null
          name?: string
          status?: string | null
          subscribers?: number | null
          topic?: string
        }
        Relationships: []
      }
      fiat_ledger: {
        Row: {
          amount: number | null
          amount_usd: number
          balance_after: number | null
          balance_fiat_usd: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          source: string | null
          status: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          amount_usd: number
          balance_after?: number | null
          balance_fiat_usd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          source?: string | null
          status?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number | null
          amount_usd?: number
          balance_after?: number | null
          balance_fiat_usd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          source?: string | null
          status?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_event_log: {
        Row: {
          correlation_id: string
          created_at: string | null
          event_id: string
          event_type: string
          operator_id: string
          payload: Json
        }
        Insert: {
          correlation_id: string
          created_at?: string | null
          event_id?: string
          event_type: string
          operator_id?: string
          payload: Json
        }
        Update: {
          correlation_id?: string
          created_at?: string | null
          event_id?: string
          event_type?: string
          operator_id?: string
          payload?: Json
        }
        Relationships: []
      }
      franchise_agreements: {
        Row: {
          agreement_end_date: string | null
          agreement_start_date: string
          created_at: string | null
          franchisee_business_id: string
          franchisor_business_id: string
          id: string
          marketing_fee_percentage: number | null
          royalty_percentage: number
          status: string | null
          territory_description: string | null
        }
        Insert: {
          agreement_end_date?: string | null
          agreement_start_date: string
          created_at?: string | null
          franchisee_business_id: string
          franchisor_business_id: string
          id?: string
          marketing_fee_percentage?: number | null
          royalty_percentage: number
          status?: string | null
          territory_description?: string | null
        }
        Update: {
          agreement_end_date?: string | null
          agreement_start_date?: string
          created_at?: string | null
          franchisee_business_id?: string
          franchisor_business_id?: string
          id?: string
          marketing_fee_percentage?: number | null
          royalty_percentage?: number
          status?: string | null
          territory_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "franchise_agreements_franchisee_business_id_fkey"
            columns: ["franchisee_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchise_agreements_franchisor_business_id_fkey"
            columns: ["franchisor_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          status: string | null
          user_id_1: string
          user_id_2: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          user_id_1: string
          user_id_2: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          user_id_1?: string
          user_id_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_user_id_1_fkey"
            columns: ["user_id_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friends_user_id_2_fkey"
            columns: ["user_id_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      geospatial_analytics: {
        Row: {
          analysis_period: Json
          analysis_type: string
          created_at: string | null
          geographic_bounds: Json
          id: string
          results: Json
          updated_at: string | null
        }
        Insert: {
          analysis_period: Json
          analysis_type: string
          created_at?: string | null
          geographic_bounds: Json
          id?: string
          results: Json
          updated_at?: string | null
        }
        Update: {
          analysis_period?: Json
          analysis_type?: string
          created_at?: string | null
          geographic_bounds?: Json
          id?: string
          results?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      gift_card_redemptions: {
        Row: {
          amount_redeemed: number
          gift_card_id: string
          id: string
          location_id: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          remaining_balance: number
          transaction_id: string | null
        }
        Insert: {
          amount_redeemed: number
          gift_card_id: string
          id?: string
          location_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          remaining_balance: number
          transaction_id?: string | null
        }
        Update: {
          amount_redeemed?: number
          gift_card_id?: string
          id?: string
          location_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          remaining_balance?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_redemptions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_redemptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_redemptions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_transactions: {
        Row: {
          amount: number
          created_at: string | null
          gift_card_id: string
          id: string
          location_id: string | null
          pos_transaction_id: string | null
          processed_by: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          gift_card_id: string
          id?: string
          location_id?: string | null
          pos_transaction_id?: string | null
          processed_by?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          gift_card_id?: string
          id?: string
          location_id?: string | null
          pos_transaction_id?: string | null
          processed_by?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          activation_code: string | null
          business_id: string
          card_code: string
          created_at: string | null
          current_balance: number
          customer_email: string | null
          expires_at: string | null
          id: string
          initial_amount: number
          is_active: boolean | null
          issued_by: string | null
          last_used_at: string | null
          message: string | null
          pin_code: string | null
          purchase_transaction_id: string | null
          purchaser_email: string | null
          qr_code_data: string | null
          recipient_email: string | null
          redemption_locations: Json | null
          terms_accepted: boolean | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          activation_code?: string | null
          business_id: string
          card_code: string
          created_at?: string | null
          current_balance: number
          customer_email?: string | null
          expires_at?: string | null
          id?: string
          initial_amount: number
          is_active?: boolean | null
          issued_by?: string | null
          last_used_at?: string | null
          message?: string | null
          pin_code?: string | null
          purchase_transaction_id?: string | null
          purchaser_email?: string | null
          qr_code_data?: string | null
          recipient_email?: string | null
          redemption_locations?: Json | null
          terms_accepted?: boolean | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          activation_code?: string | null
          business_id?: string
          card_code?: string
          created_at?: string | null
          current_balance?: number
          customer_email?: string | null
          expires_at?: string | null
          id?: string
          initial_amount?: number
          is_active?: boolean | null
          issued_by?: string | null
          last_used_at?: string | null
          message?: string | null
          pin_code?: string | null
          purchase_transaction_id?: string | null
          purchaser_email?: string | null
          qr_code_data?: string | null
          recipient_email?: string | null
          redemption_locations?: Json | null
          terms_accepted?: boolean | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      good_deeds: {
        Row: {
          created_at: string | null
          description: string
          evidence_url: string | null
          id: string
          title: string
          user_id: string
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          evidence_url?: string | null
          id?: string
          title: string
          user_id: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          evidence_url?: string | null
          id?: string
          title?: string
          user_id?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "good_deeds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "good_deeds_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      governance_ledger: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          on_chain_tx_hash: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          on_chain_tx_hash?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          on_chain_tx_hash?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      health_metrics: {
        Row: {
          activity_type: string
          calories_burned: number | null
          created_at: string | null
          device_type: string | null
          distance_meters: number | null
          duration_seconds: number | null
          heart_rate: number | null
          id: string
          raw_data: Json | null
          recorded_at: string | null
          step_count: number | null
          user_id: string | null
        }
        Insert: {
          activity_type?: string
          calories_burned?: number | null
          created_at?: string | null
          device_type?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          heart_rate?: number | null
          id?: string
          raw_data?: Json | null
          recorded_at?: string | null
          step_count?: number | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          calories_burned?: number | null
          created_at?: string | null
          device_type?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          heart_rate?: number | null
          id?: string
          raw_data?: Json | null
          recorded_at?: string | null
          step_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      hri_baselines: {
        Row: {
          mean_value: number | null
          metric_type: string
          sample_size: number | null
          std_dev: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          mean_value?: number | null
          metric_type: string
          sample_size?: number | null
          std_dev?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          mean_value?: number | null
          metric_type?: string
          sample_size?: number | null
          std_dev?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hri_scores: {
        Row: {
          alpha_score: string | null
          created_at: string | null
          hrv_score: number | null
          id: string
          is_ghost_protocol: boolean | null
          rt_score: number | null
          sleep_score: number | null
          total_score: number | null
          user_id: string | null
          vitals_snapshot: Json | null
        }
        Insert: {
          alpha_score?: string | null
          created_at?: string | null
          hrv_score?: number | null
          id?: string
          is_ghost_protocol?: boolean | null
          rt_score?: number | null
          sleep_score?: number | null
          total_score?: number | null
          user_id?: string | null
          vitals_snapshot?: Json | null
        }
        Update: {
          alpha_score?: string | null
          created_at?: string | null
          hrv_score?: number | null
          id?: string
          is_ghost_protocol?: boolean | null
          rt_score?: number | null
          sleep_score?: number | null
          total_score?: number | null
          user_id?: string | null
          vitals_snapshot?: Json | null
        }
        Relationships: []
      }
       hub_notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          severity: string
          title: string
          user_id: string
      idia_life_accounts: {
        Row: {
          created_at: string | null
          id: string
          last_deposit_at: string | null
          liquid_balance: number | null
          pseudo_user_id: string
          total_earned: number | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          last_deposit_at?: string | null
          liquid_balance?: number | null
          pseudo_user_id: string
          total_earned?: number | null
          updated_at?: string | null
          link?: string | null
          metadata?: Json
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          last_deposit_at?: string | null
          liquid_balance?: number | null
          pseudo_user_id?: string
          total_earned?: number | null
          updated_at?: string | null
          link?: string | null
          metadata?: Json
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      idia_schema_manifest_vault: {
        Row: {
          business_id: string
          created_at: string
          id: string
          pairing_code: string
          schema_payload: Json
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          pairing_code: string
          schema_payload: Json
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          pairing_code?: string
          schema_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idia_schema_manifest_vault_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      interests: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      internal_secrets: {
        Row: {
          created_at: string | null
          key_name: string
          key_value: string
        }
        Insert: {
          created_at?: string | null
          key_name: string
          key_value: string
        }
        Update: {
          created_at?: string | null
          key_name?: string
          key_value?: string
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          adjustment_number: string
          adjustment_quantity: number
          adjustment_type: string
          approved_at: string | null
          approved_by: string | null
          business_id: string
          created_at: string | null
          created_by: string | null
          id: string
          inventory_item_id: string
          location_id: string
          quantity_after: number
          quantity_before: number
          reason: string
          reference_document: string | null
          total_value: number | null
          unit_cost: number | null
          warehouse_bin_id: string | null
        }
        Insert: {
          adjustment_number: string
          adjustment_quantity: number
          adjustment_type: string
          approved_at?: string | null
          approved_by?: string | null
          business_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          inventory_item_id: string
          location_id: string
          quantity_after: number
          quantity_before: number
          reason: string
          reference_document?: string | null
          total_value?: number | null
          unit_cost?: number | null
          warehouse_bin_id?: string | null
        }
        Update: {
          adjustment_number?: string
          adjustment_quantity?: number
          adjustment_type?: string
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          location_id?: string
          quantity_after?: number
          quantity_before?: number
          reason?: string
          reference_document?: string | null
          total_value?: number | null
          unit_cost?: number | null
          warehouse_bin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_warehouse_bin_id_fkey"
            columns: ["warehouse_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_history: {
        Row: {
          action: string
          business_id: string
          created_at: string
          id: string
          inventory_item_id: string | null
          item_name: string
          metadata: Json | null
          note: string | null
          quantity: number | null
          unit: string | null
        }
        Insert: {
          action: string
          business_id: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          item_name: string
          metadata?: Json | null
          note?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          action?: string
          business_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          item_name?: string
          metadata?: Json | null
          note?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          barcode: string | null
          business_id: string
          category: string
          created_at: string | null
          current_cost: number | null
          current_stock: number | null
          id: string
          individual_unit_uom: string | null
          is_active: boolean | null
          lead_time_days: number | null
          minimum_order_quantity: number | null
          minimum_shelf_life_days: number | null
          name: string
          par_level: number | null
          requires_batch_tracking: boolean | null
          shelf_life_days: number | null
          storage_requirements: string | null
          supplier_id: string | null
          tolerance_variance_pct: number | null
          unit_of_measure: string
          updated_at: string | null
          vendor_sku: string | null
        }
        Insert: {
          barcode?: string | null
          business_id: string
          category: string
          created_at?: string | null
          current_cost?: number | null
          current_stock?: number | null
          id?: string
          individual_unit_uom?: string | null
          is_active?: boolean | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          minimum_shelf_life_days?: number | null
          name: string
          par_level?: number | null
          requires_batch_tracking?: boolean | null
          shelf_life_days?: number | null
          storage_requirements?: string | null
          supplier_id?: string | null
          tolerance_variance_pct?: number | null
          unit_of_measure: string
          updated_at?: string | null
          vendor_sku?: string | null
        }
        Update: {
          barcode?: string | null
          business_id?: string
          category?: string
          created_at?: string | null
          current_cost?: number | null
          current_stock?: number | null
          id?: string
          individual_unit_uom?: string | null
          is_active?: boolean | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          minimum_shelf_life_days?: number | null
          name?: string
          par_level?: number | null
          requires_batch_tracking?: boolean | null
          shelf_life_days?: number | null
          storage_requirements?: string | null
          supplier_id?: string | null
          tolerance_variance_pct?: number | null
          unit_of_measure?: string
          updated_at?: string | null
          vendor_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          id: string
          inventory_item_id: string
          location_id: string
          movement_type: string
          notes: string | null
          quantity: number
          recorded_by: string | null
          reference_id: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_item_id: string
          location_id: string
          movement_type: string
          notes?: string | null
          quantity: number
          recorded_by?: string | null
          reference_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_item_id?: string
          location_id?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          reference_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_variances: {
        Row: {
          actual_yield: number
          batch_id: string
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string | null
          item_name: string
          location_id: string | null
          resolved_at: string | null
          status: string
          theoretical_yield: number
          tolerance_threshold: number
          unit: string
          unit_cost: number
          value_lost: number | null
          variance_amount: number | null
        }
        Insert: {
          actual_yield: number
          batch_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          item_name: string
          location_id?: string | null
          resolved_at?: string | null
          status?: string
          theoretical_yield: number
          tolerance_threshold?: number
          unit?: string
          unit_cost?: number
          value_lost?: number | null
          variance_amount?: number | null
        }
        Update: {
          actual_yield?: number
          batch_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          item_name?: string
          location_id?: string | null
          resolved_at?: string | null
          status?: string
          theoretical_yield?: number
          tolerance_threshold?: number
          unit?: string
          unit_cost?: number
          value_lost?: number | null
          variance_amount?: number | null
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          inventory_item_id: string | null
          invoice_id: string
          line_total: number
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          inventory_item_id?: string | null
          invoice_id: string
          line_total: number
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          inventory_item_id?: string | null
          invoice_id?: string
          line_total?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          business_id: string
          created_at: string | null
          discount_amount: number | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          is_tokenized: boolean | null
          late_fee_amount: number | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_terms_days: number | null
          status: string | null
          subtotal: number
          supplier_id: string
          tax_amount: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          discount_amount?: number | null
          due_date: string
          id?: string
          invoice_date: string
          invoice_number: string
          is_tokenized?: boolean | null
          late_fee_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_terms_days?: number | null
          status?: string | null
          subtotal: number
          supplier_id: string
          tax_amount: number
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          discount_amount?: number | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_tokenized?: boolean | null
          late_fee_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_terms_days?: number | null
          status?: string | null
          subtotal?: number
          supplier_id?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_agreements: {
        Row: {
          agreed_at: string | null
          agreement_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          agreed_at?: string | null
          agreement_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          agreed_at?: string | null
          agreement_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_agreements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lifestyle_processing_queue: {
        Row: {
          created_at: string | null
          data_category: string | null
          device_event_id: number
          error_details: Json | null
          id: string
          processing_stage: string | null
          processing_status: string | null
          retry_count: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_category?: string | null
          device_event_id: number
          error_details?: Json | null
          id?: string
          processing_stage?: string | null
          processing_status?: string | null
          retry_count?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_category?: string | null
          device_event_id?: number
          error_details?: Json | null
          id?: string
          processing_stage?: string | null
          processing_status?: string | null
          retry_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      location_inventory: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          current_stock: number | null
          expiration_date: string | null
          id: string
          inventory_item_id: string
          last_counted_at: string | null
          location_id: string
          lot_number: string | null
          max_stock_level: number | null
          par_level: number | null
          reorder_point: number | null
          updated_at: string | null
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          expiration_date?: string | null
          id?: string
          inventory_item_id: string
          last_counted_at?: string | null
          location_id: string
          lot_number?: string | null
          max_stock_level?: number | null
          par_level?: number | null
          reorder_point?: number | null
          updated_at?: string | null
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          expiration_date?: string | null
          id?: string
          inventory_item_id?: string
          last_counted_at?: string | null
          location_id?: string
          lot_number?: string | null
          max_stock_level?: number | null
          par_level?: number | null
          reorder_point?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_inventory_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_menu_items: {
        Row: {
          created_at: string | null
          id: string
          is_available: boolean | null
          local_price: number | null
          location_id: string
          menu_item_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          local_price?: number | null
          location_id: string
          menu_item_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          local_price?: number | null
          location_id?: string
          menu_item_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_menu_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_menu_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      location_menu_pricing: {
        Row: {
          approved_by: string | null
          created_at: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          location_id: string
          menu_item_id: string
          override_price: number
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          location_id: string
          menu_item_id: string
          override_price: number
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          location_id?: string
          menu_item_id?: string
          override_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_menu_pricing_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_menu_pricing_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      market_benchmarks: {
        Row: {
          created_at: string | null
          data_period: string
          geographic_region: string | null
          id: string
          industry_category: string
          metric_name: string
          metric_value: number
          percentile_25: number | null
          percentile_50: number | null
          percentile_75: number | null
          percentile_90: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_period: string
          geographic_region?: string | null
          id?: string
          industry_category: string
          metric_name: string
          metric_value: number
          percentile_25?: number | null
          percentile_50?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_period?: string
          geographic_region?: string | null
          id?: string
          industry_category?: string
          metric_name?: string
          metric_value?: number
          percentile_25?: number | null
          percentile_50?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      market_intelligence_subscriptions: {
        Row: {
          auto_renew: boolean | null
          bundle_id: string
          business_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          started_at: string | null
          status: string
          subscription_type: string
        }
        Insert: {
          auto_renew?: boolean | null
          bundle_id: string
          business_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          subscription_type?: string
        }
        Update: {
          auto_renew?: boolean | null
          bundle_id?: string
          business_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          subscription_type?: string
        }
        Relationships: []
      }
      marketing_config: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          taglines: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          taglines?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          taglines?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      marketing_taglines: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          tagline: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tagline: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tagline?: string
          weight?: number | null
        }
        Relationships: []
      }
      marketplace_bundles: {
        Row: {
          bundle_category: string | null
          bundle_id: string
          bundle_version: number | null
          category: string
          created_at: string | null
          cross_platform_insights: Json | null
          data_fusion_level: string | null
          data_json: Json
          data_points: string[] | null
          description: string
          features: string[] | null
          is_active: boolean | null
          key_insights: string[] | null
          match_percentage: number | null
          participant_count: number | null
          predictive_analytics: Json | null
          price: number
          suggested_filters: string[] | null
          tier: string
          title: string
          updated_at: string | null
        }
        Insert: {
          bundle_category?: string | null
          bundle_id?: string
          bundle_version?: number | null
          category: string
          created_at?: string | null
          cross_platform_insights?: Json | null
          data_fusion_level?: string | null
          data_json: Json
          data_points?: string[] | null
          description: string
          features?: string[] | null
          is_active?: boolean | null
          key_insights?: string[] | null
          match_percentage?: number | null
          participant_count?: number | null
          predictive_analytics?: Json | null
          price: number
          suggested_filters?: string[] | null
          tier: string
          title: string
          updated_at?: string | null
        }
        Update: {
          bundle_category?: string | null
          bundle_id?: string
          bundle_version?: number | null
          category?: string
          created_at?: string | null
          cross_platform_insights?: Json | null
          data_fusion_level?: string | null
          data_json?: Json
          data_points?: string[] | null
          description?: string
          features?: string[] | null
          is_active?: boolean | null
          key_insights?: string[] | null
          match_percentage?: number | null
          participant_count?: number | null
          predictive_analytics?: Json | null
          price?: number
          suggested_filters?: string[] | null
          tier?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      menu_history: {
        Row: {
          action: string
          business_id: string
          created_at: string
          id: string
          item_name: string
          menu_item_id: string | null
          metadata: Json | null
          note: string | null
        }
        Insert: {
          action: string
          business_id: string
          created_at?: string
          id?: string
          item_name: string
          menu_item_id?: string | null
          metadata?: Json | null
          note?: string | null
        }
        Update: {
          action?: string
          business_id?: string
          created_at?: string
          id?: string
          item_name?: string
          menu_item_id?: string | null
          metadata?: Json | null
          note?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          allergen_info: Json | null
          ar_interaction_count: number | null
          ar_model_url: string | null
          ar_placement_data: Json | null
          base_price: number
          business_id: string
          calories: number | null
          category: string
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_locked: boolean | null
          menu_status: string | null
          name: string
          preparation_time: number | null
          promotion_eligible: boolean | null
          recipe_id: string | null
          recipe_ingredients: Json | null
          seasonal: boolean | null
          updated_at: string | null
        }
        Insert: {
          allergen_info?: Json | null
          ar_interaction_count?: number | null
          ar_model_url?: string | null
          ar_placement_data?: Json | null
          base_price: number
          business_id: string
          calories?: number | null
          category: string
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_locked?: boolean | null
          menu_status?: string | null
          name: string
          preparation_time?: number | null
          promotion_eligible?: boolean | null
          recipe_id?: string | null
          recipe_ingredients?: Json | null
          seasonal?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allergen_info?: Json | null
          ar_interaction_count?: number | null
          ar_model_url?: string | null
          ar_placement_data?: Json | null
          base_price?: number
          business_id?: string
          calories?: number | null
          category?: string
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_locked?: boolean | null
          menu_status?: string | null
          name?: string
          preparation_time?: number | null
          promotion_eligible?: boolean | null
          recipe_id?: string | null
          recipe_ingredients?: Json | null
          seasonal?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_notifications: {
        Row: {
          auto_resolve_at: string | null
          created_at: string | null
          facility_id: string
          id: string
          message: string | null
          notification_type: string
          order_id: string | null
          payload: Json | null
          priority: number | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          title: string
        }
        Insert: {
          auto_resolve_at?: string | null
          created_at?: string | null
          facility_id: string
          id?: string
          message?: string | null
          notification_type: string
          order_id?: string | null
          payload?: Json | null
          priority?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          title: string
        }
        Update: {
          auto_resolve_at?: string | null
          created_at?: string | null
          facility_id?: string
          id?: string
          message?: string | null
          notification_type?: string
          order_id?: string | null
          payload?: Json | null
          priority?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_notifications_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_terminals: {
        Row: {
          business_id: string
          created_at: string
          id: string
          last_seen_at: string | null
          location_id: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          location_id?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          location_id?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_terminals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_terminals_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_transactions: {
        Row: {
          blockchain_hash: string | null
          confirmation_block: number | null
          created_at: string | null
          customer_wallet_address: string
          exchange_rate: number
          id: string
          idia_amount: number
          signature_payload: string
          transaction_id: string | null
          usd_equivalent: number
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          blockchain_hash?: string | null
          confirmation_block?: number | null
          created_at?: string | null
          customer_wallet_address: string
          exchange_rate: number
          id?: string
          idia_amount: number
          signature_payload: string
          transaction_id?: string | null
          usd_equivalent: number
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          blockchain_hash?: string | null
          confirmation_block?: number | null
          created_at?: string | null
          customer_wallet_address?: string
          exchange_rate?: number
          id?: string
          idia_amount?: number
          signature_payload?: string
          transaction_id?: string | null
          usd_equivalent?: number
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfc_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_capabilities: {
        Row: {
          capability_key: string
          granted_at: string | null
          guid: string | null
          id: string
          org_id: string | null
        }
        Insert: {
          capability_key: string
          granted_at?: string | null
          guid?: string | null
          id?: string
          org_id?: string | null
        }
        Update: {
          capability_key?: string
          granted_at?: string | null
          guid?: string | null
          id?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_capabilities_guid_fkey"
            columns: ["guid"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_capabilities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          accepts_idia_usd: boolean | null
          business_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          method_name: string
          processing_fee_percentage: number | null
          processor: string
        }
        Insert: {
          accepts_idia_usd?: boolean | null
          business_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          method_name: string
          processing_fee_percentage?: number | null
          processor: string
        }
        Update: {
          accepts_idia_usd?: boolean | null
          business_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          method_name?: string
          processing_fee_percentage?: number | null
          processor?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          additional_data: Json | null
          entity_id: string
          entity_type: string
          id: string
          metric_type: string
          metric_value: number
          recorded_at: string | null
          time_period: string
        }
        Insert: {
          additional_data?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          metric_type: string
          metric_value: number
          recorded_at?: string | null
          time_period: string
        }
        Update: {
          additional_data?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string | null
          time_period?: string
        }
        Relationships: []
      }
      permission_templates: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string | null
          description: string | null
          id: number
          name: string
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      pick_list_items: {
        Row: {
          created_at: string | null
          expiry_date: string | null
          id: string
          inventory_item_id: string
          lot_number: string | null
          notes: string | null
          pick_list_id: string
          pick_sequence: number | null
          picked_at: string | null
          picked_by: string | null
          quantity_picked: number | null
          quantity_requested: number
          status: string | null
          warehouse_bin_id: string | null
        }
        Insert: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id: string
          lot_number?: string | null
          notes?: string | null
          pick_list_id: string
          pick_sequence?: number | null
          picked_at?: string | null
          picked_by?: string | null
          quantity_picked?: number | null
          quantity_requested: number
          status?: string | null
          warehouse_bin_id?: string | null
        }
        Update: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string
          lot_number?: string | null
          notes?: string | null
          pick_list_id?: string
          pick_sequence?: number | null
          picked_at?: string | null
          picked_by?: string | null
          quantity_picked?: number | null
          quantity_requested?: number
          status?: string | null
          warehouse_bin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_warehouse_bin_id_fkey"
            columns: ["warehouse_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_lists: {
        Row: {
          actual_pick_time: number | null
          assigned_to: string | null
          business_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          estimated_pick_time: number | null
          id: string
          location_id: string
          pick_list_number: string
          pick_method: string | null
          priority: string | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          actual_pick_time?: number | null
          assigned_to?: string | null
          business_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          estimated_pick_time?: number | null
          id?: string
          location_id: string
          pick_list_number: string
          pick_method?: string | null
          priority?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          actual_pick_time?: number | null
          assigned_to?: string | null
          business_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          estimated_pick_time?: number | null
          id?: string
          location_id?: string
          pick_list_number?: string
          pick_method?: string | null
          priority?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_users: {
        Row: {
          created_at: string | null
          hub_account_type: string | null
          hub_saas_tier: string | null
          platform_role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          hub_account_type?: string | null
          hub_saas_tier?: string | null
          platform_role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          hub_account_type?: string | null
          hub_saas_tier?: string | null
          platform_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          ar_experience_id: string | null
          business_id: string | null
          cashier_id: string | null
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          id: string
          idia_usd_amount: number | null
          items: Json | null
          initiated_via_ar: boolean | null
          location_id: string
          loyalty_points_earned: number | null
          nfc_payload: Json | null
          payment_method: string
          payment_processor: string | null
          payment_status: string | null
          receipt_sent: boolean | null
          subtotal: number
          tax_amount: number
          tip_amount: number | null
          total_amount: number
          transaction_items: Json
          transaction_number: string
          transaction_reference: string | null
        }
        Insert: {
          ar_experience_id?: string | null
          business_id?: string | null
          cashier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          idia_usd_amount?: number | null
          initiated_via_ar?: boolean | null
          items?: Json | null
          location_id: string
          loyalty_points_earned?: number | null
          nfc_payload?: Json | null
          payment_method: string
          payment_processor?: string | null
          payment_status?: string | null
          receipt_sent?: boolean | null
          subtotal: number
          tax_amount: number
          tip_amount?: number | null
          total_amount: number
          transaction_items?: Json
          transaction_number: string
          transaction_reference?: string | null
        }
        Update: {
          ar_experience_id?: string | null
          business_id?: string | null
          cashier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          idia_usd_amount?: number | null
          initiated_via_ar?: boolean | null
          items?: Json | null
          location_id?: string
          loyalty_points_earned?: number | null
          nfc_payload?: Json | null
          payment_method?: string
          payment_processor?: string | null
          payment_status?: string | null
          receipt_sent?: boolean | null
          subtotal?: number
          tax_amount?: number
          tip_amount?: number | null
          total_amount?: number
          transaction_items?: Json
          transaction_number?: string
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      praises: {
        Row: {
          circle_id: string | null
          created_at: string | null
          id: string
          message: string
          praised_id: string
          praiser_id: string
        }
        Insert: {
          circle_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          praised_id: string
          praiser_id: string
        }
        Update: {
          circle_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          praised_id?: string
          praiser_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "praises_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "trust_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "praises_praised_id_fkey"
            columns: ["praised_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "praises_praiser_id_fkey"
            columns: ["praiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      processed_operator_telemetry: {
        Row: {
          active_gear: string | null
          beacon_id: string
          compiled_at: string | null
          created_at: string | null
          status: string | null
          target_multiplier: number | null
          user_id: string
        }
        Insert: {
          active_gear?: string | null
          beacon_id?: string
          compiled_at?: string | null
          created_at?: string | null
          status?: string | null
          target_multiplier?: number | null
          user_id: string
        }
        Update: {
          active_gear?: string | null
          beacon_id?: string
          compiled_at?: string | null
          created_at?: string | null
          status?: string | null
          target_multiplier?: number | null
          user_id?: string
        }
        Relationships: []
      }
      production_queue: {
        Row: {
          correlation_id: string
          created_at: string | null
          estimated_duration_seconds: number | null
          item_id: string
          job_id: string
          location_id: string
          priority_score: number | null
          scheduled_start_at: string | null
          status: string | null
        }
        Insert: {
          correlation_id: string
          created_at?: string | null
          estimated_duration_seconds?: number | null
          item_id: string
          job_id?: string
          location_id: string
          priority_score?: number | null
          scheduled_start_at?: string | null
          status?: string | null
        }
        Update: {
          correlation_id?: string
          created_at?: string | null
          estimated_duration_seconds?: number | null
          item_id?: string
          job_id?: string
          location_id?: string
          priority_score?: number | null
          scheduled_start_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          active_saas_tiers:
            | Database["public"]["Enums"]["idia_saas_tier"][]
            | null
          activity_preferences: string[] | null
          ai_assistant_name: string | null
          available_credit_line: number | null
          avatar_url: string | null
          bio: string | null
          compliance_rail: string | null
          created_at: string | null
          document_type: string | null
          ein: string | null
          fbo_account_id: string | null
          gender: string | null
          health_goals: string[] | null
          id: string
          interests: string[] | null
          is_501c3_verified: boolean | null
          is_minor: boolean | null
          is_seed_backed_up: boolean | null
          is_sovereign: boolean | null
          kyc_status: string | null
          kyc_submitted_at: string | null
          kyc_tier: number
          kyc_verified_at: string | null
          liveness_verified: boolean
          location: string | null
          motivational_phase: string | null
          occupation: string | null
          onboarding_completed: boolean | null
          platform_guid: string
          quiet_time_enabled: boolean | null
          quiet_time_end: string | null
          quiet_time_start: string | null
          trust_score: number | null
          updated_at: string | null
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          account_type?: string | null
          active_saas_tiers?:
            | Database["public"]["Enums"]["idia_saas_tier"][]
            | null
          activity_preferences?: string[] | null
          ai_assistant_name?: string | null
          available_credit_line?: number | null
          avatar_url?: string | null
          bio?: string | null
          compliance_rail?: string | null
          created_at?: string | null
          document_type?: string | null
          ein?: string | null
          fbo_account_id?: string | null
          gender?: string | null
          health_goals?: string[] | null
          id?: string
          interests?: string[] | null
          is_501c3_verified?: boolean | null
          is_minor?: boolean | null
          is_seed_backed_up?: boolean | null
          is_sovereign?: boolean | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_tier?: number
          kyc_verified_at?: string | null
          liveness_verified?: boolean
          location?: string | null
          motivational_phase?: string | null
          occupation?: string | null
          onboarding_completed?: boolean | null
          platform_guid?: string
          quiet_time_enabled?: boolean | null
          quiet_time_end?: string | null
          quiet_time_start?: string | null
          trust_score?: number | null
          updated_at?: string | null
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          account_type?: string | null
          active_saas_tiers?:
            | Database["public"]["Enums"]["idia_saas_tier"][]
            | null
          activity_preferences?: string[] | null
          ai_assistant_name?: string | null
          available_credit_line?: number | null
          avatar_url?: string | null
          bio?: string | null
          compliance_rail?: string | null
          created_at?: string | null
          document_type?: string | null
          ein?: string | null
          fbo_account_id?: string | null
          gender?: string | null
          health_goals?: string[] | null
          id?: string
          interests?: string[] | null
          is_501c3_verified?: boolean | null
          is_minor?: boolean | null
          is_seed_backed_up?: boolean | null
          is_sovereign?: boolean | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_tier?: number
          kyc_verified_at?: string | null
          liveness_verified?: boolean
          location?: string | null
          motivational_phase?: string | null
          occupation?: string | null
          onboarding_completed?: boolean | null
          platform_guid?: string
          quiet_time_enabled?: boolean | null
          quiet_time_end?: string | null
          quiet_time_start?: string | null
          trust_score?: number | null
          updated_at?: string | null
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      promotional_campaigns: {
        Row: {
          applicable_items: Json | null
          business_id: string
          campaign_name: string
          campaign_type: string
          created_at: string | null
          created_by: string | null
          discount_value: number | null
          end_date: string
          id: string
          is_active: boolean | null
          max_uses_per_customer: number | null
          minimum_purchase: number | null
          start_date: string
          target_locations: string[] | null
          total_budget: number | null
        }
        Insert: {
          applicable_items?: Json | null
          business_id: string
          campaign_name: string
          campaign_type: string
          created_at?: string | null
          created_by?: string | null
          discount_value?: number | null
          end_date: string
          id?: string
          is_active?: boolean | null
          max_uses_per_customer?: number | null
          minimum_purchase?: number | null
          start_date: string
          target_locations?: string[] | null
          total_budget?: number | null
        }
        Update: {
          applicable_items?: Json | null
          business_id?: string
          campaign_name?: string
          campaign_type?: string
          created_at?: string | null
          created_by?: string | null
          discount_value?: number | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          max_uses_per_customer?: number | null
          minimum_purchase?: number | null
          start_date?: string
          target_locations?: string[] | null
          total_budget?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotional_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_survey_responses: {
        Row: {
          created_at: string | null
          id: string
          responses: Json
          sentiment_score: number | null
          survey_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          responses: Json
          sentiment_score?: number | null
          survey_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          responses?: Json
          sentiment_score?: number | null
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "pulse_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_survey_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pulse_surveys: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          questions: Json
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          questions: Json
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          questions?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      purchase_order_line_items: {
        Row: {
          created_at: string | null
          expiry_date: string | null
          id: string
          inventory_item_id: string | null
          item_name: string
          lot_number: string | null
          ordered_quantity: number
          purchase_order_id: string
          received_quantity: number | null
          sku: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string | null
          item_name: string
          lot_number?: string | null
          ordered_quantity: number
          purchase_order_id: string
          received_quantity?: number | null
          sku: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string | null
          item_name?: string
          lot_number?: string | null
          ordered_quantity?: number
          purchase_order_id?: string
          received_quantity?: number | null
          sku?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_line_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_line_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          business_id: string
          created_at: string | null
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          invoice_amount: number | null
          invoice_status: string | null
          location_id: string
          notes: string | null
          order_date: string
          po_number: string
          status: string
          supplier_contact: Json | null
          supplier_name: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          business_id: string
          created_at?: string | null
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_status?: string | null
          location_id: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: string
          supplier_contact?: Json | null
          supplier_name: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          business_id?: string
          created_at?: string | null
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_status?: string | null
          location_id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: string
          supplier_contact?: Json | null
          supplier_name?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      raw_app_data: {
        Row: {
          aca_hash_key: string | null
          anonymized_payload: Json
          created_at: string | null
          data_category: string
          data_quality_score: number | null
          device_aca_key: string | null
          event_type: string
          id: string
          location_zone: string | null
          processed_at: string
          pseudo_user_id: string
          raw_source: string | null
          session_context: Json | null
          telemetry_payload: Json | null
        }
        Insert: {
          aca_hash_key?: string | null
          anonymized_payload: Json
          created_at?: string | null
          data_category: string
          data_quality_score?: number | null
          device_aca_key?: string | null
          event_type: string
          id?: string
          location_zone?: string | null
          processed_at?: string
          pseudo_user_id: string
          raw_source?: string | null
          session_context?: Json | null
          telemetry_payload?: Json | null
        }
        Update: {
          aca_hash_key?: string | null
          anonymized_payload?: Json
          created_at?: string | null
          data_category?: string
          data_quality_score?: number | null
          device_aca_key?: string | null
          event_type?: string
          id?: string
          location_zone?: string | null
          processed_at?: string
          pseudo_user_id?: string
          raw_source?: string | null
          session_context?: Json | null
          telemetry_payload?: Json | null
        }
        Relationships: []
      }
      raw_health_data: {
        Row: {
          aca_hash: string | null
          aca_hash_key: string | null
          activity_type: string | null
          created_at: string | null
          device_type: string | null
          id: string
          last_error: string | null
          next_retry_at: string | null
          processed: boolean | null
          processing_completed_at: string | null
          processing_started_at: string | null
          processing_status: Database["public"]["Enums"]["sync_status"] | null
          raw_payload: Json
          recorded_at: string | null
          retry_count: number | null
          source: string | null
          step_count: number | null
          user_id: string | null
        }
        Insert: {
          aca_hash?: string | null
          aca_hash_key?: string | null
          activity_type?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          processed?: boolean | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_status?: Database["public"]["Enums"]["sync_status"] | null
          raw_payload: Json
          recorded_at?: string | null
          retry_count?: number | null
          source?: string | null
          step_count?: number | null
          user_id?: string | null
        }
        Update: {
          aca_hash?: string | null
          aca_hash_key?: string | null
          activity_type?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          processed?: boolean | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_status?: Database["public"]["Enums"]["sync_status"] | null
          raw_payload?: Json
          recorded_at?: string | null
          retry_count?: number | null
          source?: string | null
          step_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      raw_strava_data: {
        Row: {
          activity_id: number
          connection_id: string
          id: string
          processed: boolean | null
          raw_data: Json
          received_at: string
          user_id: string
        }
        Insert: {
          activity_id: number
          connection_id: string
          id?: string
          processed?: boolean | null
          raw_data: Json
          received_at?: string
          user_id: string
        }
        Update: {
          activity_id?: number
          connection_id?: string
          id?: string
          processed?: boolean | null
          raw_data?: Json
          received_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_strava_data_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "data_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_discrepancies: {
        Row: {
          actual_quantity: number | null
          created_at: string | null
          created_by: string | null
          description: string
          discrepancy_type: string
          expected_quantity: number | null
          id: string
          photo_urls: Json | null
          purchase_order_id: string
          purchase_order_line_item_id: string | null
          resolution_notes: string | null
          resolution_status: string | null
          resolved_at: string | null
          resolved_by: string | null
          supplier_notified: boolean | null
          supplier_notified_at: string | null
          variance_quantity: number | null
        }
        Insert: {
          actual_quantity?: number | null
          created_at?: string | null
          created_by?: string | null
          description: string
          discrepancy_type: string
          expected_quantity?: number | null
          id?: string
          photo_urls?: Json | null
          purchase_order_id: string
          purchase_order_line_item_id?: string | null
          resolution_notes?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          supplier_notified?: boolean | null
          supplier_notified_at?: string | null
          variance_quantity?: number | null
        }
        Update: {
          actual_quantity?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          discrepancy_type?: string
          expected_quantity?: number | null
          id?: string
          photo_urls?: Json | null
          purchase_order_id?: string
          purchase_order_line_item_id?: string | null
          resolution_notes?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          supplier_notified?: boolean | null
          supplier_notified_at?: string | null
          variance_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receiving_discrepancies_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_discrepancies_purchase_order_line_item_id_fkey"
            columns: ["purchase_order_line_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_history: {
        Row: {
          action: string
          business_id: string
          created_at: string
          id: string
          metadata: Json | null
          note: string | null
          recipe_id: string | null
          recipe_name: string
        }
        Insert: {
          action: string
          business_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          recipe_id?: string | null
          recipe_name: string
        }
        Update: {
          action?: string
          business_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          recipe_id?: string | null
          recipe_name?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string | null
          gross_quantity: number | null
          id: string
          inventory_item_id: string
          notes: string | null
          quantity: number
          recipe_id: string
          unit: string
          yield_percentage: number | null
        }
        Insert: {
          created_at?: string | null
          gross_quantity?: number | null
          id?: string
          inventory_item_id: string
          notes?: string | null
          quantity?: number
          recipe_id: string
          unit: string
          yield_percentage?: number | null
        }
        Update: {
          created_at?: string | null
          gross_quantity?: number | null
          id?: string
          inventory_item_id?: string
          notes?: string | null
          quantity?: number
          recipe_id?: string
          unit?: string
          yield_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_recipe_ingredients_recipe"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          allergens: Json | null
          business_id: string
          category: string
          cook_time: number | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: string
          instructions: Json | null
          is_active: boolean | null
          name: string
          prep_time: number | null
          servings: number | null
          updated_at: string | null
        }
        Insert: {
          allergens?: Json | null
          business_id: string
          category?: string
          cook_time?: number | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          instructions?: Json | null
          is_active?: boolean | null
          name: string
          prep_time?: number | null
          servings?: number | null
          updated_at?: string | null
        }
        Update: {
          allergens?: Json | null
          business_id?: string
          category?: string
          cook_time?: number | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          instructions?: Json | null
          is_active?: boolean | null
          name?: string
          prep_time?: number | null
          servings?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      remediation_plans: {
        Row: {
          actions: Json
          agent_name: string
          created_at: string
          explanation: string
          id: string
          security_event_id: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          agent_name: string
          created_at?: string
          explanation: string
          id?: string
          security_event_id?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          agent_name?: string
          created_at?: string
          explanation?: string
          id?: string
          security_event_id?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_plans_security_event_id_fkey"
            columns: ["security_event_id"]
            isOneToOne: false
            referencedRelation: "security_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_analytics: {
        Row: {
          average_ticket: number | null
          business_id: string
          cost_of_goods: number | null
          created_at: string | null
          gross_profit: number | null
          id: string
          labor_cost: number | null
          location_id: string | null
          report_date: string
          total_customers: number | null
          total_sales: number | null
          transaction_count: number | null
        }
        Insert: {
          average_ticket?: number | null
          business_id: string
          cost_of_goods?: number | null
          created_at?: string | null
          gross_profit?: number | null
          id?: string
          labor_cost?: number | null
          location_id?: string | null
          report_date: string
          total_customers?: number | null
          total_sales?: number | null
          transaction_count?: number | null
        }
        Update: {
          average_ticket?: number | null
          business_id?: string
          cost_of_goods?: number | null
          created_at?: string | null
          gross_profit?: number | null
          id?: string
          labor_cost?: number | null
          location_id?: string | null
          report_date?: string
          total_customers?: number | null
          total_sales?: number | null
          transaction_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_analytics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_event_logs: {
        Row: {
          created_at: string | null
          description: string
          event_type: string
          id: string
          protocol: string
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          event_type: string
          id?: string
          protocol: string
          severity: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          event_type?: string
          id?: string
          protocol?: string
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          action_type: string
          agent_name: string
          created_at: string | null
          id: string
          resolved: boolean | null
          result_data: Json
          severity: string
          timestamp: string
        }
        Insert: {
          action_type: string
          agent_name: string
          created_at?: string | null
          id?: string
          resolved?: boolean | null
          result_data: Json
          severity?: string
          timestamp?: string
        }
        Update: {
          action_type?: string
          agent_name?: string
          created_at?: string | null
          id?: string
          resolved?: boolean | null
          result_data?: Json
          severity?: string
          timestamp?: string
        }
        Relationships: []
      }
      security_preferences: {
        Row: {
          aegis_protocol: boolean | null
          ambient_isolation: boolean | null
          coercion_detector: boolean | null
          digital_ward: boolean | null
          honey_pot: boolean | null
          impact_trauma_sync: boolean | null
          silver_sentinel: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aegis_protocol?: boolean | null
          ambient_isolation?: boolean | null
          coercion_detector?: boolean | null
          digital_ward?: boolean | null
          honey_pot?: boolean | null
          impact_trauma_sync?: boolean | null
          silver_sentinel?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aegis_protocol?: boolean | null
          ambient_isolation?: boolean | null
          coercion_detector?: boolean | null
          digital_ward?: boolean | null
          honey_pot?: boolean | null
          impact_trauma_sync?: boolean | null
          silver_sentinel?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shipment_line_items: {
        Row: {
          created_at: string | null
          expiry_date: string | null
          id: string
          inventory_item_id: string
          lot_number: string | null
          package_number: string | null
          quantity: number
          shipment_id: string
        }
        Insert: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id: string
          lot_number?: string | null
          package_number?: string | null
          quantity: number
          shipment_id: string
        }
        Update: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string
          lot_number?: string | null
          package_number?: string | null
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_line_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_line_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_delivery_date: string | null
          actual_pickup_date: string | null
          actual_weight: number | null
          business_id: string
          carrier: string | null
          created_at: string | null
          created_by: string | null
          customer_address: Json | null
          customer_name: string | null
          delivery_instructions: string | null
          estimated_delivery_date: string | null
          estimated_weight: number | null
          id: string
          location_id: string
          scheduled_pickup_date: string | null
          service_type: string | null
          shipment_number: string
          shipping_cost: number | null
          status: string
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          actual_pickup_date?: string | null
          actual_weight?: number | null
          business_id: string
          carrier?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: Json | null
          customer_name?: string | null
          delivery_instructions?: string | null
          estimated_delivery_date?: string | null
          estimated_weight?: number | null
          id?: string
          location_id: string
          scheduled_pickup_date?: string | null
          service_type?: string | null
          shipment_number: string
          shipping_cost?: number | null
          status?: string
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          actual_pickup_date?: string | null
          actual_weight?: number | null
          business_id?: string
          carrier?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_address?: Json | null
          customer_name?: string | null
          delivery_instructions?: string | null
          estimated_delivery_date?: string | null
          estimated_weight?: number | null
          id?: string
          location_id?: string
          scheduled_pickup_date?: string | null
          service_type?: string | null
          shipment_number?: string
          shipping_cost?: number | null
          status?: string
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      social_analytics_consent: {
        Row: {
          excluded_friend_ids: string[] | null
          is_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          excluded_friend_ids?: string[] | null
          is_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          excluded_friend_ids?: string[] | null
          is_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_analytics_consent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      social_health_metrics: {
        Row: {
          last_calculated: string | null
          network_vitality_score: number | null
          reciprocity_score: number | null
          trust_network_size: number | null
          updated_at: string | null
          user_id: string
          weekly_interactions_count: number | null
        }
        Insert: {
          last_calculated?: string | null
          network_vitality_score?: number | null
          reciprocity_score?: number | null
          trust_network_size?: number | null
          updated_at?: string | null
          user_id: string
          weekly_interactions_count?: number | null
        }
        Update: {
          last_calculated?: string | null
          network_vitality_score?: number | null
          reciprocity_score?: number | null
          trust_network_size?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_interactions_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_health_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staged_business_data: {
        Row: {
          anonymized_from_business_id: string | null
          ar_engagement_data: Json | null
          business_category: string
          created_at: string | null
          data_completeness_score: number | null
          data_quality_score: number | null
          employee_analytics: Json | null
          id: string
          location_performance: Json | null
          operational_metrics: Json | null
          processed_at: string | null
          pseudo_business_id: string
          seasonal_trends: Json | null
          transaction_patterns: Json | null
        }
        Insert: {
          anonymized_from_business_id?: string | null
          ar_engagement_data?: Json | null
          business_category: string
          created_at?: string | null
          data_completeness_score?: number | null
          data_quality_score?: number | null
          employee_analytics?: Json | null
          id?: string
          location_performance?: Json | null
          operational_metrics?: Json | null
          processed_at?: string | null
          pseudo_business_id: string
          seasonal_trends?: Json | null
          transaction_patterns?: Json | null
        }
        Update: {
          anonymized_from_business_id?: string | null
          ar_engagement_data?: Json | null
          business_category?: string
          created_at?: string | null
          data_completeness_score?: number | null
          data_quality_score?: number | null
          employee_analytics?: Json | null
          id?: string
          location_performance?: Json | null
          operational_metrics?: Json | null
          processed_at?: string | null
          pseudo_business_id?: string
          seasonal_trends?: Json | null
          transaction_patterns?: Json | null
        }
        Relationships: []
      }
      staged_health_data: {
        Row: {
          aca_hash_key: string | null
          active_energy_kcal: number | null
          activity_type: string
          basal_energy_kcal: number | null
          blood_oxygen_percentage: number | null
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          body_temperature_f: number | null
          created_at: string | null
          data_quality_score: number | null
          double_support_percentage: number | null
          duration_seconds: number | null
          effort_score: number | null
          entity_id: string | null
          environmental_audio_exposure_db: number | null
          faculty: string | null
          heart_rate: number | null
          heart_rate_variability_ms: number | null
          id: string
          is_settled: boolean | null
          payload: Json
          platform_guid: string | null
          processed_at: string | null
          pseudo_user_id: string | null
          raw_data_id: string | null
          respiratory_rate: number | null
          resting_heart_rate: number | null
          reward_amount: number | null
          reward_calculated: boolean | null
          settled_at: string | null
          sleep_analysis_value: number | null
          sovereign_uuid: string | null
          status: string | null
          step_length_cm: number | null
          steps_count: number | null
          synapse_weight_coefficient: number | null
          user_id: string | null
          uv_exposure_index: number | null
          vo2_max: number | null
          walking_asymmetry_percentage: number | null
          walking_speed_kmh: number | null
          walking_steadiness_percentage: number | null
        }
        Insert: {
          aca_hash_key?: string | null
          active_energy_kcal?: number | null
          activity_type: string
          basal_energy_kcal?: number | null
          blood_oxygen_percentage?: number | null
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          body_temperature_f?: number | null
          created_at?: string | null
          data_quality_score?: number | null
          double_support_percentage?: number | null
          duration_seconds?: number | null
          effort_score?: number | null
          entity_id?: string | null
          environmental_audio_exposure_db?: number | null
          faculty?: string | null
          heart_rate?: number | null
          heart_rate_variability_ms?: number | null
          id?: string
          is_settled?: boolean | null
          payload?: Json
          platform_guid?: string | null
          processed_at?: string | null
          pseudo_user_id?: string | null
          raw_data_id?: string | null
          respiratory_rate?: number | null
          resting_heart_rate?: number | null
          reward_amount?: number | null
          reward_calculated?: boolean | null
          settled_at?: string | null
          sleep_analysis_value?: number | null
          sovereign_uuid?: string | null
          status?: string | null
          step_length_cm?: number | null
          steps_count?: number | null
          synapse_weight_coefficient?: number | null
          user_id?: string | null
          uv_exposure_index?: number | null
          vo2_max?: number | null
          walking_asymmetry_percentage?: number | null
          walking_speed_kmh?: number | null
          walking_steadiness_percentage?: number | null
        }
        Update: {
          aca_hash_key?: string | null
          active_energy_kcal?: number | null
          activity_type?: string
          basal_energy_kcal?: number | null
          blood_oxygen_percentage?: number | null
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          body_temperature_f?: number | null
          created_at?: string | null
          data_quality_score?: number | null
          double_support_percentage?: number | null
          duration_seconds?: number | null
          effort_score?: number | null
          entity_id?: string | null
          environmental_audio_exposure_db?: number | null
          faculty?: string | null
          heart_rate?: number | null
          heart_rate_variability_ms?: number | null
          id?: string
          is_settled?: boolean | null
          payload?: Json
          platform_guid?: string | null
          processed_at?: string | null
          pseudo_user_id?: string | null
          raw_data_id?: string | null
          respiratory_rate?: number | null
          resting_heart_rate?: number | null
          reward_amount?: number | null
          reward_calculated?: boolean | null
          settled_at?: string | null
          sleep_analysis_value?: number | null
          sovereign_uuid?: string | null
          status?: string | null
          step_length_cm?: number | null
          steps_count?: number | null
          synapse_weight_coefficient?: number | null
          user_id?: string | null
          uv_exposure_index?: number | null
          vo2_max?: number | null
          walking_asymmetry_percentage?: number | null
          walking_speed_kmh?: number | null
          walking_steadiness_percentage?: number | null
        }
        Relationships: []
      }
      staged_lifestyle_data: {
        Row: {
          aca_hash_key: string | null
          created_at: string | null
          data_quality_score: number | null
          entity_id: string
          event_category: string | null
          event_type: string
          id: string
          processed_at: string | null
          pseudo_user_id: string | null
          reward_amount: number | null
          reward_calculated: boolean | null
          session_duration: number | null
          synapse_weight_coefficient: number | null
          user_id: string | null
        }
        Insert: {
          aca_hash_key?: string | null
          created_at?: string | null
          data_quality_score?: number | null
          entity_id: string
          event_category?: string | null
          event_type: string
          id?: string
          processed_at?: string | null
          pseudo_user_id?: string | null
          reward_amount?: number | null
          reward_calculated?: boolean | null
          session_duration?: number | null
          synapse_weight_coefficient?: number | null
          user_id?: string | null
        }
        Update: {
          aca_hash_key?: string | null
          created_at?: string | null
          data_quality_score?: number | null
          entity_id?: string
          event_category?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          pseudo_user_id?: string | null
          reward_amount?: number | null
          reward_calculated?: boolean | null
          session_duration?: number | null
          synapse_weight_coefficient?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          business_id: string
          contact_name: string | null
          created_at: string | null
          credit_limit: number | null
          current_balance: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: string | null
          phone: string | null
          preferred_payment_method: string | null
          rating: number | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_id: string
          contact_name?: string | null
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          preferred_payment_method?: string | null
          rating?: number | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string
          contact_name?: string | null
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          preferred_payment_method?: string | null
          rating?: number | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      synapse_controller: {
        Row: {
          aca_hash_key: string
          created_at: string
          id: string
          raw_data: Json
          status: string
          user_id: string
        }
        Insert: {
          aca_hash_key: string
          created_at?: string
          id?: string
          raw_data: Json
          status?: string
          user_id: string
        }
        Update: {
          aca_hash_key?: string
          created_at?: string
          id?: string
          raw_data?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      synapse_credit_ledger: {
        Row: {
          amount: number
          amount_idia_usd: number | null
          amount_usdc: number | null
          balance_after: number | null
          balance_fiat_usd: number | null
          balance_previous: number | null
          balance_usdc_stable: number | null
          blockchain_tx_hash: string | null
          circle_idempotency_key: string | null
          circle_transfer_id: string | null
          created_at: string | null
          description: string | null
          destination_wallet: string | null
          entry_type: string
          exchange_rate_at_deposit: number | null
          fiat_balance: number | null
          flare_tx_hash: string | null
          funding_source: string | null
          id: string
          is_settled: boolean | null
          metadata: Json | null
          reference_id: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["idia_transaction_status"] | null
          transaction_id: string | null
          transaction_type:
            | Database["public"]["Enums"]["idia_transaction_type"]
            | null
          user_id: string
        }
        Insert: {
          amount: number
          amount_idia_usd?: number | null
          amount_usdc?: number | null
          balance_after?: number | null
          balance_fiat_usd?: number | null
          balance_previous?: number | null
          balance_usdc_stable?: number | null
          blockchain_tx_hash?: string | null
          circle_idempotency_key?: string | null
          circle_transfer_id?: string | null
          created_at?: string | null
          description?: string | null
          destination_wallet?: string | null
          entry_type: string
          exchange_rate_at_deposit?: number | null
          fiat_balance?: number | null
          flare_tx_hash?: string | null
          funding_source?: string | null
          id?: string
          is_settled?: boolean | null
          metadata?: Json | null
          reference_id?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["idia_transaction_status"] | null
          transaction_id?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["idia_transaction_type"]
            | null
          user_id: string
        }
        Update: {
          amount?: number
          amount_idia_usd?: number | null
          amount_usdc?: number | null
          balance_after?: number | null
          balance_fiat_usd?: number | null
          balance_previous?: number | null
          balance_usdc_stable?: number | null
          blockchain_tx_hash?: string | null
          circle_idempotency_key?: string | null
          circle_transfer_id?: string | null
          created_at?: string | null
          description?: string | null
          destination_wallet?: string | null
          entry_type?: string
          exchange_rate_at_deposit?: number | null
          fiat_balance?: number | null
          flare_tx_hash?: string | null
          funding_source?: string | null
          id?: string
          is_settled?: boolean | null
          metadata?: Json | null
          reference_id?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["idia_transaction_status"] | null
          transaction_id?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["idia_transaction_type"]
            | null
          user_id?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          failed_syncs: number
          id: string
          successful_syncs: number
          sync_results: Json | null
          sync_type: string
          total_connections: number
        }
        Insert: {
          created_at?: string
          failed_syncs?: number
          id?: string
          successful_syncs?: number
          sync_results?: Json | null
          sync_type: string
          total_connections?: number
        }
        Update: {
          created_at?: string
          failed_syncs?: number
          id?: string
          successful_syncs?: number
          sync_results?: Json | null
          sync_type?: string
          total_connections?: number
        }
        Relationships: []
      }
      system_configs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      system_health: {
        Row: {
          component: string
          created_at: string | null
          id: string
          last_heartbeat: string | null
          metadata: Json | null
          status: string
        }
        Insert: {
          component: string
          created_at?: string | null
          id?: string
          last_heartbeat?: string | null
          metadata?: Json | null
          status?: string
        }
        Update: {
          component?: string
          created_at?: string | null
          id?: string
          last_heartbeat?: string | null
          metadata?: Json | null
          status?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          business_id: string
          created_at: string | null
          effective_date: string
          id: string
          is_active: boolean | null
          jurisdiction: string
          location_id: string | null
          rate: number
          tax_type: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          effective_date: string
          id?: string
          is_active?: boolean | null
          jurisdiction: string
          location_id?: string | null
          rate: number
          tax_type: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          effective_date?: string
          id?: string
          is_active?: boolean | null
          jurisdiction?: string
          location_id?: string | null
          rate?: number
          tax_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_submodules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          vertical_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          name: string
          updated_at?: string
          vertical_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_submodules_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_verticals: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      telemetry_logs: {
        Row: {
          created_at: string | null
          credit_line_granted: number | null
          final_trust_score: number | null
          id: string
          module_scores: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          credit_line_granted?: number | null
          final_trust_score?: number | null
          id?: string
          module_scores: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          credit_line_granted?: number | null
          final_trust_score?: number | null
          id?: string
          module_scores?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          metadata: Json | null
          source: string | null
          status: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          source?: string | null
          status?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          status?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      trust_circle_members: {
        Row: {
          circle_id: string
          id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "trust_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_circle_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trust_circles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_private: boolean | null
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_private?: boolean | null
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_private?: boolean | null
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trust_circles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trust_score_history: {
        Row: {
          id: string
          recorded_at: string
          score: number
          user_id: string
        }
        Insert: {
          id?: string
          recorded_at?: string
          score: number
          user_id: string
        }
        Update: {
          id?: string
          recorded_at?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      universal_data_bundles: {
        Row: {
          bundle_category: string
          bundle_metadata: Json
          bundle_size_bytes: number | null
          created_at: string | null
          data_types: Json
          expires_at: string | null
          id: string
          market_value: number | null
          quality_score: number | null
          unique_users_count: number | null
        }
        Insert: {
          bundle_category: string
          bundle_metadata: Json
          bundle_size_bytes?: number | null
          created_at?: string | null
          data_types: Json
          expires_at?: string | null
          id?: string
          market_value?: number | null
          quality_score?: number | null
          unique_users_count?: number | null
        }
        Update: {
          bundle_category?: string
          bundle_metadata?: Json
          bundle_size_bytes?: number | null
          created_at?: string | null
          data_types?: Json
          expires_at?: string | null
          id?: string
          market_value?: number | null
          quality_score?: number | null
          unique_users_count?: number | null
        }
        Relationships: []
      }
      urban_flow_events: {
        Row: {
          anonymized_user_id: string | null
          device_type: string | null
          event_data: Json
          event_type: string
          geospatial_data: Json | null
          id: string
          location_id: string | null
          session_id: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          anonymized_user_id?: string | null
          device_type?: string | null
          event_data: Json
          event_type: string
          geospatial_data?: Json | null
          id?: string
          location_id?: string | null
          session_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          anonymized_user_id?: string | null
          device_type?: string | null
          event_data?: Json
          event_type?: string
          geospatial_data?: Json | null
          id?: string
          location_id?: string | null
          session_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "urban_flow_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      usdc_onchain_events: {
        Row: {
          amount_micro: number
          block_number: number | null
          direction: string
          from_address: string
          id: string
          log_index: number
          raw_payload: Json | null
          received_at: string
          source: string
          to_address: string
          tx_hash: string
          wallet_user_id: string | null
        }
        Insert: {
          amount_micro: number
          block_number?: number | null
          direction: string
          from_address: string
          id?: string
          log_index: number
          raw_payload?: Json | null
          received_at?: string
          source?: string
          to_address: string
          tx_hash: string
          wallet_user_id?: string | null
        }
        Update: {
          amount_micro?: number
          block_number?: number | null
          direction?: string
          from_address?: string
          id?: string
          log_index?: number
          raw_payload?: Json | null
          received_at?: string
          source?: string
          to_address?: string
          tx_hash?: string
          wallet_user_id?: string | null
        }
        Relationships: []
      }
      usdc_payments: {
        Row: {
          aca_hash: string | null
          amount_raw: string
          amount_usdc: number
          block_number: number | null
          chain_id: number
          created_at: string | null
          error_message: string | null
          id: string
          merchant_id: string | null
          merchant_name: string | null
          network: string
          nonce_used: string | null
          recipient_address: string
          reference: string | null
          relayed_by: string | null
          sender_address: string
          settled_at: string | null
          status: string
          tx_hash: string | null
          updated_at: string | null
        }
        Insert: {
          aca_hash?: string | null
          amount_raw: string
          amount_usdc: number
          block_number?: number | null
          chain_id?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          merchant_id?: string | null
          merchant_name?: string | null
          network?: string
          nonce_used?: string | null
          recipient_address: string
          reference?: string | null
          relayed_by?: string | null
          sender_address: string
          settled_at?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string | null
        }
        Update: {
          aca_hash?: string | null
          amount_raw?: string
          amount_usdc?: number
          block_number?: number | null
          chain_id?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          merchant_id?: string | null
          merchant_name?: string | null
          network?: string
          nonce_used?: string | null
          recipient_address?: string
          reference?: string | null
          relayed_by?: string | null
          sender_address?: string
          settled_at?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_aca_records: {
        Row: {
          aca_hash_key: string
          consent_scope: string[]
          consent_type: string | null
          created_at: string | null
          id: string
          platform_guid: string
          source_id: string
        }
        Insert: {
          aca_hash_key: string
          consent_scope?: string[]
          consent_type?: string | null
          created_at?: string | null
          id?: string
          platform_guid: string
          source_id?: string
        }
        Update: {
          aca_hash_key?: string
          consent_scope?: string[]
          consent_type?: string | null
          created_at?: string | null
          id?: string
          platform_guid?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_aca_records_platform_guid_fkey"
            columns: ["platform_guid"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["platform_guid"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          created_at: string | null
          id: string
          key_hash: string
          key_name: string
          key_prefix: string
          last_used_at: string | null
          status: string
          total_calls: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_hash: string
          key_name: string
          key_prefix: string
          last_used_at?: string | null
          status?: string
          total_calls?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_hash?: string
          key_name?: string
          key_prefix?: string
          last_used_at?: string | null
          status?: string
          total_calls?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          created_at: string | null
          id: string
          interest_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interest_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_invoices: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          invoice_number: string
          pdf_url: string | null
          period: string
          status: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          invoice_number: string
          pdf_url?: string | null
          period: string
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_number?: string
          pdf_url?: string | null
          period?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_passkeys: {
        Row: {
          created_at: string | null
          credential_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          credential_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          credential_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_payment_methods: {
        Row: {
          created_at: string | null
          display_label: string
          id: string
          identifier: string | null
          is_default: boolean | null
          metadata: Json | null
          method_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_label: string
          id?: string
          identifier?: string | null
          is_default?: boolean | null
          metadata?: Json | null
          method_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_label?: string
          id?: string
          identifier?: string | null
          is_default?: boolean | null
          metadata?: Json | null
          method_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          is_granted: boolean
          permission_id: number
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_granted: boolean
          permission_id: number
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_granted?: boolean
          permission_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          colorblind_mode: boolean | null
          created_at: string | null
          data_sharing_consent: boolean | null
          email_reports: boolean | null
          font_size: string | null
          high_contrast: boolean | null
          id: string
          in_app_alerts: boolean | null
          in_app_sounds: boolean | null
          marketing_emails: boolean | null
          privacy_bluetooth: boolean | null
          privacy_camera: boolean | null
          privacy_health: boolean | null
          privacy_microphone: boolean | null
          privacy_motion: boolean | null
          privacy_nfc: boolean | null
          push_activity: boolean | null
          push_insights: boolean | null
          push_notifications: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          theme_preference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          colorblind_mode?: boolean | null
          created_at?: string | null
          data_sharing_consent?: boolean | null
          email_reports?: boolean | null
          font_size?: string | null
          high_contrast?: boolean | null
          id?: string
          in_app_alerts?: boolean | null
          in_app_sounds?: boolean | null
          marketing_emails?: boolean | null
          privacy_bluetooth?: boolean | null
          privacy_camera?: boolean | null
          privacy_health?: boolean | null
          privacy_microphone?: boolean | null
          privacy_motion?: boolean | null
          privacy_nfc?: boolean | null
          push_activity?: boolean | null
          push_insights?: boolean | null
          push_notifications?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          colorblind_mode?: boolean | null
          created_at?: string | null
          data_sharing_consent?: boolean | null
          email_reports?: boolean | null
          font_size?: string | null
          high_contrast?: boolean | null
          id?: string
          in_app_alerts?: boolean | null
          in_app_sounds?: boolean | null
          marketing_emails?: boolean | null
          privacy_bluetooth?: boolean | null
          privacy_camera?: boolean | null
          privacy_health?: boolean | null
          privacy_microphone?: boolean | null
          privacy_motion?: boolean | null
          privacy_nfc?: boolean | null
          push_activity?: boolean | null
          push_insights?: boolean | null
          push_notifications?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_proposals: {
        Row: {
          ai_validation_feedback: string | null
          ai_validation_score: number | null
          category: string
          created_at: string
          description: string
          id: string
          status: string
          suggested_impact: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_validation_feedback?: string | null
          ai_validation_score?: number | null
          category: string
          created_at?: string
          description: string
          id?: string
          status?: string
          suggested_impact?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_validation_feedback?: string | null
          ai_validation_score?: number | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          suggested_impact?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          started_at: string
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_votes: {
        Row: {
          created_at: string | null
          id: string
          proposal_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          proposal_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          proposal_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: []
      }
      variance_corrections: {
        Row: {
          business_id: string
          corrective_action: string
          id: string
          manager_auth_pin_hash: string
          reconciled_at: string
          reconciled_by: string | null
          root_cause: string
          variance_id: string
        }
        Insert: {
          business_id: string
          corrective_action: string
          id?: string
          manager_auth_pin_hash: string
          reconciled_at?: string
          reconciled_by?: string | null
          root_cause: string
          variance_id: string
        }
        Update: {
          business_id?: string
          corrective_action?: string
          id?: string
          manager_auth_pin_hash?: string
          reconciled_at?: string
          reconciled_by?: string | null
          root_cause?: string
          variance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variance_corrections_variance_id_fkey"
            columns: ["variance_id"]
            isOneToOne: false
            referencedRelation: "inventory_variances"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          cash_balance: number | null
          corporate_revenue: number | null
          created_at: string | null
          governance_tokens: number | null
          hub_cash_balance: number | null
          id: string
          idia_token_balance: number | null
          idia_usd_balance: number | null
          life_cash_balance: number | null
          platform_guid: string | null
          stablecoin_balance: number | null
          synapse_gas_credits: number | null
          total_earned: number | null
          updated_at: string | null
          usdc_balance: number | null
          usdc_last_block: number | null
          usdc_last_synced_at: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          cash_balance?: number | null
          corporate_revenue?: number | null
          created_at?: string | null
          governance_tokens?: number | null
          hub_cash_balance?: number | null
          id?: string
          idia_token_balance?: number | null
          idia_usd_balance?: number | null
          life_cash_balance?: number | null
          platform_guid?: string | null
          stablecoin_balance?: number | null
          synapse_gas_credits?: number | null
          total_earned?: number | null
          updated_at?: string | null
          usdc_balance?: number | null
          usdc_last_block?: number | null
          usdc_last_synced_at?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          cash_balance?: number | null
          corporate_revenue?: number | null
          created_at?: string | null
          governance_tokens?: number | null
          hub_cash_balance?: number | null
          id?: string
          idia_token_balance?: number | null
          idia_usd_balance?: number | null
          life_cash_balance?: number | null
          platform_guid?: string | null
          stablecoin_balance?: number | null
          synapse_gas_credits?: number | null
          total_earned?: number | null
          updated_at?: string | null
          usdc_balance?: number | null
          usdc_last_block?: number | null
          usdc_last_synced_at?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      warehouse_bins: {
        Row: {
          aisle: string | null
          bin_code: string
          bin_type: string | null
          business_id: string
          capacity_cubic_feet: number | null
          coordinates: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          level: string | null
          location_id: string
          shelf: string | null
          temperature_controlled: boolean | null
          weight_capacity_lbs: number | null
          zone: string
        }
        Insert: {
          aisle?: string | null
          bin_code: string
          bin_type?: string | null
          business_id: string
          capacity_cubic_feet?: number | null
          coordinates?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level?: string | null
          location_id: string
          shelf?: string | null
          temperature_controlled?: boolean | null
          weight_capacity_lbs?: number | null
          zone: string
        }
        Update: {
          aisle?: string | null
          bin_code?: string
          bin_type?: string | null
          business_id?: string
          capacity_cubic_feet?: number | null
          coordinates?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          level?: string | null
          location_id?: string
          shelf?: string | null
          temperature_controlled?: boolean | null
          weight_capacity_lbs?: number | null
          zone?: string
        }
        Relationships: []
      }
      warehouse_tasks: {
        Row: {
          actual_duration: number | null
          assigned_to: string | null
          business_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string | null
          estimated_duration: number | null
          id: string
          location_id: string
          notes: string | null
          priority: string | null
          reference_id: string | null
          reference_type: string | null
          started_at: string | null
          status: string
          task_number: string
          task_type: string
          updated_at: string | null
        }
        Insert: {
          actual_duration?: number | null
          assigned_to?: string | null
          business_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          location_id: string
          notes?: string | null
          priority?: string | null
          reference_id?: string | null
          reference_type?: string | null
          started_at?: string | null
          status?: string
          task_number: string
          task_type: string
          updated_at?: string | null
        }
        Update: {
          actual_duration?: number | null
          assigned_to?: string | null
          business_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          location_id?: string
          notes?: string | null
          priority?: string | null
          reference_id?: string | null
          reference_type?: string | null
          started_at?: string | null
          status?: string
          task_number?: string
          task_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ai_audit_ledger: {
        Row: {
          activity_type: string | null
          id: string | null
          processed_at: string | null
          reward_amount: number | null
          user_id: string | null
        }
        Insert: {
          activity_type?: string | null
          id?: string | null
          processed_at?: string | null
          reward_amount?: number | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string | null
          id?: string | null
          processed_at?: string | null
          reward_amount?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_reality_view: {
        Row: {
          current_war_chest: number | null
          system_integrity_score: number | null
          total_biometric_records: number | null
        }
        Relationships: []
      }
      gl_journal_entries: {
        Row: {
          account: string | null
          amount: number | null
          business_id: string | null
          created_at: string | null
          id: string | null
          metadata: Json | null
        }
        Insert: {
          account?: string | null
          amount?: never
          business_id?: never
          created_at?: string | null
          id?: string | null
          metadata?: Json | null
        }
        Update: {
          account?: string | null
          amount?: never
          business_id?: never
          created_at?: string | null
          id?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      global_reality_manifest: {
        Row: {
          actual_row_count: number | null
          anchored_census_count: number | null
          chronic_hrv_avg: number | null
          lifetime_steps: number | null
          war_chest_total: number | null
        }
        Relationships: []
      }
      idia_schema_manifest: {
        Row: {
          column_default: string | null
          column_name: unknown
          data_type: string | null
          is_nullable: string | null
          table_name: unknown
        }
        Relationships: []
      }
      library_actuals: {
        Row: {
          data_category: string | null
          total_records: number | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          aca_secured: boolean | null
          address: string | null
          assigned_locations: string[] | null
          business_id: string | null
          city: string | null
          created_at: string | null
          direct_deposit_enabled: boolean | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string | null
          is_ephemeral: boolean | null
          last_login: string | null
          name: string | null
          notes: string | null
          overtime_rate: number | null
          pay_frequency: string | null
          permission_template_id: string | null
          permissions: Json | null
          phone: string | null
          platform_role: string | null
          role: string | null
          salary_type: string | null
          state: string | null
          status: string | null
          tax_filing_status: string | null
          updated_at: string | null
          user_id: string | null
          zip: string | null
        }
        Insert: {
          aca_secured?: boolean | null
          address?: string | null
          assigned_locations?: string[] | null
          business_id?: string | null
          city?: string | null
          created_at?: string | null
          direct_deposit_enabled?: boolean | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string | null
          is_ephemeral?: boolean | null
          last_login?: string | null
          name?: string | null
          notes?: string | null
          overtime_rate?: number | null
          pay_frequency?: string | null
          permission_template_id?: string | null
          permissions?: Json | null
          phone?: string | null
          platform_role?: string | null
          role?: string | null
          salary_type?: string | null
          state?: string | null
          status?: string | null
          tax_filing_status?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          aca_secured?: boolean | null
          address?: string | null
          assigned_locations?: string[] | null
          business_id?: string | null
          city?: string | null
          created_at?: string | null
          direct_deposit_enabled?: boolean | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string | null
          is_ephemeral?: boolean | null
          last_login?: string | null
          name?: string | null
          notes?: string | null
          overtime_rate?: number | null
          pay_frequency?: string | null
          permission_template_id?: string | null
          permissions?: Json | null
          phone?: string | null
          platform_role?: string | null
          role?: string | null
          salary_type?: string | null
          state?: string | null
          status?: string | null
          tax_filing_status?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      team_schedules: {
        Row: {
          break_minutes: number | null
          business_id: string | null
          created_at: string | null
          end_time: string | null
          id: string | null
          location: string | null
          notes: string | null
          schedule_date: string | null
          start_time: string | null
          status: string | null
          team_member_id: string | null
        }
        Insert: {
          break_minutes?: number | null
          business_id?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string | null
          location?: string | null
          notes?: string | null
          schedule_date?: string | null
          start_time?: string | null
          status?: string | null
          team_member_id?: string | null
        }
        Update: {
          break_minutes?: number | null
          business_id?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string | null
          location?: string | null
          notes?: string | null
          schedule_date?: string | null
          start_time?: string | null
          status?: string | null
          team_member_id?: string | null
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          break_minutes: number | null
          business_id: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          id: string | null
          location: string | null
          notes: string | null
          overtime_hours: number | null
          status: string | null
          team_member_id: string | null
          total_hours: number | null
        }
        Insert: {
          break_minutes?: number | null
          business_id?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          id?: string | null
          location?: string | null
          notes?: string | null
          overtime_hours?: number | null
          status?: string | null
          team_member_id?: string | null
          total_hours?: number | null
        }
        Update: {
          break_minutes?: number | null
          business_id?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          id?: string | null
          location?: string | null
          notes?: string | null
          overtime_hours?: number | null
          status?: string | null
          team_member_id?: string | null
          total_hours?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      anonymize_location: {
        Args: { lat: number; lng: number }
        Returns: string
      }
      apply_usdc_delta: {
        Args: {
          p_block_number?: number
          p_micro_delta: number
          p_user_id: string
        }
        Returns: number
      }
      calculate_business_health_index: {
        Args: { p_business_id: string; p_location_id?: string }
        Returns: number
      }
      calculate_comprehensive_data_quality_score: {
        Args: {
          p_basic_metrics_count?: number
          p_clinical_data?: boolean
          p_nutrition_count?: number
          p_sleep_data?: boolean
          p_symptoms_count?: number
          p_vitals_count?: number
        }
        Returns: number
      }
      calculate_data_quality_score: {
        Args: {
          p_distance: number
          p_duration: number
          p_elevation: number
          p_heartrate: number
        }
        Returns: number
      }
      check_raw_health_data_duplicate: {
        Args: { p_recorded_at: string; p_step_count: number; p_user_id: string }
        Returns: boolean
      }
      commit_sovereign_handshake: {
        Args: { p_user_id: string; p_wallet_address: string }
        Returns: boolean
      }
      community_pool_ledger: {
        Args: { p_fiat_amount: number; p_pseudo_id: string }
        Returns: undefined
      }
      decrement_hub_cash: {
        Args: { amount_to_deduct: number; target_user_id: string }
        Returns: undefined
      }
      deduct_synapse_credit: {
        Args: { amount_to_deduct: number; target_enterprise_id: string }
        Returns: undefined
      }
      distribute_data_royalty: {
        Args: {
          p_amount: number
          p_description: string
          p_metadata: Json
          p_user_id: string
        }
        Returns: number
      }
      generate_business_provisioning_code: { Args: never; Returns: string }
      generate_pseudonym:
        | { Args: { input_id: string }; Returns: string }
        | { Args: { input_text: string }; Returns: string }
      get_all_user_health_data: {
        Args: { p_user_id: string }
        Returns: {
          activity_type: string
          calories_burned: number
          device_type: string
          distance_meters: number
          duration_seconds: number
          heart_rate: number
          processed_at: string
          processing_status: string
          raw_data: Json
          record_id: string
          recorded_at: string
          reward_amount: number
          source_table: string
          step_count: number
          user_id: string
        }[]
      }
      get_average_rating: { Args: { p_ratee_id: string }; Returns: number }
      get_hub_balance: { Args: { uid: string }; Returns: number }
      get_real_library_yield: {
        Args: never
        Returns: {
          category: string
          count: number
        }[]
      }
      get_synapse_balance: { Args: { uid: string }; Returns: number }
      get_user_business_access: {
        Args: { p_user_id: string }
        Returns: {
          business_id: string
        }[]
      }
      get_user_business_role: {
        Args: { p_business_id: string; p_user_id: string }
        Returns: {
          permissions: Json
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      get_user_id_from_pseudonym: {
        Args: { p_pseudo_id: string }
        Returns: string
      }
      grant_hat: {
        Args: { _hat_type: string; _target_user: string }
        Returns: string
      }
      has_business_access: { Args: { p_business_id: string }; Returns: boolean }
      has_hat: {
        Args: { _hat_type: string; _user_id: string }
        Returns: boolean
      }
      increment_community_pool: {
        Args: { p_fiat_amount: number; p_pool_type: string }
        Returns: undefined
      }
      increment_fiat_balance: {
        Args: { amount_to_add: number; target_user_id: string }
        Returns: undefined
      }
      increment_idia_beta_balance: {
        Args: { increment_amount: number; x_user_id: string }
        Returns: undefined
      }
      increment_idia_life_balance: {
        Args: { p_fiat_amount: number; p_pseudo_id: string }
        Returns: undefined
      }
      increment_life_cash: {
        Args: { amount_to_add: number; target_user_id: string }
        Returns: undefined
      }
      increment_wallet_balance: {
        Args: { increment_amount: number; target_user_id: string }
        Returns: undefined
      }
      increment_wallet_cash: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      invoke_central_cashier: {
        Args: {
          funding_pipe: string
          ref_id: string
          synapse_units: number
          target_user_id: string
          usd_amount_fbo: number
        }
        Returns: Json
      }
      invoke_refiner_secure: { Args: { payload: Json }; Returns: undefined }
      is_business_manager: { Args: { _business_id: string }; Returns: boolean }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
      is_csuite: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin: { Args: { _business_id: string }; Returns: boolean }
      log_delt_egress: {
        Args: {
          p_aca_hash: string
          p_client_id: string
          p_egress_type: string
          p_liability_hash: string
          p_metadata: Json
          p_user_id: string
        }
        Returns: string
      }
      maintain_real_time_signals: { Args: never; Returns: undefined }
      process_idia_telemetry: {
        Args: {
          p_credit: number
          p_raw_data: Json
          p_score: number
          p_user_id: string
        }
        Returns: undefined
      }
      process_stuck_raw_data: {
        Args: never
        Returns: {
          error_count: number
          processed_count: number
        }[]
      }
      provision_business_from_request: {
        Args: { p_request_id: string; p_vertical_id: string }
        Returns: undefined
      }
      provision_employee_via_aca: {
        Args: {
          _business_id: string
          _platform_guid: string
          _platform_role: string
        }
        Returns: {
          aca_secured: boolean
          address: string | null
          assigned_locations: string[] | null
          business_id: string
          city: string | null
          created_at: string
          direct_deposit_enabled: boolean | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          is_ephemeral: boolean
          job_title: string | null
          last_login: string | null
          name: string
          notes: string | null
          overtime_rate: number | null
          pay_frequency: string | null
          permission_template_id: string | null
          permissions: Json | null
          phone: string | null
          platform_role: string
          role: string
          salary_type: string | null
          state: string | null
          status: string
          tax_filing_status: string | null
          updated_at: string
          user_id: string | null
          zip: string | null
        }
        SetofOptions: {
          from: "*"
          to: "employees"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      provision_ephemeral_employee: {
        Args: { _business_id: string }
        Returns: {
          aca_secured: boolean
          address: string | null
          assigned_locations: string[] | null
          business_id: string
          city: string | null
          created_at: string
          direct_deposit_enabled: boolean | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          is_ephemeral: boolean
          job_title: string | null
          last_login: string | null
          name: string
          notes: string | null
          overtime_rate: number | null
          pay_frequency: string | null
          permission_template_id: string | null
          permissions: Json | null
          phone: string | null
          platform_role: string
          role: string
          salary_type: string | null
          state: string | null
          status: string
          tax_filing_status: string | null
          updated_at: string
          user_id: string | null
          zip: string | null
        }
        SetofOptions: {
          from: "*"
          to: "employees"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_employee: {
        Args: { _employee_id: string }
        Returns: {
          aca_secured: boolean
          address: string | null
          assigned_locations: string[] | null
          business_id: string
          city: string | null
          created_at: string
          direct_deposit_enabled: boolean | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          is_ephemeral: boolean
          job_title: string | null
          last_login: string | null
          name: string
          notes: string | null
          overtime_rate: number | null
          pay_frequency: string | null
          permission_template_id: string | null
          permissions: Json | null
          phone: string | null
          platform_role: string
          role: string
          salary_type: string | null
          state: string | null
          status: string
          tax_filing_status: string | null
          updated_at: string
          user_id: string | null
          zip: string | null
        }
        SetofOptions: {
          from: "*"
          to: "employees"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_usdc_balance: {
        Args: {
          p_block_number: number
          p_micro_balance: number
          p_user_id: string
        }
        Returns: undefined
      }
      settle_sovereign_transaction: {
        Args: {
          amount_to_move: number
          silo_target: string
          target_user_id: string
        }
        Returns: undefined
      }
      settle_synapse_consumption:
        | {
            Args: {
              p_aca_hashes: string[]
              p_agent_type: string
              p_liability_hash: string
              p_pseudo_id: string
              p_weight_coefficient: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_aca_hashes: string[]
              p_agent_type: string
              p_liability_hash: string
              p_pseudo_id: string
              p_weight_coefficient: number
            }
            Returns: Json
          }
      submit_variance_correction: {
        Args: {
          _corrective_action: string
          _manager_pin: string
          _root_cause: string
          _variance_id: string
        }
        Returns: string
      }
      trigger_daily_apple_health_sync: {
        Args: never
        Returns: {
          request_id: number
        }[]
      }
      update_raw_health_data_status: {
        Args: {
          p_error_message?: string
          p_record_id: string
          p_status: string
        }
        Returns: undefined
      }
      user_has_permission: {
        Args: { p_permission_name: string; p_user_id: string }
        Returns: boolean
      }
      validate_nfc_signature: {
        Args: {
          p_signature: string
          p_transaction_data: Json
          p_wallet_address: string
        }
        Returns: boolean
      }
    }
    Enums: {
      idia_account_type: "individual" | "business" | "enterprise"
      idia_pay_role: "org_admin" | "team_lead" | "team_member"
      idia_saas_tier:
        | "free"
        | "pro"
        | "pro_plus"
        | "pure_alpha"
        | "analyst"
        | "professional"
        | "enterprise"
      idia_transaction_status: "pending" | "settled" | "failed" | "completed"
      idia_transaction_type:
        | "data_sale"
        | "deposit"
        | "withdrawal"
        | "fee"
        | "reward"
        | "settlement"
        | "fbo_dissemination"
        | "free_compute"
        | "internal_deposit"
        | "data_sale_payout"
        | "ecosystem_war_chest"
        | "hub_protocol_fee"
        | "synapse_purchase"
      sync_status: "pending" | "processing" | "completed" | "failed"
      user_role: "leadership" | "manager" | "employee" | "csuite"
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
      idia_account_type: ["individual", "business", "enterprise"],
      idia_pay_role: ["org_admin", "team_lead", "team_member"],
      idia_saas_tier: [
        "free",
        "pro",
        "pro_plus",
        "pure_alpha",
        "analyst",
        "professional",
        "enterprise",
      ],
      idia_transaction_status: ["pending", "settled", "failed", "completed"],
      idia_transaction_type: [
        "data_sale",
        "deposit",
        "withdrawal",
        "fee",
        "reward",
        "settlement",
        "fbo_dissemination",
        "free_compute",
        "internal_deposit",
        "data_sale_payout",
        "ecosystem_war_chest",
        "hub_protocol_fee",
        "synapse_purchase",
      ],
      sync_status: ["pending", "processing", "completed", "failed"],
      user_role: ["leadership", "manager", "employee", "csuite"],
    },
  },
} as const
