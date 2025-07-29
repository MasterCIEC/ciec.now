
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Company, Meeting, Participant, Event, ParticipantAffiliationType } from './types';


export type Database = {
  public: {
    Tables: {
      Commissions: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          name?: string
        }
      }
      Companies: {
        Row: {
          id: string
          name: string
          rif: string
          email: string
          phone: string | null
          address: string | null
        }
        Insert: {
          id?: string
          name: string
          rif: string
          email: string
          phone?: string | null
          address?: string | null
        }
        Update: {
          name?: string
          rif?: string
          email?: string
          phone?: string | null
          address?: string | null
        }
      }
      Participants: {
        Row: {
          id: string
          name: string
          affiliation_type: ParticipantAffiliationType
          company_id: string | null
          external_company_name: string | null
          role: string | null
          email: string | null
          phone: string | null
        }
        Insert: {
          id?: string
          name: string
          affiliation_type: ParticipantAffiliationType
          company_id?: string | null
          external_company_name?: string | null
          role?: string | null
          email?: string | null
          phone?: string | null
        }
        Update: {
          name?: string
          affiliation_type?: ParticipantAffiliationType
          company_id?: string | null
          external_company_name?: string | null
          role?: string | null
          email?: string | null
          phone?: string | null
        }
      }
      Meetings: {
        Row: {
          id: string
          subject: string
          commission_id: string
          date: string
          start_time: string | null
          end_time: string | null
          location: string | null
          external_participants_count: number | null
          description: string | null
        }
        Insert: {
          id?: string
          subject: string
          commission_id: string
          date: string
          start_time?: string | null
          end_time?: string | null
          location?: string | null
          external_participants_count?: number | null
          description?: string | null
        }
        Update: {
          subject?: string
          commission_id?: string
          date?: string
          start_time?: string | null
          end_time?: string | null
          location?: string | null
          external_participants_count?: number | null
          description?: string | null
        }
      }
      EventCategories: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          name?: string
        }
      }
      Events: {
        Row: {
          id: string
          subject: string
          date: string
          start_time: string
          end_time: string | null
          location: string | null
          external_participants_count: number | null
          description: string | null
          cost: number | null
          investment: number | null
          revenue: number | null
        }
        Insert: {
          id?: string
          subject: string
          date: string
          start_time: string
          end_time?: string | null
          location?: string | null
          external_participants_count?: number | null
          description?: string | null
          cost?: number | null
          investment?: number | null
          revenue?: number | null
        }
        Update: {
          subject?: string
          date?: string
          start_time?: string
          end_time?: string | null
          location?: string | null
          external_participants_count?: number | null
          description?: string | null
          cost?: number | null
          investment?: number | null
          revenue?: number | null
        }
      }
      participant_commissions: {
        Row: {
          participant_id: string
          commission_id: string
        }
        Insert: {
          participant_id: string
          commission_id: string
        }
        Update: {}
      }
      meeting_attendees: {
        Row: {
          meeting_id: string
          participant_id: string
          attendance_type: "in_person" | "online"
        }
        Insert: {
          meeting_id: string
          participant_id: string
          attendance_type: "in_person" | "online"
        }
        Update: {
          attendance_type?: "in_person" | "online"
        }
      }
      event_attendees: {
        Row: {
          event_id: string
          participant_id: string
          attendance_type: "in_person" | "online"
        }
        Insert: {
          event_id: string
          participant_id: string
          attendance_type: "in_person" | "online"
        }
        Update: {
          attendance_type?: "in_person" | "online"
        }
      }
      event_organizing_commissions: {
        Row: {
          event_id: string
          commission_id: string
        }
        Insert: {
          event_id: string
          commission_id: string
        }
        Update: {}
      }
      event_organizing_categories: {
        Row: {
          event_id: string
          category_id: string
        }
        Insert: {
          event_id: string
          category_id: string
        }
        Update: {}
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}


// --- Supabase Configuration ---
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


// --- Data Transformation Functions ---

// Participant
export const participantToSupabase = (participant: Omit<Participant, 'id'> & { id?: string }): Database['public']['Tables']['Participants']['Insert'] => {
  const data: Database['public']['Tables']['Participants']['Insert'] = {
    name: participant.name,
    affiliation_type: participant.affiliationType,
    company_id: participant.affiliationType === 'company' ? (participant.companyId || null) : null,
    external_company_name: participant.affiliationType === 'external' ? (participant.externalCompanyName || null) : null,
    role: participant.role || null,
    email: participant.email?.trim() ? participant.email.trim() : null,
    phone: participant.phone || null,
  };
  if (participant.id) {
    data.id = participant.id;
  }
  return data;
};

export const participantToSupabaseForUpdate = (participant: Omit<Participant, 'id'>): Database['public']['Tables']['Participants']['Update'] => {
  return {
    name: participant.name,
    affiliation_type: participant.affiliationType,
    company_id: participant.affiliationType === 'company' ? (participant.companyId || null) : null,
    external_company_name: participant.affiliationType === 'external' ? (participant.externalCompanyName || null) : null,
    role: participant.role || null,
    email: participant.email?.trim() ? participant.email.trim() : null,
    phone: participant.phone || null,
  };
};

