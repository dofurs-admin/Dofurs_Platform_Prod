export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OwnerProfileDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone_number: string;
          profile_photo_url: string | null;
          date_of_birth: string | null;
          gender: string | null;
          total_pets: number;
          first_pet_owner: boolean;
          years_of_pet_experience: number | null;
          cancellation_rate: number;
          late_cancellation_count: number;
          no_show_count: number;
          average_rating: number;
          total_bookings: number;
          flagged_count: number;
          is_suspended: boolean;
          is_phone_verified: boolean;
          is_email_verified: boolean;
          kyc_status: 'not_submitted' | 'pending' | 'verified' | 'rejected';
          government_id_type: string | null;
          id_document_url: string | null;
          lives_in: string | null;
          has_other_pets: boolean;
          number_of_people_in_house: number | null;
          has_children: boolean;
          account_status: 'active' | 'flagged' | 'banned';
          risk_score: number;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<OwnerProfileDatabase['public']['Tables']['profiles']['Row']> & {
          id: string;
          full_name: string;
          phone_number: string;
        };
        Update: Partial<OwnerProfileDatabase['public']['Tables']['profiles']['Row']>;
      };
      user_addresses: {
        Row: {
          id: string;
          user_id: string;
          label: 'Home' | 'Office' | 'Other' | null;
          address_line_1: string;
          address_line_2: string | null;
          city: string;
          state: string;
          pincode: string;
          country: string;
          latitude: number | null;
          longitude: number | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<OwnerProfileDatabase['public']['Tables']['user_addresses']['Row']> & {
          user_id: string;
          address_line_1: string;
          city: string;
          state: string;
          pincode: string;
          country: string;
        };
        Update: Partial<OwnerProfileDatabase['public']['Tables']['user_addresses']['Row']>;
      };
      user_emergency_contacts: {
        Row: {
          id: string;
          user_id: string;
          contact_name: string;
          relationship: string | null;
          phone_number: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<OwnerProfileDatabase['public']['Tables']['user_emergency_contacts']['Row']> & {
          user_id: string;
          contact_name: string;
          phone_number: string;
        };
        Update: Partial<OwnerProfileDatabase['public']['Tables']['user_emergency_contacts']['Row']>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          preferred_service_time: string | null;
          preferred_groomer_gender: string | null;
          communication_preference: 'call' | 'whatsapp' | 'app' | null;
          special_instructions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<OwnerProfileDatabase['public']['Tables']['user_preferences']['Row']> & {
          user_id: string;
        };
        Update: Partial<OwnerProfileDatabase['public']['Tables']['user_preferences']['Row']>;
      };
      owner_profile_audit_events: {
        Row: {
          id: number;
          user_id: string;
          actor_id: string | null;
          action: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          actor_id?: string | null;
          action: string;
          metadata?: Json;
        };
        Update: Partial<OwnerProfileDatabase['public']['Tables']['owner_profile_audit_events']['Row']>;
      };
    };
    Functions: {
      log_owner_profile_audit_event: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_metadata?: Json;
          p_actor_id?: string;
        };
        Returns: undefined;
      };
      recompute_owner_profile_metrics: {
        Args: {
          p_user_id?: string;
        };
        Returns: number;
      };
    };
  };
};
