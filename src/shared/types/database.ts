export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_household_invitation: { Args: { invitation_token: string }; Returns: string };
      create_household: { Args: { household_name: string }; Returns: string };
      create_household_invitation: {
        Args: Record<PropertyKey, never>;
        Returns: {
          expires_at: string;
          invitation_id: string;
          token: string;
        }[];
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
