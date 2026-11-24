// Database contract for the project-owned Node API.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          icon: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          icon?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          icon?: string | null;
        };
        Relationships: [];
      };
      customer_debts: {
        Row: {
          exchange_rate: number | null;
          amount: number;
          bill_no: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          customer_id: string;
          date: string;
          description: string | null;
          id: string;
        };
        Insert: {
          exchange_rate?: number | null;
          amount: number;
          bill_no?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          customer_id: string;
          date?: string;
          description?: string | null;
          id?: string;
        };
        Update: {
          exchange_rate?: number | null;
          amount?: number;
          bill_no?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          customer_id?: string;
          date?: string;
          description?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_debts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_balances";
            referencedColumns: ["customer_id"];
          },
          {
            foreignKeyName: "customer_debts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_payments: {
        Row: {
          exchange_rate: number | null;
          amount: number;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          customer_id: string;
          date: string;
          debt_id: string | null;
          id: string;
          note: string | null;
          sale_id: string | null;
        };
        Insert: {
          exchange_rate?: number | null;
          amount: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          customer_id: string;
          date?: string;
          debt_id?: string | null;
          id?: string;
          note?: string | null;
          sale_id?: string | null;
        };
        Update: {
          exchange_rate?: number | null;
          amount?: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          customer_id?: string;
          date?: string;
          debt_id?: string | null;
          id?: string;
          note?: string | null;
          sale_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_balances";
            referencedColumns: ["customer_id"];
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_debt_id_fkey";
            columns: ["debt_id"];
            isOneToOne: false;
            referencedRelation: "customer_debts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          exchange_rate: number | null;
          active: boolean;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          name: string;
          phone: string | null;
          position: string | null;
          salary: number;
        };
        Insert: {
          exchange_rate?: number | null;
          active?: boolean;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          name: string;
          phone?: string | null;
          position?: string | null;
          salary?: number;
        };
        Update: {
          exchange_rate?: number | null;
          active?: boolean;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          name?: string;
          phone?: string | null;
          position?: string | null;
          salary?: number;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          exchange_rate: number | null;
          expense_type: "expense" | "withdrawal";
          person_name: string | null;
          amount: number;
          category_id: string | null;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          date: string;
          description: string | null;
          id: string;
          rate: number;
        };
        Insert: {
          exchange_rate?: number | null;
          expense_type?: "expense" | "withdrawal";
          person_name?: string | null;
          amount: number;
          category_id?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          description?: string | null;
          id?: string;
          rate?: number;
        };
        Update: {
          exchange_rate?: number | null;
          expense_type?: "expense" | "withdrawal";
          person_name?: string | null;
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          description?: string | null;
          id?: string;
          rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          code: string;
          created_at: string;
          grp: string;
          is_system: boolean;
          label: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          grp?: string;
          is_system?: boolean;
          label: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          grp?: string;
          is_system?: boolean;
          label?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          exchange_rate: number | null;
          category_id: string | null;
          code: string | null;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          min_stock: number;
          name: string;
          notes: string | null;
          pack_size: number;
          pack_unit: string | null;
          sell_price: number;
          unit: string;
        };
        Insert: {
          exchange_rate?: number | null;
          category_id?: string | null;
          code?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          min_stock?: number;
          name: string;
          notes?: string | null;
          pack_size?: number;
          pack_unit?: string | null;
          sell_price?: number;
          unit?: string;
        };
        Update: {
          exchange_rate?: number | null;
          category_id?: string | null;
          code?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          min_stock?: number;
          name?: string;
          notes?: string | null;
          pack_size?: number;
          pack_unit?: string | null;
          sell_price?: number;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      purchase_items: {
        Row: {
          id: string;
          pack_size: number | null;
          pieces: number | null;
          product_id: string;
          purchase_id: string;
          qty: number;
          unit_kind: string;
          unit_price: number;
        };
        Insert: {
          id?: string;
          pack_size?: number | null;
          pieces?: number | null;
          product_id: string;
          purchase_id: string;
          qty: number;
          unit_kind?: string;
          unit_price: number;
        };
        Update: {
          id?: string;
          pack_size?: number | null;
          pieces?: number | null;
          product_id?: string;
          purchase_id?: string;
          qty?: number;
          unit_kind?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      purchases: {
        Row: {
          exchange_rate: number | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          date: string;
          id: string;
          invoice_code: string | null;
          invoice_no: number;
          location: string;
          notes: string | null;
          paid: number;
          rate: number;
          supplier_id: string | null;
          total: number;
        };
        Insert: {
          exchange_rate?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          id?: string;
          invoice_code?: string | null;
          invoice_no?: number;
          location?: string;
          notes?: string | null;
          paid?: number;
          rate?: number;
          supplier_id?: string | null;
          total?: number;
        };
        Update: {
          exchange_rate?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          id?: string;
          invoice_code?: string | null;
          invoice_no?: number;
          location?: string;
          notes?: string | null;
          paid?: number;
          rate?: number;
          supplier_id?: string | null;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_balances";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_system: boolean;
          name: string;
          permissions: string[];
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name: string;
          permissions?: string[];
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name?: string;
          permissions?: string[];
        };
        Relationships: [];
      };
      salary_payments: {
        Row: {
          exchange_rate: number | null;
          payment_type: "salary" | "advance";
          amount: number;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          date: string;
          employee_id: string;
          id: string;
          note: string | null;
          period: string | null;
          rate: number;
        };
        Insert: {
          exchange_rate?: number | null;
          payment_type?: "salary" | "advance";
          amount: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          employee_id: string;
          id?: string;
          note?: string | null;
          period?: string | null;
          rate?: number;
        };
        Update: {
          exchange_rate?: number | null;
          payment_type?: "salary" | "advance";
          amount?: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          employee_id?: string;
          id?: string;
          note?: string | null;
          period?: string | null;
          rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "salary_payments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_items: {
        Row: {
          id: string;
          pieces: number | null;
          product_id: string;
          qty: number;
          sale_id: string;
          unit_cost_afn: number;
          unit_kind: string;
          unit_price: number;
        };
        Insert: {
          id?: string;
          pieces?: number | null;
          product_id: string;
          qty: number;
          sale_id: string;
          unit_cost_afn?: number;
          unit_kind?: string;
          unit_price: number;
        };
        Update: {
          id?: string;
          pieces?: number | null;
          product_id?: string;
          qty?: number;
          sale_id?: string;
          unit_cost_afn?: number;
          unit_kind?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          exchange_rate: number | null;
          settlement_supplier_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          walk_in_name: string | null;
          walk_in_address: string | null;
          customer_id: string | null;
          date: string;
          discount: number;
          id: string;
          invoice_code: string | null;
          invoice_no: number;
          notes: string | null;
          paid: number;
          rate: number;
          total: number;
        };
        Insert: {
          exchange_rate?: number | null;
          settlement_supplier_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          walk_in_name?: string | null;
          walk_in_address?: string | null;
          customer_id?: string | null;
          date?: string;
          discount?: number;
          id?: string;
          invoice_code?: string | null;
          invoice_no?: number;
          notes?: string | null;
          paid?: number;
          rate?: number;
          total?: number;
        };
        Update: {
          exchange_rate?: number | null;
          settlement_supplier_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          walk_in_name?: string | null;
          walk_in_address?: string | null;
          customer_id?: string | null;
          date?: string;
          discount?: number;
          id?: string;
          invoice_code?: string | null;
          invoice_no?: number;
          notes?: string | null;
          paid?: number;
          rate?: number;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_balances";
            referencedColumns: ["customer_id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          sale_invoice_prefix: string;
          purchase_invoice_prefix: string;
          invoice_number_digits: number;
          bill_settings: Json | null;
          assistant_enabled: boolean;
          shop_address: string;
          shop_phone: string;
          shop_phone_secondary: string;
          bill_footer: string;
          platform_title: string;
          favicon_data: string | null;
          branding_version: string;
          id: number;
          live_rate: number | null;
          live_rate_at: string | null;
          rate_mode: string;
          shop_name: string;
          updated_at: string;
          usd_to_afn: number;
        };
        Insert: {
          sale_invoice_prefix?: string;
          purchase_invoice_prefix?: string;
          invoice_number_digits?: number;
          bill_settings?: Json | null;
          assistant_enabled?: boolean;
          shop_address?: string;
          shop_phone?: string;
          shop_phone_secondary?: string;
          bill_footer?: string;
          platform_title?: string;
          favicon_data?: string | null;
          branding_version?: string;
          id?: number;
          live_rate?: number | null;
          live_rate_at?: string | null;
          rate_mode?: string;
          shop_name?: string;
          updated_at?: string;
          usd_to_afn?: number;
        };
        Update: {
          sale_invoice_prefix?: string;
          purchase_invoice_prefix?: string;
          invoice_number_digits?: number;
          bill_settings?: Json | null;
          assistant_enabled?: boolean;
          shop_address?: string;
          shop_phone?: string;
          shop_phone_secondary?: string;
          bill_footer?: string;
          platform_title?: string;
          favicon_data?: string | null;
          branding_version?: string;
          id?: number;
          live_rate?: number | null;
          live_rate_at?: string | null;
          rate_mode?: string;
          shop_name?: string;
          updated_at?: string;
          usd_to_afn?: number;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          exchange_rate: number | null;
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          location: string;
          note: string | null;
          product_id: string;
          qty: number;
          ref_id: string | null;
          ref_type: string | null;
          type: string;
          unit_cost_afn: number;
        };
        Insert: {
          exchange_rate?: number | null;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          location?: string;
          note?: string | null;
          product_id: string;
          qty: number;
          ref_id?: string | null;
          ref_type?: string | null;
          type: string;
          unit_cost_afn?: number;
        };
        Update: {
          exchange_rate?: number | null;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          location?: string;
          note?: string | null;
          product_id?: string;
          qty?: number;
          ref_id?: string | null;
          ref_type?: string | null;
          type?: string;
          unit_cost_afn?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_debts: {
        Row: {
          exchange_rate: number | null;
          amount: number;
          bill_no: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          date: string;
          description: string | null;
          id: string;
          supplier_id: string;
        };
        Insert: {
          exchange_rate?: number | null;
          amount: number;
          bill_no?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          description?: string | null;
          id?: string;
          supplier_id: string;
        };
        Update: {
          exchange_rate?: number | null;
          amount?: number;
          bill_no?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          description?: string | null;
          id?: string;
          supplier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_debts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_balances";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "supplier_debts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_payments: {
        Row: {
          exchange_rate: number | null;
          settlement_sale_id: string | null;
          amount: number;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          date: string;
          debt_id: string | null;
          id: string;
          note: string | null;
          purchase_id: string | null;
          supplier_id: string;
        };
        Insert: {
          exchange_rate?: number | null;
          settlement_sale_id?: string | null;
          amount: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          debt_id?: string | null;
          id?: string;
          note?: string | null;
          purchase_id?: string | null;
          supplier_id: string;
        };
        Update: {
          exchange_rate?: number | null;
          settlement_sale_id?: string | null;
          amount?: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          debt_id?: string | null;
          id?: string;
          note?: string | null;
          purchase_id?: string | null;
          supplier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_payments_debt_id_fkey";
            columns: ["debt_id"];
            isOneToOne: false;
            referencedRelation: "supplier_debts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_balances";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          supplier_type: "supplier" | "payee";
          address: string | null;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
        };
        Insert: {
          supplier_type?: "supplier" | "payee";
          address?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
        };
        Update: {
          supplier_type?: "supplier" | "payee";
          address?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          role_id: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          role_id?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          role_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      supplier_invoice_payments: {
        Row: Database["public"]["Tables"]["supplier_payments"]["Row"];
        Relationships: [];
      };
      customer_balances: {
        Row: {
          balance: number | null;
          currency: Database["public"]["Enums"]["currency_code"] | null;
          customer_id: string | null;
        };
        Relationships: [];
      };
      product_stock: {
        Row: {
          avg_cost_afn: number | null;
          last_buy_currency: Database["public"]["Enums"]["currency_code"] | null;
          last_buy_price: number | null;
          product_id: string | null;
          qty: number | null;
          shop_qty: number | null;
          warehouse_qty: number | null;
        };
        Relationships: [];
      };
      supplier_balances: {
        Row: {
          balance: number | null;
          currency: Database["public"]["Enums"]["currency_code"] | null;
          supplier_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      purchase_lines: {
        Args: {
          page?: number;
          export_all?: boolean;
          from?: string;
          to?: string;
          product_id?: string;
          supplier_id?: string;
        };
        Returns: {
          rows: {
            id: string;
            purchase_id: string;
            product_id: string;
            product_name: string;
            supplier_id: string | null;
            supplier_name: string | null;
            invoice_no: number;
            invoice_code?: string | null;
            date: string;
            currency: "AFN" | "USD";
            qty: number;
            pieces: number;
            unit_kind: "piece" | "pack";
            unit_price: number;
            line_total: number;
          }[];
          stats: { total: number; invoices: number; pieces: number; afn: number; usd: number };
          page: number;
          size: number;
        };
      };
      sales_lines: {
        Args: {
          page?: number;
          export_all?: boolean;
          from?: string;
          to?: string;
          product_id?: string;
          customer_id?: string;
        };
        Returns: {
          rows: {
            id: string;
            sale_id: string;
            product_id: string;
            product_name: string;
            customer_id: string | null;
            customer_name: string | null;
            invoice_no: number;
            invoice_code?: string | null;
            date: string;
            currency: "AFN" | "USD";
            qty: number;
            pieces: number;
            unit_kind: "piece" | "pack";
            unit_price: number;
            line_total: number;
          }[];
          stats: { total: number; invoices: number; pieces: number; afn: number; usd: number };
          page: number;
          size: number;
        };
      };
      expense_ledger: {
        Args: {
          page?: number;
          export_all?: boolean;
          from?: string;
          to?: string;
          expense_type?: "expense" | "withdrawal";
          category_id?: string;
          person_name?: string;
          without_person?: boolean;
          today: string;
          month_from: string;
          month_to: string;
        };
        Returns: {
          rows: (Database["public"]["Tables"]["expenses"]["Row"] & {
            category_name: string | null;
          })[];
          people: string[];
          withdrawals: {
            person_name: string;
            count: number;
            afn: number;
            usd: number;
            total_afn: number;
          }[];
          stats: { total: number; total_afn: number; today_afn: number; month_afn: number };
          page: number;
          size: number;
        };
      };
      save_supplier: {
        Args: {
          id?: string;
          payload: {
            name: string;
            phone?: string | null;
            address?: string | null;
            notes?: string | null;
            supplier_type: "supplier" | "payee";
            opening_debt?: {
              exchange_rate?: number | undefined;
              amount: number;
              currency: "AFN" | "USD";
              date: string;
              description?: string;
            };
          };
        };
        Returns: string;
      };
      create_purchase: { Args: { payload: Json }; Returns: string };
      create_sale: { Args: { payload: Json }; Returns: string };
      has_permission: {
        Args: { _perm: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_member: { Args: { _user_id: string }; Returns: boolean };
      report_daily: {
        Args: { _from: string; _to: string };
        Returns: {
          day: string;
          expenses_afn: number;
          profit_afn: number;
          revenue_afn: number;
        }[];
      };
      report_summary: { Args: { _from: string; _to: string }; Returns: Json };
      transfer_stock: {
        Args: {
          _date: string;
          _from: string;
          _note: string;
          _product_id: string;
          _qty: number;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "staff";
      currency_code: "AFN" | "USD";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, never>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      currency_code: ["AFN", "USD"],
    },
  },
} as const;
