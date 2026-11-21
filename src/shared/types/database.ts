export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      energy_profiles: {
        Row: {
          activity_level: string | null;
          birth_date: string | null;
          daily_intake_target_kcal: number | null;
          formula_sex: string | null;
          height_cm: number | null;
          maintenance_kcal_manual: number | null;
          maintenance_mode: string;
          updated_at: string;
          user_id: string;
          weight_visibility: string;
        };
        ComputedFields: never;
        Insert: {
          activity_level?: string | null;
          birth_date?: string | null;
          daily_intake_target_kcal?: number | null;
          formula_sex?: string | null;
          height_cm?: number | null;
          maintenance_kcal_manual?: number | null;
          maintenance_mode?: string;
          updated_at?: string;
          user_id: string;
          weight_visibility?: string;
        };
        Update: {
          activity_level?: string | null;
          birth_date?: string | null;
          daily_intake_target_kcal?: number | null;
          formula_sex?: string | null;
          height_cm?: number | null;
          maintenance_kcal_manual?: number | null;
          maintenance_mode?: string;
          updated_at?: string;
          user_id?: string;
          weight_visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'energy_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      expense_revisions: {
        Row: {
          change: string;
          changed_by: string | null;
          created_at: string;
          expense_id: string;
          id: string;
          previous: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          change: string;
          changed_by?: string | null;
          created_at?: string;
          expense_id: string;
          id?: string;
          previous: NonNullable<Json>;
        };
        Update: {
          change?: string;
          changed_by?: string | null;
          created_at?: string;
          expense_id?: string;
          id?: string;
          previous?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_revisions_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'expense_revisions_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_splits: {
        Row: {
          expense_id: string;
          percent_basis_points: number | null;
          share_paise: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          expense_id: string;
          percent_basis_points?: number | null;
          share_paise: number;
          user_id: string;
        };
        Update: {
          expense_id?: string;
          percent_basis_points?: number | null;
          share_paise?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_splits_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_splits_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount_paise: number;
          category: string;
          client_request_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          household_id: string;
          id: string;
          note: string | null;
          payer_user_id: string;
          scope: string;
          spent_on: string;
          split_method: string;
          title: string;
          updated_at: string;
          version: number;
          visibility: string;
          voided_at: string | null;
          voided_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          category: string;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          household_id: string;
          id?: string;
          note?: string | null;
          payer_user_id: string;
          scope: string;
          spent_on: string;
          split_method: string;
          title: string;
          updated_at?: string;
          version?: number;
          visibility: string;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_paise?: number;
          category?: string;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          household_id?: string;
          id?: string;
          note?: string | null;
          payer_user_id?: string;
          scope?: string;
          spent_on?: string;
          split_method?: string;
          title?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'expenses_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_payer_user_id_fkey';
            columns: ['payer_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'expenses_voided_by_fkey';
            columns: ['voided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      food_servings: {
        Row: {
          amount: number;
          food_id: string;
          id: string;
          label: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          food_id: string;
          id?: string;
          label: string;
          position?: number;
        };
        Update: {
          amount?: number;
          food_id?: string;
          id?: string;
          label?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'food_servings_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
        ];
      };
      food_sources: {
        Row: {
          attribution: string;
          id: string;
          license: string;
          name: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          attribution: string;
          id: string;
          license: string;
          name: string;
          url: string;
        };
        Update: {
          attribution?: string;
          id?: string;
          license?: string;
          name?: string;
          url?: string;
        };
        Relationships: [];
      };
      foods: {
        Row: {
          aliases: string[];
          archived_at: string | null;
          basis_amount: number;
          basis_unit: string;
          carbs_g_per_basis: number | null;
          created_at: string;
          fat_g_per_basis: number | null;
          household_id: string | null;
          id: string;
          kcal_per_basis: number;
          name: string;
          owner_user_id: string | null;
          protein_g_per_basis: number | null;
          provenance: string;
          search_text: string | null;
          source_id: string;
          source_ref: string | null;
          updated_at: string;
          variant: string | null;
        };
        ComputedFields: never;
        Insert: {
          aliases?: string[];
          archived_at?: string | null;
          basis_amount: number;
          basis_unit: string;
          carbs_g_per_basis?: number | null;
          created_at?: string;
          fat_g_per_basis?: number | null;
          household_id?: string | null;
          id?: string;
          kcal_per_basis: number;
          name: string;
          owner_user_id?: string | null;
          protein_g_per_basis?: number | null;
          provenance: string;
          search_text?: never;
          source_id: string;
          source_ref?: string | null;
          updated_at?: string;
          variant?: string | null;
        };
        Update: {
          aliases?: string[];
          archived_at?: string | null;
          basis_amount?: number;
          basis_unit?: string;
          carbs_g_per_basis?: number | null;
          created_at?: string;
          fat_g_per_basis?: number | null;
          household_id?: string | null;
          id?: string;
          kcal_per_basis?: number;
          name?: string;
          owner_user_id?: string | null;
          protein_g_per_basis?: number | null;
          provenance?: string;
          search_text?: never;
          source_id?: string;
          source_ref?: string | null;
          updated_at?: string;
          variant?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'foods_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'foods_owner_user_id_fkey';
            columns: ['owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'foods_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'food_sources';
            referencedColumns: ['id'];
          },
        ];
      };
      household_invitations: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          household_id: string;
          id: string;
          redeemed_at: string | null;
          redeemed_by: string | null;
          revoked_at: string | null;
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at: string;
          household_id: string;
          id?: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          household_id?: string;
          id?: string;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_invitations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'household_invitations_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_invitations_redeemed_by_fkey';
            columns: ['redeemed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      household_members: {
        Row: {
          household_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          household_id: string;
          joined_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          household_id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'households_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      list_items: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string | null;
          details: NonNullable<Json>;
          done_at: string | null;
          done_by: string | null;
          id: string;
          is_done: boolean;
          list_id: string;
          note: string | null;
          position: string;
          revision: number;
          text: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by?: string | null;
          details?: NonNullable<Json>;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          list_id: string;
          note?: string | null;
          position: string;
          revision?: number;
          text: string;
          updated_at?: string;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string | null;
          details?: NonNullable<Json>;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          list_id?: string;
          note?: string | null;
          position?: string;
          revision?: number;
          text?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'list_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'list_items_done_by_fkey';
            columns: ['done_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'list_items_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'lists';
            referencedColumns: ['id'];
          },
        ];
      };
      lists: {
        Row: {
          archived_at: string | null;
          client_request_id: string;
          created_at: string;
          description: string | null;
          emoji: string;
          household_id: string;
          id: string;
          kind: string;
          owner_user_id: string;
          title: string;
          updated_at: string;
          visibility: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          client_request_id: string;
          created_at?: string;
          description?: string | null;
          emoji?: string;
          household_id: string;
          id?: string;
          kind: string;
          owner_user_id: string;
          title: string;
          updated_at?: string;
          visibility: string;
        };
        Update: {
          archived_at?: string | null;
          client_request_id?: string;
          created_at?: string;
          description?: string | null;
          emoji?: string;
          household_id?: string;
          id?: string;
          kind?: string;
          owner_user_id?: string;
          title?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lists_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lists_owner_user_id_fkey';
            columns: ['owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      meal_items: {
        Row: {
          basis_amount: number;
          basis_unit: string;
          carbs_g: number | null;
          carbs_g_per_basis: number | null;
          client_request_id: string;
          created_at: string;
          fat_g: number | null;
          fat_g_per_basis: number | null;
          food_id: string | null;
          food_name: string;
          food_variant: string | null;
          id: string;
          kcal: number | null;
          kcal_per_basis: number;
          meal_id: string;
          protein_g: number | null;
          protein_g_per_basis: number | null;
          provenance: string;
          quantity: number;
          serving_count: number | null;
          serving_label: string | null;
          source_label: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          basis_amount: number;
          basis_unit: string;
          carbs_g?: never;
          carbs_g_per_basis?: number | null;
          client_request_id: string;
          created_at?: string;
          fat_g?: never;
          fat_g_per_basis?: number | null;
          food_id?: string | null;
          food_name: string;
          food_variant?: string | null;
          id?: string;
          kcal?: never;
          kcal_per_basis: number;
          meal_id: string;
          protein_g?: never;
          protein_g_per_basis?: number | null;
          provenance: string;
          quantity: number;
          serving_count?: number | null;
          serving_label?: string | null;
          source_label: string;
          updated_at?: string;
        };
        Update: {
          basis_amount?: number;
          basis_unit?: string;
          carbs_g?: never;
          carbs_g_per_basis?: number | null;
          client_request_id?: string;
          created_at?: string;
          fat_g?: never;
          fat_g_per_basis?: number | null;
          food_id?: string | null;
          food_name?: string;
          food_variant?: string | null;
          id?: string;
          kcal?: never;
          kcal_per_basis?: number;
          meal_id?: string;
          protein_g?: never;
          protein_g_per_basis?: number | null;
          provenance?: string;
          quantity?: number;
          serving_count?: number | null;
          serving_label?: string | null;
          source_label?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meal_items_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meal_items_meal_id_fkey';
            columns: ['meal_id'];
            isOneToOne: false;
            referencedRelation: 'meals';
            referencedColumns: ['id'];
          },
        ];
      };
      meals: {
        Row: {
          created_at: string;
          custom_label: string;
          household_id: string;
          id: string;
          local_date: string;
          meal_type: string;
          note: string | null;
          owner_user_id: string;
          updated_at: string;
          visibility: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          custom_label?: string;
          household_id: string;
          id?: string;
          local_date: string;
          meal_type: string;
          note?: string | null;
          owner_user_id: string;
          updated_at?: string;
          visibility: string;
        };
        Update: {
          created_at?: string;
          custom_label?: string;
          household_id?: string;
          id?: string;
          local_date?: string;
          meal_type?: string;
          note?: string | null;
          owner_user_id?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meals_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meals_owner_user_id_fkey';
            columns: ['owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      nutrition_days: {
        Row: {
          is_complete: boolean;
          local_date: string;
          owner_user_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          is_complete?: boolean;
          local_date: string;
          owner_user_id: string;
          updated_at?: string;
        };
        Update: {
          is_complete?: boolean;
          local_date?: string;
          owner_user_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'nutrition_days_owner_user_id_fkey';
            columns: ['owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      places: {
        Row: {
          client_request_id: string;
          country_code: string | null;
          country_name: string | null;
          created_at: string;
          created_by: string;
          household_id: string;
          id: string;
          is_wishlist: boolean;
          latitude: number;
          locality: string | null;
          longitude: number;
          name: string;
          note: string | null;
          region: string | null;
          source: string;
          source_ref: string | null;
          updated_at: string;
          visibility: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          country_code?: string | null;
          country_name?: string | null;
          created_at?: string;
          created_by: string;
          household_id: string;
          id?: string;
          is_wishlist?: boolean;
          latitude: number;
          locality?: string | null;
          longitude: number;
          name: string;
          note?: string | null;
          region?: string | null;
          source: string;
          source_ref?: string | null;
          updated_at?: string;
          visibility: string;
        };
        Update: {
          client_request_id?: string;
          country_code?: string | null;
          country_name?: string | null;
          created_at?: string;
          created_by?: string;
          household_id?: string;
          id?: string;
          is_wishlist?: boolean;
          latitude?: number;
          locality?: string | null;
          longitude?: number;
          name?: string;
          note?: string | null;
          region?: string | null;
          source?: string;
          source_ref?: string | null;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'places_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'places_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          default_meal_visibility: string;
          display_name: string;
          time_zone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          default_meal_visibility?: string;
          display_name: string;
          time_zone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          default_meal_visibility?: string;
          display_name?: string;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      settlements: {
        Row: {
          amount_paise: number;
          client_request_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          from_user_id: string;
          household_id: string;
          id: string;
          note: string | null;
          settled_on: string;
          to_user_id: string;
          updated_at: string;
          voided_at: string | null;
          voided_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_paise: number;
          client_request_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          from_user_id: string;
          household_id: string;
          id?: string;
          note?: string | null;
          settled_on: string;
          to_user_id: string;
          updated_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_paise?: number;
          client_request_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          from_user_id?: string;
          household_id?: string;
          id?: string;
          note?: string | null;
          settled_on?: string;
          to_user_id?: string;
          updated_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'settlements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'settlements_from_user_id_fkey';
            columns: ['from_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'settlements_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settlements_to_user_id_fkey';
            columns: ['to_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'settlements_voided_by_fkey';
            columns: ['voided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      visit_members: {
        Row: {
          user_id: string;
          visit_id: string;
        };
        ComputedFields: never;
        Insert: {
          user_id: string;
          visit_id: string;
        };
        Update: {
          user_id?: string;
          visit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visit_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'visit_members_visit_id_fkey';
            columns: ['visit_id'];
            isOneToOne: false;
            referencedRelation: 'visits';
            referencedColumns: ['id'];
          },
        ];
      };
      visits: {
        Row: {
          client_request_id: string;
          created_at: string;
          created_by: string | null;
          ended_on: string | null;
          id: string;
          note: string | null;
          place_id: string;
          started_on: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          created_by?: string | null;
          ended_on?: string | null;
          id?: string;
          note?: string | null;
          place_id: string;
          started_on: string;
          updated_at?: string;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          created_by?: string | null;
          ended_on?: string | null;
          id?: string;
          note?: string | null;
          place_id?: string;
          started_on?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visits_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'visits_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
        ];
      };
      weight_entries: {
        Row: {
          client_request_id: string;
          created_at: string;
          id: string;
          local_date: string;
          note: string | null;
          updated_at: string;
          user_id: string;
          weight_kg: number;
        };
        ComputedFields: never;
        Insert: {
          client_request_id: string;
          created_at?: string;
          id?: string;
          local_date: string;
          note?: string | null;
          updated_at?: string;
          user_id: string;
          weight_kg: number;
        };
        Update: {
          client_request_id?: string;
          created_at?: string;
          id?: string;
          local_date?: string;
          note?: string | null;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'weight_entries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      weight_entry_revisions: {
        Row: {
          change: string;
          created_at: string;
          id: string;
          previous: NonNullable<Json>;
          user_id: string;
          weight_entry_id: string;
        };
        ComputedFields: never;
        Insert: {
          change: string;
          created_at?: string;
          id?: string;
          previous: NonNullable<Json>;
          user_id: string;
          weight_entry_id: string;
        };
        Update: {
          change?: string;
          created_at?: string;
          id?: string;
          previous?: NonNullable<Json>;
          user_id?: string;
          weight_entry_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weight_entry_revisions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      weight_goals: {
        Row: {
          created_at: string;
          effective_from: string;
          goal_type: string;
          id: string;
          start_date: string;
          start_weight_kg: number;
          target_date: string | null;
          target_weight_kg: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          effective_from: string;
          goal_type: string;
          id?: string;
          start_date: string;
          start_weight_kg: number;
          target_date?: string | null;
          target_weight_kg?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          effective_from?: string;
          goal_type?: string;
          id?: string;
          start_date?: string;
          start_weight_kg?: number;
          target_date?: string | null;
          target_weight_kg?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weight_goals_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_household_invitation: { Args: { invitation_token: string }; Returns: string };
      add_visit: {
        Args: {
          p_client_request_id: string;
          p_ended_on?: string;
          p_member_ids: string[];
          p_note?: string;
          p_place_id: string;
          p_started_on: string;
        };
        Returns: string;
      };
      copy_meal: {
        Args: {
          p_request_id: string;
          p_source_meal_id: string;
          p_target_custom_label: string;
          p_target_date: string;
          p_target_meal_type: string;
        };
        Returns: string;
      };
      create_household: { Args: { household_name: string }; Returns: string };
      create_household_invitation: {
        Args: Record<PropertyKey, never>;
        Returns: {
          expires_at: string;
          invitation_id: string;
          token: string;
        }[];
      };
      create_place: {
        Args: {
          p_client_request_id: string;
          p_country_code: string;
          p_country_name: string;
          p_is_wishlist: boolean;
          p_latitude: number;
          p_locality: string;
          p_longitude: number;
          p_name: string;
          p_region: string;
          p_source: string;
          p_source_ref: string;
          p_visibility: string;
          p_visit_ended_on?: string;
          p_visit_member_ids?: string[];
          p_visit_started_on?: string;
        };
        Returns: string;
      };
      household_balances: {
        Args: Record<PropertyKey, never>;
        Returns: {
          net_paise: number;
          paid_paise: number;
          settlements_paid_paise: number;
          settlements_received_paise: number;
          share_paise: number;
          user_id: string;
        }[];
      };
      log_food: {
        Args: {
          p_client_request_id: string;
          p_custom_label: string;
          p_food_id: string;
          p_local_date: string;
          p_meal_type: string;
          p_quantity: number;
          p_serving_count: number;
          p_serving_label: string;
          p_visibility: string;
        };
        Returns: string;
      };
      move_meal: {
        Args: {
          p_meal_id: string;
          p_target_custom_label: string;
          p_target_date: string;
          p_target_meal_type: string;
        };
        Returns: string;
      };
      my_daily_intake: {
        Args: { p_from: string; p_to: string };
        Returns: {
          is_complete: boolean;
          kcal: number;
          local_date: string;
        }[];
      };
      partner_weight_shared: { Args: Record<PropertyKey, never>; Returns: boolean };
      preview_household_invitation: {
        Args: { invitation_token: string };
        Returns: {
          expires_at: string;
          household_name: string;
          inviter_name: string;
        }[];
      };
      record_settlement: {
        Args: {
          p_amount_paise: number;
          p_client_request_id: string;
          p_from_user_id: string;
          p_note: string;
          p_settled_on: string;
          p_to_user_id: string;
        };
        Returns: string;
      };
      record_weight: {
        Args: {
          p_client_request_id: string;
          p_local_date: string;
          p_note: string;
          p_weight_kg: number;
        };
        Returns: string;
      };
      revoke_household_invitation: { Args: { target_invitation_id: string }; Returns: undefined };
      save_expense: {
        Args: {
          p_amount_paise: number;
          p_category: string;
          p_client_request_id: string;
          p_expected_version?: number;
          p_expense_id?: string;
          p_note: string;
          p_payer_user_id: string;
          p_scope: string;
          p_spent_on: string;
          p_split_method: string;
          p_splits: Json;
          p_title: string;
          p_visibility: string;
        };
        Returns: string;
      };
      set_day_complete: {
        Args: { p_is_complete: boolean; p_local_date: string };
        Returns: undefined;
      };
      set_expense_voided: {
        Args: { p_expected_version: number; p_expense_id: string; p_voided: boolean };
        Returns: undefined;
      };
      set_settlement_voided: {
        Args: { p_settlement_id: string; p_voided: boolean };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
