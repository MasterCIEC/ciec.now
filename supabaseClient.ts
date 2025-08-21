// supabaseClient.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Company, Meeting, Participant, Event } from './types';

export type Database = {
  public: {
    Tables: {
      commissions: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { name?: string };
        Relationships: [];
      },
      participants: {
        Row: { id: string; name: string; id_establecimiento: string | null; role: string | null; email: string | null; phone: string | null };
        Insert: { id?: string; name: string; id_establecimiento?: string | null; role?: string | null; email?: string | null; phone?: string | null };
        Update: { name?: string; id_establecimiento?: string | null; role?: string | null; email?: string | null; phone?: string | null };
        Relationships: [
          {
            foreignKeyName: "participants_id_establecimiento_fkey",
            columns: ["id_establecimiento"],
            referencedRelation: "establecimientos_completos_remotos",
            referencedColumns: ["id_establecimiento"]
          }
        ];
      },
      meetings: {
        Row: { id: string; subject: string; commission_id: string; date: string; start_time: string | null; end_time: string | null; location: string | null; external_participants_count: number | null; description: string | null; is_cancelled: boolean };
        Insert: { id?: string; subject: string; commission_id: string; date: string; start_time?: string | null; end_time?: string | null; location?: string | null; external_participants_count?: number | null; description?: string | null; is_cancelled?: boolean };
        Update: { subject?: string; commission_id?: string; date?: string; start_time?: string | null; end_time?: string | null; location?: string | null; external_participants_count?: number | null; description?: string | null; is_cancelled?: boolean };
        Relationships: [
          {
            foreignKeyName: "meetings_commission_id_fkey",
            columns: ["commission_id"],
            referencedRelation: "commissions",
            referencedColumns: ["id"]
          }
        ];
      },
      event_categories: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { name?: string };
        Relationships: [];
      },
      events: {
        Row: { id: string; subject: string; date: string; start_time: string; end_time: string | null; location: string | null; external_participants_count: number | null; description: string | null; cost: number | null; investment: number | null; revenue: number | null; is_cancelled: boolean; flyer_url: string | null };
        Insert: { id?: string; subject: string; date: string; start_time: string; end_time?: string | null; location?: string | null; external_participants_count?: number | null; description?: string | null; cost?: number | null; investment?: number | null; revenue?: number | null; is_cancelled?: boolean; flyer_url?: string | null };
        Update: { subject?: string; date?: string; start_time?: string; end_time?: string | null; location?: string | null; external_participants_count?: number | null; description?: string | null; cost?: number | null; investment?: number | null; revenue?: number | null; is_cancelled?: boolean; flyer_url?: string | null };
        Relationships: [];
      },
      participant_commissions: {
        Row: { participant_id: string; commission_id: string };
        Insert: { participant_id: string; commission_id: string };
        Update: { participant_id?: string; commission_id?: string };
        Relationships: [];
      },
      meeting_attendees: {
        Row: { meeting_id: string; participant_id: string; attendance_type: "in_person" | "online" };
        Insert: { meeting_id: string; participant_id: string; attendance_type: "in_person" | "online" };
        Update: { meeting_id?: string; participant_id?: string; attendance_type?: "in_person" | "online" };
        Relationships: [];
      },
      event_attendees: {
        Row: { event_id: string; participant_id: string; attendance_type: "in_person" | "online" };
        Insert: { event_id: string; participant_id: string; attendance_type: "in_person" | "online" };
        Update: { event_id?: string; participant_id?: string; attendance_type?: "in_person" | "online" };
        Relationships: [];
      },
      event_invitees: {
        Row: { event_id: string; participant_id: string; };
        Insert: { event_id: string; participant_id: string; };
        Update: { event_id?: string; participant_id?: string; };
        Relationships: [];
      },
      event_organizing_commissions: {
        Row: { event_id: string; commission_id: string };
        Insert: { event_id: string; commission_id: string };
        Update: { event_id?: string; commission_id?: string };
        Relationships: [];
      },
      event_organizing_categories: {
        Row: { event_id: string; category_id: string };
        Insert: { event_id: string; category_id: string };
        Update: { event_id?: string; category_id?: string };
        Relationships: [];
      },
      roles: {
        Row: { id: number; name: string };
        Insert: { id?: number; name: string };
        Update: { name?: string };
        Relationships: [];
      },
      userprofiles: {
        Row: { id: string; full_name: string | null; role_id: number | null; is_approved: boolean };
        Insert: { id?: string; full_name?: string | null; role_id?: number | null; is_approved?: boolean };
        Update: { full_name?: string | null; role_id?: number | null; is_approved?: boolean };
        Relationships: [
          {
            foreignKeyName: "userprofiles_role_id_fkey",
            columns: ["role_id"],
            referencedRelation: "roles",
            referencedColumns: ["id"]
          }
        ];
      },
      permissions: {
        Row: { id: number; action: string; subject: string };
        Insert: { id?: number; action: string; subject: string };
        Update: { action?: string; subject?: string };
        Relationships: [];
      },
      rolepermissions: {
        Row: { role_id: number; permission_id: number };
        Insert: { role_id: number; permission_id: number };
        Update: { role_id?: number; permission_id?: number };
        Relationships: [];
      },
      afiliaciones_remotos: {
        Row: {
          id_establecimiento: string;
          rif_institucion: string;
        };
        Insert: {
          id_establecimiento: string;
          rif_institucion: string;
        };
        Update: {
          id_establecimiento?: string;
          rif_institucion?: string;
        };
        Relationships: [
          {
            foreignKeyName: "afiliaciones_remotos_id_establecimiento_fkey",
            columns: ["id_establecimiento"],
            referencedRelation: "establecimientos_completos_remotos",
            referencedColumns: ["id_establecimiento"]
          }
        ];
      },
      establecimientos_completos_remotos: {
        Row: {
          id_establecimiento: string;
          nombre_establecimiento: string;
          rif_compania: string;
          email_principal: string | null;
          telefono_principal_1: string | null;
          nombre_municipio: string | null;
        };
        Insert: {
          id_establecimiento: string;
          nombre_establecimiento: string;
          rif_compania: string;
          email_principal?: string | null;
          telefono_principal_1?: string | null;
          nombre_municipio?: string | null;
        };
        Update: {
          nombre_establecimiento?: string;
          rif_compania?: string;
          email_principal?: string | null;
          telefono_principal_1?: string | null;
          nombre_municipio?: string | null;
        };
        Relationships: [];
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}


const SUPABASE_URL = 'https://zsbyslmvvfzhpenfpxzm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzYnlzbG12dmZ6aHBlbmZweHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNDY2MzEsImV4cCI6MjA2NDcyMjYzMX0.aFwhoeoNfV79RtZAZrMYjI6apUNimcTYmV_eBhcQSXs';

let supabase: SupabaseClient<Database> | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.error("Error inicializando Supabase:", error);
    supabase = null;
  }
} else {
  console.warn("Las variables de entorno de Supabase no están configuradas. La funcionalidad de base de datos estará deshabilitada.");
}