export const participantFromSupabase = (dbParticipant: any): Participant => {
  return {
    id: dbParticipant.id,
    name: dbParticipant.name,
    affiliationType: dbParticipant.affiliation_type as ParticipantAffiliationType,
    companyId: dbParticipant.company_id,
    externalCompanyName: dbParticipant.external_company_name,
    role: dbParticipant.role ?? null, 
    email: dbParticipant.email ?? null,
    phone: dbParticipant.phone,
  };
};


// Meeting
export const meetingToSupabase = (meeting: Omit<Meeting, 'id'> & { id?: string }): Database['public']['Tables']['Meetings']['Insert'] => {
    const data: Database['public']['Tables']['Meetings']['Insert'] = {
        subject: meeting.subject,
        commission_id: meeting.meetingCategoryId,
        date: meeting.date,
        start_time: meeting.startTime || null,
        end_time: meeting.endTime || null,
        location: meeting.location || null,
        external_participants_count: meeting.externalParticipantsCount ?? null,
        description: meeting.description || null,
    };
    if (meeting.id) {
        data.id = meeting.id;
    }
    return data;
};

export const meetingToSupabaseForUpdate = (meeting: Omit<Meeting, 'id'>): Database['public']['Tables']['Meetings']['Update'] => {
    return {
        subject: meeting.subject,
        commission_id: meeting.meetingCategoryId,
        date: meeting.date,
        start_time: meeting.startTime || null,
        end_time: meeting.endTime || null,
        location: meeting.location || null,
        external_participants_count: meeting.externalParticipantsCount ?? null,
        description: meeting.description || null,
    };
};

export const meetingFromSupabase = (dbMeeting: any): Meeting => {
    return {
        id: dbMeeting.id,
        subject: dbMeeting.subject,
        meetingCategoryId: dbMeeting.commission_id, // Map db schema to app model
        date: dbMeeting.date,
        startTime: dbMeeting.start_time,
        endTime: dbMeeting.end_time,
        location: dbMeeting.location,
        externalParticipantsCount: dbMeeting.external_participants_count,
        description: dbMeeting.description,
    };
};

// Event
export const eventToSupabase = (event: Omit<Event, 'id'> & { id?: string }): Database['public']['Tables']['Events']['Insert'] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizerType, ...restOfEventData } = event; 
    const data: Database['public']['Tables']['Events']['Insert'] = {
        subject: restOfEventData.subject,
        date: restOfEventData.date,
        start_time: restOfEventData.startTime,
        end_time: restOfEventData.endTime || null,
        location: restOfEventData.location || null,
        external_participants_count: restOfEventData.externalParticipantsCount ?? null,
        description: restOfEventData.description || null,
        cost: restOfEventData.cost ?? null,
        investment: restOfEventData.investment ?? null,
        revenue: restOfEventData.revenue ?? null,
    };
    if (restOfEventData.id) {
        data.id = restOfEventData.id;
    }
    return data;
};

export const eventToSupabaseForUpdate = (event: Omit<Event, 'id'>): Database['public']['Tables']['Events']['Update'] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { organizerType, ...restOfEventData } = event; 
    return {
        subject: restOfEventData.subject,
        date: restOfEventData.date,
        start_time: restOfEventData.startTime,
        end_time: restOfEventData.endTime || null,
        location: restOfEventData.location || null,
        external_participants_count: restOfEventData.externalParticipantsCount ?? null,
        description: restOfEventData.description || null,
        cost: restOfEventData.cost ?? null,
        investment: restOfEventData.investment ?? null,
        revenue: restOfEventData.revenue ?? null,
    };
};

export const eventFromSupabase = (dbEvent: any): Omit<Event, 'organizerType'> & { id: string } => {
    return {
        id: dbEvent.id,
        subject: dbEvent.subject,
        date: dbEvent.date,
        startTime: dbEvent.start_time,
        endTime: dbEvent.end_time,
        location: dbEvent.location,
        externalParticipantsCount: dbEvent.external_participants_count,
        description: dbEvent.description,
        cost: dbEvent.cost,
        investment: dbEvent.investment,
        revenue: dbEvent.revenue,
    };
};

export const companyToSupabase = (company: Omit<Company, 'id'> & { id?: string }): Database['public']['Tables']['Companies']['Insert'] => {
    const data: Database['public']['Tables']['Companies']['Insert'] = {
        name: company.name,
        rif: company.rif,
        email: company.email,
        phone: company.phone || null,
        address: company.address || null,
    };
    if (company.id) {
        data.id = company.id;
    }
    return data;
}

export const companyToSupabaseForUpdate = (company: Omit<Company, 'id'>): Database['public']['Tables']['Companies']['Update'] => {
    return {
        name: company.name,
        rif: company.rif,
        email: company.email,
        phone: company.phone || null,
        address: company.address || null,
    }
}


export { supabase };
