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
      agency_clients: {
        Row: {
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_projects: {
        Row: {
          archived_at: string | null
          auto_renew: boolean
          billing_cycle:
            | Database["public"]["Enums"]["agency_billing_cycle"]
            | null
          budget: number
          client_id: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          engagement_model: Database["public"]["Enums"]["agency_engagement_model"]
          id: string
          monthly_retainer: number
          name: string
          next_invoice_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["agency_project_status"]
          type: Database["public"]["Enums"]["agency_project_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          auto_renew?: boolean
          billing_cycle?:
            | Database["public"]["Enums"]["agency_billing_cycle"]
            | null
          budget?: number
          client_id?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          engagement_model?: Database["public"]["Enums"]["agency_engagement_model"]
          id?: string
          monthly_retainer?: number
          name: string
          next_invoice_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["agency_project_status"]
          type?: Database["public"]["Enums"]["agency_project_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          auto_renew?: boolean
          billing_cycle?:
            | Database["public"]["Enums"]["agency_billing_cycle"]
            | null
          budget?: number
          client_id?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          engagement_model?: Database["public"]["Enums"]["agency_engagement_model"]
          id?: string
          monthly_retainer?: number
          name?: string
          next_invoice_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["agency_project_status"]
          type?: Database["public"]["Enums"]["agency_project_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          check_in: string
          check_out: string | null
          created_at: string
          id: string
          notes: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
          work_date?: string
        }
        Update: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          cameras_count: number
          capture_device: Database["public"]["Enums"]["capture_device"]
          contact_id: string
          created_at: string
          created_by: string | null
          editing_required: boolean
          ends_at: string
          id: string
          location: string | null
          notes: string | null
          package_id: string | null
          room_id: string | null
          script_ready: boolean
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          cameras_count?: number
          capture_device?: Database["public"]["Enums"]["capture_device"]
          contact_id: string
          created_at?: string
          created_by?: string | null
          editing_required?: boolean
          ends_at: string
          id?: string
          location?: string | null
          notes?: string | null
          package_id?: string | null
          room_id?: string | null
          script_ready?: boolean
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          cameras_count?: number
          capture_device?: Database["public"]["Enums"]["capture_device"]
          contact_id?: string
          created_at?: string
          created_by?: string | null
          editing_required?: boolean
          ends_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          package_id?: string | null
          room_id?: string | null
          script_ready?: boolean
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "studio_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          booking_id: string | null
          business_date: string
          cashbox_id: string
          category: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          direction: Database["public"]["Enums"]["cash_direction"]
          id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          business_date?: string
          cashbox_id: string
          category?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["cash_direction"]
          id?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          business_date?: string
          cashbox_id?: string
          category?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["cash_direction"]
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_cashbox_id_fkey"
            columns: ["cashbox_id"]
            isOneToOne: false
            referencedRelation: "cashboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      cashboxes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashboxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          code: Database["public"]["Enums"]["company_code"]
          created_at: string
          id: string
          name_ar: string
          name_en: string
        }
        Insert: {
          code: Database["public"]["Enums"]["company_code"]
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
        }
        Update: {
          code?: Database["public"]["Enums"]["company_code"]
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      contact_history: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_manager_id: string | null
          address: string | null
          avatar_url: string | null
          billing_address: string | null
          billing_company_name: string | null
          billing_tax_id: string | null
          birthday: string | null
          city: string | null
          company_id: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          currency: string | null
          discount_pct: number | null
          email: string | null
          facebook: string | null
          first_contact_date: string | null
          full_name: string
          gender: string | null
          id: string
          industry: string | null
          instagram: string | null
          internal_notes: string | null
          job_title: string | null
          lead_status: string | null
          lifecycle_stage: string | null
          linkedin: string | null
          national_id: string | null
          nationality: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          preferred_contact_method: string | null
          preferred_language: string | null
          priority_level: string | null
          rating: number | null
          social_handle: string | null
          source: string | null
          tags: string[]
          tiktok: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
          website: string | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          account_manager_id?: string | null
          address?: string | null
          avatar_url?: string | null
          billing_address?: string | null
          billing_company_name?: string | null
          billing_tax_id?: string | null
          birthday?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency?: string | null
          discount_pct?: number | null
          email?: string | null
          facebook?: string | null
          first_contact_date?: string | null
          full_name: string
          gender?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          internal_notes?: string | null
          job_title?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          linkedin?: string | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_language?: string | null
          priority_level?: string | null
          rating?: number | null
          social_handle?: string | null
          source?: string | null
          tags?: string[]
          tiktok?: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          account_manager_id?: string | null
          address?: string | null
          avatar_url?: string | null
          billing_address?: string | null
          billing_company_name?: string | null
          billing_tax_id?: string | null
          birthday?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency?: string | null
          discount_pct?: number | null
          email?: string | null
          facebook?: string | null
          first_contact_date?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          internal_notes?: string | null
          job_title?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          linkedin?: string | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_language?: string | null
          priority_level?: string | null
          rating?: number | null
          social_handle?: string | null
          source?: string | null
          tags?: string[]
          tiktok?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_closings: {
        Row: {
          business_date: string
          cashbox_id: string
          closed_at: string
          closed_by: string | null
          id: string
          net_amount: number
          notes: string | null
          total_in: number
          total_out: number
        }
        Insert: {
          business_date: string
          cashbox_id: string
          closed_at?: string
          closed_by?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          total_in?: number
          total_out?: number
        }
        Update: {
          business_date?: string
          cashbox_id?: string
          closed_at?: string
          closed_by?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          total_in?: number
          total_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_closings_cashbox_id_fkey"
            columns: ["cashbox_id"]
            isOneToOne: false
            referencedRelation: "cashboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      department_members: {
        Row: {
          created_at: string
          department_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: Database["public"]["Enums"]["dept_code"]
          company_id: string
          created_at: string
          id: string
          name_ar: string
          name_en: string
        }
        Insert: {
          code: Database["public"]["Enums"]["dept_code"]
          company_id: string
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
        }
        Update: {
          code?: Database["public"]["Enums"]["dept_code"]
          company_id?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name_ar: string
          name_en: string
          notes: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          notes?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          notes?: string | null
        }
        Relationships: []
      }
      freelancers: {
        Row: {
          availability: string | null
          avatar_url: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          behance_url: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          email: string | null
          full_name: string
          iban: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          languages: string | null
          linkedin_url: string | null
          notes: string | null
          payment_method: string | null
          phone: string | null
          portfolio_url: string | null
          preferred_contact: string | null
          rate_amount: number | null
          rate_kind: Database["public"]["Enums"]["freelancer_rate_kind"]
          rating: number | null
          scope: Database["public"]["Enums"]["freelancer_scope"]
          skills: string[] | null
          specialty: Database["public"]["Enums"]["freelancer_specialty"]
          updated_at: string
          wallet_number: string | null
          wallet_provider: string | null
          years_experience: number | null
        }
        Insert: {
          availability?: string | null
          avatar_url?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          behance_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          email?: string | null
          full_name: string
          iban?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          languages?: string | null
          linkedin_url?: string | null
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          portfolio_url?: string | null
          preferred_contact?: string | null
          rate_amount?: number | null
          rate_kind?: Database["public"]["Enums"]["freelancer_rate_kind"]
          rating?: number | null
          scope?: Database["public"]["Enums"]["freelancer_scope"]
          skills?: string[] | null
          specialty?: Database["public"]["Enums"]["freelancer_specialty"]
          updated_at?: string
          wallet_number?: string | null
          wallet_provider?: string | null
          years_experience?: number | null
        }
        Update: {
          availability?: string | null
          avatar_url?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          behance_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          email?: string | null
          full_name?: string
          iban?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          languages?: string | null
          linkedin_url?: string | null
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          portfolio_url?: string | null
          preferred_contact?: string | null
          rate_amount?: number | null
          rate_kind?: Database["public"]["Enums"]["freelancer_rate_kind"]
          rating?: number | null
          scope?: Database["public"]["Enums"]["freelancer_scope"]
          skills?: string[] | null
          specialty?: Database["public"]["Enums"]["freelancer_specialty"]
          updated_at?: string
          wallet_number?: string | null
          wallet_provider?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          company_id: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          paid?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          kind: string | null
          link: string | null
          priority: string
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string | null
          link?: string | null
          priority?: string
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string | null
          link?: string | null
          priority?: string
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          method: string | null
          notes: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          emergency_contact: string | null
          id: string
          is_active: boolean
          job_title: string | null
          join_date: string | null
          name_ar: string | null
          phone: string | null
          primary_department_id: string | null
          skills: string[] | null
          updated_at: string
          username: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          emergency_contact?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          join_date?: string | null
          name_ar?: string | null
          phone?: string | null
          primary_department_id?: string | null
          skills?: string[] | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          emergency_contact?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          join_date?: string | null
          name_ar?: string | null
          phone?: string | null
          primary_department_id?: string | null
          skills?: string[] | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_department_id_fkey"
            columns: ["primary_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      project_calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_type: string
          id: string
          location: string | null
          project_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          project_id: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          project_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_chat_messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          project_id: string
          reply_to: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          project_id: string
          reply_to?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          reply_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "project_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          amount: number
          cash_movement_id: string | null
          created_at: string
          created_by: string | null
          expense_date: string
          freelancer_id: string | null
          id: string
          kind: Database["public"]["Enums"]["project_expense_kind"]
          notes: string | null
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          cash_movement_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          freelancer_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["project_expense_kind"]
          notes?: string | null
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_movement_id?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          freelancer_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["project_expense_kind"]
          notes?: string | null
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_cash_movement_id_fkey"
            columns: ["cash_movement_id"]
            isOneToOne: false
            referencedRelation: "cash_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          agreed_amount: number
          created_at: string
          freelancer_id: string | null
          id: string
          kind: Database["public"]["Enums"]["project_member_kind"]
          notes: string | null
          paid_amount: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          project_id: string
          role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agreed_amount?: number
          created_at?: string
          freelancer_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["project_member_kind"]
          notes?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          project_id: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agreed_amount?: number
          created_at?: string
          freelancer_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["project_member_kind"]
          notes?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          project_id?: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          order_index: number
          progress: number
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          progress?: number
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          progress?: number
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          author_id: string
          color: string | null
          content: string | null
          created_at: string
          id: string
          pinned: boolean
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          color?: string | null
          content?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          color?: string | null
          content?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_risks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          impact: string
          project_id: string
          resolution: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          impact?: string
          project_id: string
          resolution?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          impact?: string
          project_id?: string
          resolution?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_entries: {
        Row: {
          billable: boolean
          created_at: string
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          project_id: string
          started_at: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          project_id: string
          started_at: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          project_id?: string
          started_at?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "agency_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          id: string
          name_ar: string
          name_en: string
          notes: string | null
          reels_only: boolean
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          notes?: string | null
          reels_only?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          notes?: string | null
          reels_only?: boolean
        }
        Relationships: []
      }
      studio_packages: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          next_collection_date: string | null
          notes: string | null
          paid_amount: number
          total_amount: number
          total_hours: number
          updated_at: string
          used_hours: number
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          next_collection_date?: string | null
          notes?: string | null
          paid_amount?: number
          total_amount?: number
          total_hours?: number
          updated_at?: string
          used_hours?: number
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          next_collection_date?: string | null
          notes?: string | null
          paid_amount?: number
          total_amount?: number
          total_hours?: number
          updated_at?: string
          used_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "studio_packages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          task_id: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          task_id: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          created_at: string
          created_by: string | null
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          position: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          position?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          attachments: Json
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_internal_notes: {
        Row: {
          notes: string | null
          task_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          notes?: string | null
          task_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          notes?: string | null
          task_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_internal_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_label_map: {
        Row: {
          label_id: string
          task_id: string
        }
        Insert: {
          label_id: string
          task_id: string
        }
        Update: {
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_map_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "task_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_map_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_references: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          task_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          task_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          task_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_references_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["task_status"] | null
          id: string
          notes: string | null
          task_id: string
          to_status: Database["public"]["Enums"]["task_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          notes?: string | null
          task_id: string
          to_status: Database["public"]["Enums"]["task_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          notes?: string | null
          task_id?: string
          to_status?: Database["public"]["Enums"]["task_status"]
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_watchers: {
        Row: {
          created_at: string
          freelancer_id: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          freelancer_id?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          freelancer_id?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_watchers_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_watchers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          accepted_at: string | null
          approved_at: string | null
          approved_by: string | null
          aspect_ratio: string | null
          assignee_id: string | null
          booking_id: string | null
          client_name: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          delivery_method: string | null
          department_id: string | null
          description: string | null
          due_at: string | null
          estimated_minutes: number | null
          freelancer_id: string | null
          id: string
          platform: string | null
          priority: number
          project_name: string | null
          required_output: string | null
          resolution: string | null
          shooting_ends_at: string | null
          shooting_external_address: string | null
          shooting_location: string | null
          shooting_notes: string | null
          shooting_room_id: string | null
          shooting_starts_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          submitted_at: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          video_duration_post_seconds: number | null
          video_duration_pre_seconds: number | null
          video_type: string | null
        }
        Insert: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          aspect_ratio?: string | null
          assignee_id?: string | null
          booking_id?: string | null
          client_name?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string | null
          department_id?: string | null
          description?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          freelancer_id?: string | null
          id?: string
          platform?: string | null
          priority?: number
          project_name?: string | null
          required_output?: string | null
          resolution?: string | null
          shooting_ends_at?: string | null
          shooting_external_address?: string | null
          shooting_location?: string | null
          shooting_notes?: string | null
          shooting_room_id?: string | null
          shooting_starts_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          submitted_at?: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          video_duration_post_seconds?: number | null
          video_duration_pre_seconds?: number | null
          video_type?: string | null
        }
        Update: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          aspect_ratio?: string | null
          assignee_id?: string | null
          booking_id?: string | null
          client_name?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string | null
          department_id?: string | null
          description?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          freelancer_id?: string | null
          id?: string
          platform?: string | null
          priority?: number
          project_name?: string | null
          required_output?: string | null
          resolution?: string | null
          shooting_ends_at?: string | null
          shooting_external_address?: string | null
          shooting_location?: string | null
          shooting_notes?: string | null
          shooting_room_id?: string | null
          shooting_starts_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          submitted_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          video_duration_post_seconds?: number | null
          video_duration_pre_seconds?: number | null
          video_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_shooting_room_id_fkey"
            columns: ["shooting_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      _notify_users: {
        Args: {
          _body: string
          _category?: string
          _kind: string
          _link: string
          _priority?: string
          _task_id: string
          _title: string
          _user_ids: string[]
        }
        Returns: undefined
      }
      can_access_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_dept_member: {
        Args: {
          _dept: Database["public"]["Enums"]["dept_code"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_reception_or_admin: { Args: { _user_id: string }; Returns: boolean }
      send_task_reminder: { Args: { _task_id: string }; Returns: number }
    }
    Enums: {
      agency_billing_cycle: "monthly" | "quarterly" | "yearly"
      agency_engagement_model: "one_time" | "retainer"
      agency_project_status:
        | "planned"
        | "in_progress"
        | "on_hold"
        | "delivered"
        | "cancelled"
      agency_project_type: "marketing" | "programming" | "mixed"
      app_role:
        | "super_admin"
        | "admin"
        | "dept_manager"
        | "dept_assistant"
        | "staff"
        | "reception"
        | "viewer"
        | "editor"
        | "designer"
        | "photographer"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      capture_device: "camera" | "iphone"
      cash_direction: "in" | "out"
      company_code: "studio" | "agency"
      contact_type: "teacher" | "reel_client" | "service_client"
      dept_code:
        | "teachers"
        | "production"
        | "marketing"
        | "programming"
        | "sales"
        | "reception"
        | "general_accounts"
      freelancer_rate_kind: "hourly" | "fixed" | "per_project"
      freelancer_scope: "studio" | "agency" | "both"
      freelancer_specialty:
        | "programming"
        | "design"
        | "montage"
        | "writing"
        | "ads"
        | "photography"
        | "other"
      invoice_status: "draft" | "sent" | "partial" | "paid" | "void"
      payment_status: "unpaid" | "partial" | "paid"
      project_expense_kind: "freelance" | "tools" | "ads" | "salary" | "other"
      project_member_kind: "staff" | "freelancer"
      task_status:
        | "pending"
        | "started"
        | "progress_50"
        | "in_review"
        | "submitted"
        | "approved"
        | "rejected"
        | "archived"
        | "accepted"
        | "shooting_started"
        | "shooting_done"
        | "uploaded"
        | "completed"
      task_type: "shooting" | "editing" | "design" | "programming" | "marketing"
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
      agency_billing_cycle: ["monthly", "quarterly", "yearly"],
      agency_engagement_model: ["one_time", "retainer"],
      agency_project_status: [
        "planned",
        "in_progress",
        "on_hold",
        "delivered",
        "cancelled",
      ],
      agency_project_type: ["marketing", "programming", "mixed"],
      app_role: [
        "super_admin",
        "admin",
        "dept_manager",
        "dept_assistant",
        "staff",
        "reception",
        "viewer",
        "editor",
        "designer",
        "photographer",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      capture_device: ["camera", "iphone"],
      cash_direction: ["in", "out"],
      company_code: ["studio", "agency"],
      contact_type: ["teacher", "reel_client", "service_client"],
      dept_code: [
        "teachers",
        "production",
        "marketing",
        "programming",
        "sales",
        "reception",
        "general_accounts",
      ],
      freelancer_rate_kind: ["hourly", "fixed", "per_project"],
      freelancer_scope: ["studio", "agency", "both"],
      freelancer_specialty: [
        "programming",
        "design",
        "montage",
        "writing",
        "ads",
        "photography",
        "other",
      ],
      invoice_status: ["draft", "sent", "partial", "paid", "void"],
      payment_status: ["unpaid", "partial", "paid"],
      project_expense_kind: ["freelance", "tools", "ads", "salary", "other"],
      project_member_kind: ["staff", "freelancer"],
      task_status: [
        "pending",
        "started",
        "progress_50",
        "in_review",
        "submitted",
        "approved",
        "rejected",
        "archived",
        "accepted",
        "shooting_started",
        "shooting_done",
        "uploaded",
        "completed",
      ],
      task_type: ["shooting", "editing", "design", "programming", "marketing"],
    },
  },
} as const