export const participantToSupabase = (participant: Omit<Participant, 'id'> & { id?: string }): Database['public']['Tables']['participants']['Insert'] => {
  const data: Database['public']['Tables']['participants']['Insert'] = { name: participant.name, id_establecimiento: participant.id_establecimiento || null, role: participant.role || null, email: participant.email?.trim() ? participant.email.trim() : null, phone: participant.phone || null, };
  if (participant.id) { data.id = participant.id; }
  return data;
};
export const participantToSupabaseForUpdate = (participant: Omit<Participant, 'id'>): Database['public']['Tables']['participants']['Update'] => ({ name: participant.name, id_establecimiento: participant.id_establecimiento || null, role: participant.role || null, email: participant.email?.trim() ? participant.email.trim() : null, phone: participant.phone || null, });
export const participantFromSupabase = (dbParticipant: any): Participant => ({ id: dbParticipant.id, name: dbParticipant.name, id_establecimiento: dbParticipant.id_establecimiento ?? null, role: dbParticipant.role ?? null, email: dbParticipant.email ?? null, phone: dbParticipant.phone ?? null, });

export const meetingToSupabase = (meeting: Omit<Meeting, 'id'> & { id?: string }): Database['public']['Tables']['meetings']['Insert'] => {
    const data: Database['public']['Tables']['meetings']['Insert'] = { subject: meeting.subject, commission_id: meeting.meetingCategoryId, date: meeting.date, start_time: meeting.startTime || null, end_time: meeting.endTime || null, location: meeting.location || null, external_participants_count: meeting.externalParticipantsCount ?? null, description: meeting.description || null, is_cancelled: meeting.is_cancelled ?? false };
    if (meeting.id) { data.id = meeting.id; }
    return data;
};
export const meetingToSupabaseForUpdate = (meeting: Omit<Meeting, 'id'>): Database['public']['Tables']['meetings']['Update'] => ({ subject: meeting.subject, commission_id: meeting.meetingCategoryId, date: meeting.date, start_time: meeting.startTime || null, end_time: meeting.endTime || null, location: meeting.location || null, external_participants_count: meeting.externalParticipantsCount ?? null, description: meeting.description || null, is_cancelled: meeting.is_cancelled });
export const meetingFromSupabase = (dbMeeting: any): Meeting => ({ id: dbMeeting.id, subject: dbMeeting.subject, meetingCategoryId: dbMeeting.commission_id, date: dbMeeting.date, startTime: dbMeeting.start_time, endTime: dbMeeting.end_time, location: dbMeeting.location, externalParticipantsCount: dbMeeting.external_participants_count, description: dbMeeting.description, is_cancelled: dbMeeting.is_cancelled });

