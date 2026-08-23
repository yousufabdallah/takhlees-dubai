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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string | null
          account_type: string
          active: boolean
          bank_name: string | null
          created_at: string
          id: string
          name: string
          opening_balance: number
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          active?: boolean
          bank_name?: string | null
          created_at?: string
          id?: string
          name: string
          opening_balance?: number
        }
        Update: {
          account_number?: string | null
          account_type?: string
          active?: boolean
          bank_name?: string | null
          created_at?: string
          id?: string
          name?: string
          opening_balance?: number
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          account_class: string
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          parent_code: string | null
        }
        Insert: {
          account_class: string
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          parent_code?: string | null
        }
        Update: {
          account_class?: string
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          parent_code?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          client_type: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          id_number: string | null
          name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_type?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          id_number?: string | null
          name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_type?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          id_number?: string | null
          name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          client_id: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          transaction_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          transaction_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          transaction_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          commission_rate: number
          created_at: string
          id: string
          job_title: string | null
          name: string
          phone: string | null
          salary: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          commission_rate?: number
          created_at?: string
          id?: string
          job_title?: string | null
          name: string
          phone?: string | null
          salary?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          commission_rate?: number
          created_at?: string
          id?: string
          job_title?: string | null
          name?: string
          phone?: string | null
          salary?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          employee_id: string | null
          expense_date: string
          id: string
          payment_method: string
          receipt_url: string | null
          supplier_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id?: string | null
          expense_date?: string
          id?: string
          payment_method?: string
          receipt_url?: string | null
          supplier_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id?: string | null
          expense_date?: string
          id?: string
          payment_method?: string
          receipt_url?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gov_entities: {
        Row: {
          active: boolean
          code: string | null
          contact_person: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          contact_person?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          contact_person?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          discount: number
          due_date: string | null
          gov_fees: number
          id: string
          invoice_no: string
          issue_date: string
          notes: string | null
          office_fees: number
          paid: number
          status: string
          total: number
          transaction_id: string | null
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          client_id: string
          created_at?: string
          discount?: number
          due_date?: string | null
          gov_fees?: number
          id?: string
          invoice_no?: string
          issue_date?: string
          notes?: string | null
          office_fees?: number
          paid?: number
          status?: string
          total?: number
          transaction_id?: string | null
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          discount?: number
          due_date?: string | null
          gov_fees?: number
          id?: string
          invoice_no?: string
          issue_date?: string
          notes?: string | null
          office_fees?: number
          paid?: number
          status?: string
          total?: number
          transaction_id?: string | null
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          id: string
          reference: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          reference?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          reference?: string | null
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_code: string
          account_name: string | null
          credit: number
          debit: number
          entry_id: string
          id: string
        }
        Insert: {
          account_code: string
          account_name?: string | null
          credit?: number
          debit?: number
          entry_id: string
          id?: string
        }
        Update: {
          account_code?: string
          account_name?: string | null
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      office_settings: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          invoice_footer: string | null
          legal_name: string
          legal_name_en: string | null
          license_no: string | null
          logo_url: string | null
          phone: string | null
          trn: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invoice_footer?: string | null
          legal_name?: string
          legal_name_en?: string | null
          license_no?: string | null
          logo_url?: string | null
          phone?: string | null
          trn?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invoice_footer?: string | null
          legal_name?: string
          legal_name_en?: string | null
          license_no?: string | null
          logo_url?: string | null
          phone?: string | null
          trn?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
      payroll_entries: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          entry_date: string
          entry_type: string
          id: string
          notes: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          entry_date?: string
          entry_type?: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          entry_date?: string
          entry_type?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          balance: number
          category: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          balance?: number
          category?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          balance?: number
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      transaction_types: {
        Row: {
          active: boolean
          created_at: string
          default_gov_fee: number
          default_office_fee: number
          entity_id: string | null
          gov_entity: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_gov_fee?: number
          default_office_fee?: number
          entity_id?: string | null
          gov_entity?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_gov_fee?: number
          default_office_fee?: number
          entity_id?: string | null
          gov_entity?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_types_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "gov_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          discount: number
          employee_id: string | null
          gov_entity: string | null
          gov_fee: number
          gov_fee_paid: boolean
          gov_fee_paid_at: string | null
          id: string
          notes: string | null
          office_fee: number
          opened_at: string
          payment_method: string
          ref_no: string
          status: string
          type_id: string | null
          type_name: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          employee_id?: string | null
          gov_entity?: string | null
          gov_fee?: number
          gov_fee_paid?: boolean
          gov_fee_paid_at?: string | null
          id?: string
          notes?: string | null
          office_fee?: number
          opened_at?: string
          payment_method?: string
          ref_no?: string
          status?: string
          type_id?: string | null
          type_name: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          employee_id?: string | null
          gov_entity?: string | null
          gov_fee?: number
          gov_fee_paid?: boolean
          gov_fee_paid_at?: string | null
          id?: string
          notes?: string | null
          office_fee?: number
          opened_at?: string
          payment_method?: string
          ref_no?: string
          status?: string
          type_id?: string | null
          type_name?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "transaction_types"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          from_account_id: string
          id: string
          notes: string | null
          to_account_id: string
          transfer_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_account_id: string
          id?: string
          notes?: string | null
          to_account_id: string
          transfer_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_account_id?: string
          id?: string
          notes?: string | null
          to_account_id?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string | null
          gov_entity: string | null
          id: string
          kind: string
          notes: string | null
          reference: string | null
          updated_at: string
          withdraw_date: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          gov_entity?: string | null
          id?: string
          kind?: string
          notes?: string | null
          reference?: string | null
          updated_at?: string
          withdraw_date?: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          gov_entity?: string | null
          id?: string
          kind?: string
          notes?: string | null
          reference?: string | null
          updated_at?: string
          withdraw_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "accountant" | "staff"
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
      app_role: ["admin", "accountant", "staff"],
    },
  },
} as const
