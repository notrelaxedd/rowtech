export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      allowed_users: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      beta_signups: {
        Row: {
          boat_types: string[] | null
          created_at: string
          email: string
          from_cta: string | null
          id: string
          location: string | null
          message: string | null
          name: string
          organization: string | null
          referrer: string | null
          role: string | null
          seats: string | null
          source: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          boat_types?: string[] | null
          created_at?: string
          email: string
          from_cta?: string | null
          id?: string
          location?: string | null
          message?: string | null
          name: string
          organization?: string | null
          referrer?: string | null
          role?: string | null
          seats?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          boat_types?: string[] | null
          created_at?: string
          email?: string
          from_cta?: string | null
          id?: string
          location?: string | null
          message?: string | null
          name?: string
          organization?: string | null
          referrer?: string | null
          role?: string | null
          seats?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      boats: {
        Row: {
          class: Database["public"]["Enums"]["boat_class"] | null
          created_at: string
          id: string
          name: string
          team_id: string
        }
        Insert: {
          class?: Database["public"]["Enums"]["boat_class"] | null
          created_at?: string
          id?: string
          name: string
          team_id: string
        }
        Update: {
          class?: Database["public"]["Enums"]["boat_class"] | null
          created_at?: string
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_points: {
        Row: {
          heading_deg: number | null
          lat: number
          lon: number
          sats: number | null
          session_id: string
          speed_mps: number | null
          t_ms: number
        }
        Insert: {
          heading_deg?: number | null
          lat: number
          lon: number
          sats?: number | null
          session_id: string
          speed_mps?: number | null
          t_ms: number
        }
        Update: {
          heading_deg?: number | null
          lat?: number
          lon?: number
          sats?: number | null
          session_id?: string
          speed_mps?: number | null
          t_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "gps_points_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_stats"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "gps_points_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      seats: {
        Row: {
          boat_id: string
          id: string
          label: string | null
          seat_number: number
          side: Database["public"]["Enums"]["seat_side"] | null
        }
        Insert: {
          boat_id: string
          id?: string
          label?: string | null
          seat_number: number
          side?: Database["public"]["Enums"]["seat_side"] | null
        }
        Update: {
          boat_id?: string
          id?: string
          label?: string | null
          seat_number?: number
          side?: Database["public"]["Enums"]["seat_side"] | null
        }
        Relationships: [
          {
            foreignKeyName: "seats_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      session_files: {
        Row: {
          bytes: number | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["file_kind"]
          path: string
          session_id: string
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["file_kind"]
          path: string
          session_id: string
        }
        Update: {
          bytes?: number | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          path?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_stats"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          avg_drive_ms: number | null
          avg_impulse: number | null
          avg_peak: number | null
          avg_peak_pos_pct: number | null
          avg_recovery_ms: number | null
          avg_rise_rate: number | null
          boat_id: string | null
          clock_source: string
          clock_sync_ms: number | null
          consistency_pct: number | null
          created_at: string
          created_by: string | null
          curve_points: number | null
          curve_scale: number | null
          device_id: string | null
          duration_ms: number | null
          format: number | null
          id: string
          kind: Database["public"]["Enums"]["session_kind"]
          meta: Json | null
          parent_id: string | null
          recorded_at: string
          sample_rate: number | null
          seat_number: number | null
          session_uuid: string | null
          side: Database["public"]["Enums"]["seat_side"] | null
          span_ms: number | null
          stroke_count: number
          team_id: string
          title: string | null
          units: string | null
        }
        Insert: {
          avg_drive_ms?: number | null
          avg_impulse?: number | null
          avg_peak?: number | null
          avg_peak_pos_pct?: number | null
          avg_recovery_ms?: number | null
          avg_rise_rate?: number | null
          boat_id?: string | null
          clock_source?: string
          clock_sync_ms?: number | null
          consistency_pct?: number | null
          created_at?: string
          created_by?: string | null
          curve_points?: number | null
          curve_scale?: number | null
          device_id?: string | null
          duration_ms?: number | null
          format?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["session_kind"]
          meta?: Json | null
          parent_id?: string | null
          recorded_at?: string
          sample_rate?: number | null
          seat_number?: number | null
          session_uuid?: string | null
          side?: Database["public"]["Enums"]["seat_side"] | null
          span_ms?: number | null
          stroke_count?: number
          team_id: string
          title?: string | null
          units?: string | null
        }
        Update: {
          avg_drive_ms?: number | null
          avg_impulse?: number | null
          avg_peak?: number | null
          avg_peak_pos_pct?: number | null
          avg_recovery_ms?: number | null
          avg_rise_rate?: number | null
          boat_id?: string | null
          clock_source?: string
          clock_sync_ms?: number | null
          consistency_pct?: number | null
          created_at?: string
          created_by?: string | null
          curve_points?: number | null
          curve_scale?: number | null
          device_id?: string | null
          duration_ms?: number | null
          format?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["session_kind"]
          meta?: Json | null
          parent_id?: string | null
          recorded_at?: string
          sample_rate?: number | null
          seat_number?: number | null
          session_uuid?: string | null
          side?: Database["public"]["Enums"]["seat_side"] | null
          span_ms?: number | null
          stroke_count?: number
          team_id?: string
          title?: string | null
          units?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "session_stats"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      strokes: {
        Row: {
          catch_ms: number
          curve_valid: boolean
          drive_ms: number
          impulse: number
          peak: number
          peak_pos_pct: number
          rec: number
          recovery_ms: number
          rise_rate: number
          seq: number
          session_id: string
          third1: number
          third2: number
          third3: number
        }
        Insert: {
          catch_ms: number
          curve_valid?: boolean
          drive_ms: number
          impulse: number
          peak: number
          peak_pos_pct: number
          rec: number
          recovery_ms: number
          rise_rate: number
          seq: number
          session_id: string
          third1: number
          third2: number
          third3: number
        }
        Update: {
          catch_ms?: number
          curve_valid?: boolean
          drive_ms?: number
          impulse?: number
          peak?: number
          peak_pos_pct?: number
          rec?: number
          recovery_ms?: number
          rise_rate?: number
          seq?: number
          session_id?: string
          third1?: number
          third2?: number
          third3?: number
        }
        Relationships: [
          {
            foreignKeyName: "strokes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_stats"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "strokes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      session_stats: {
        Row: {
          avg_drive_ms: number | null
          avg_impulse: number | null
          avg_peak: number | null
          avg_peak_pos_pct: number | null
          avg_recovery_ms: number | null
          avg_rise_rate: number | null
          boat_id: string | null
          consistency_pct: number | null
          parent_id: string | null
          recorded_at: string | null
          seat_number: number | null
          session_id: string | null
          span_ms: number | null
          strokes: number | null
          team_id: string | null
          title: string | null
          units: string | null
        }
        Insert: {
          avg_drive_ms?: number | null
          avg_impulse?: number | null
          avg_peak?: number | null
          avg_peak_pos_pct?: number | null
          avg_recovery_ms?: number | null
          avg_rise_rate?: number | null
          boat_id?: string | null
          consistency_pct?: number | null
          parent_id?: string | null
          recorded_at?: string | null
          seat_number?: number | null
          session_id?: string | null
          span_ms?: number | null
          strokes?: number | null
          team_id?: string | null
          title?: string | null
          units?: string | null
        }
        Update: {
          avg_drive_ms?: number | null
          avg_impulse?: number | null
          avg_peak?: number | null
          avg_peak_pos_pct?: number | null
          avg_recovery_ms?: number | null
          avg_rise_rate?: number | null
          boat_id?: string | null
          consistency_pct?: number | null
          parent_id?: string | null
          recorded_at?: string | null
          seat_number?: number | null
          session_id?: string | null
          span_ms?: number | null
          strokes?: number | null
          team_id?: string | null
          title?: string | null
          units?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "session_stats"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ensure_own_team: { Args: { p_name: string }; Returns: string }
      ingest_sessions: {
        Args: {
          p_boat_name: string
          p_recorded_at: string
          p_seats: Json
          p_team: string
          p_title: string
        }
        Returns: Json
      }
      is_beta_user: { Args: never; Returns: boolean }
      session_strokes: { Args: { p_sessions: string[] }; Returns: Json }
      session_track: { Args: { p_session: string }; Returns: Json }
    }
    Enums: {
      boat_class: "1x" | "2x" | "2-" | "2+" | "4x" | "4-" | "4+" | "8+"
      file_kind: "strokes" | "curves" | "events" | "meta" | "gps" | "raw"
      seat_side: "port" | "starboard" | "scull" | "cox"
      session_kind: "node" | "crew"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      boat_class: ["1x", "2x", "2-", "2+", "4x", "4-", "4+", "8+"],
      file_kind: ["strokes", "curves", "events", "meta", "gps", "raw"],
      seat_side: ["port", "starboard", "scull", "cox"],
      session_kind: ["node", "crew"],
    },
  },
} as const