export const eventToSupabase = (event: Omit<Event, 'id'> & { id?: string }): Database['public']['Tables']['events']['Insert'] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizerType, ...restOfEventData } = event;
    const data: Database['public']['Tables']['events']['Insert'] = { subject: restOfEventData.subject, date: restOfEventData.date, start_time: restOfEventData.startTime, end_time: restOfEventData.endTime || null, location: restOfEventData.location || null, external_participants_count: restOfEventData.externalParticipantsCount ?? null, description: restOfEventData.description || null, cost: restOfEventData.cost ?? null, investment: restOfEventData.investment ?? null, revenue: restOfEventData.revenue ?? null, is_cancelled: restOfEventData.is_cancelled ?? false, flyer_url: restOfEventData.flyer_url || null };
    if (restOfEventData.id) { data.id = restOfEventData.id; }
    return data;
};
export const eventToSupabaseForUpdate = (event: Omit<Event, 'id'>): Database['public']['Tables']['events']['Update'] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizerType, ...restOfEventData } = event;
    return { subject: restOfEventData.subject, date: restOfEventData.date, start_time: restOfEventData.startTime, end_time: restOfEventData.endTime || null, location: restOfEventData.location || null, external_participants_count: restOfEventData.externalParticipantsCount ?? null, description: restOfEventData.description || null, cost: restOfEventData.cost ?? null, investment: restOfEventData.investment ?? null, revenue: restOfEventData.revenue ?? null, is_cancelled: restOfEventData.is_cancelled, flyer_url: restOfEventData.flyer_url };
};
export const eventFromSupabase = (dbEvent: any): Omit<Event, 'organizerType'> & { id: string } => ({ id: dbEvent.id, subject: dbEvent.subject, date: dbEvent.date, startTime: dbEvent.start_time, endTime: dbEvent.end_time, location: dbEvent.location, externalParticipantsCount: dbEvent.external_participants_count, description: dbEvent.description, cost: dbEvent.cost, investment: dbEvent.investment, revenue: dbEvent.revenue, is_cancelled: dbEvent.is_cancelled, flyer_url: dbEvent.flyer_url });

export { supabase };