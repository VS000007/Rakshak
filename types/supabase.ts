export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          full_name?: string | null
          phone?: string | null
        }
      }
      trusted_contacts: {
        Row: {
          id: string
          user_id: string
          name: string
          phone: string
          relation: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          phone: string
          relation?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          phone?: string
          relation?: string | null
        }
      }
      emergency_events: {
        Row: {
          id: string
          user_id: string
          latitude: number
          longitude: number
          battery_percent: number | null
          speed_kmh: number | null
          selected_mode: 'DETERRENT_MODE' | 'STEALTH_MODE' | null
          ai_reasoning: string | null
          status: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          latitude: number
          longitude: number
          battery_percent?: number | null
          speed_kmh?: number | null
          selected_mode?: 'DETERRENT_MODE' | 'STEALTH_MODE' | null
          ai_reasoning?: string | null
          status?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          status?: string | null
          resolved_at?: string | null
        }
      }
      route_checks: {
        Row: {
          id: string
          user_id: string
          source_text: string
          destination_text: string
          source_lat: number | null
          source_lng: number | null
          dest_lat: number | null
          dest_lng: number | null
          safety_score: number | null
          risk_level: string | null
          ai_summary: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_text: string
          destination_text: string
          source_lat?: number | null
          source_lng?: number | null
          dest_lat?: number | null
          dest_lng?: number | null
          safety_score?: number | null
          risk_level?: string | null
          ai_summary?: string | null
          created_at?: string
        }
        Update: {
          safety_score?: number | null
          risk_level?: string | null
          ai_summary?: string | null
        }
      }
      community_reports: {
        Row: {
          id: string
          user_id: string
          latitude: number
          longitude: number
          tag: 'POORLY_LIT' | 'ISOLATED' | 'SAFE'
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          latitude: number
          longitude: number
          tag: 'POORLY_LIT' | 'ISOLATED' | 'SAFE'
          note?: string | null
          created_at?: string
        }
        Update: {
          tag?: 'POORLY_LIT' | 'ISOLATED' | 'SAFE'
          note?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
