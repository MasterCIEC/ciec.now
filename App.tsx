// App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ViewKey, Meeting, Participant, Company, MeetingCategory, Event, EventCategory,
  ParticipantMeetingCategory, MeetingAttendee, EventAttendee, EventOrganizingMeetingCategory, EventOrganizingCategory, UserProfile, Role
} from './types';
import {
  supabase,
  participantToSupabase,
  meetingToSupabase,
  eventToSupabase,
  participantToSupabaseForUpdate,
  meetingToSupabaseForUpdate,
  eventToSupabaseForUpdate,
  participantFromSupabase,
  meetingFromSupabase,
  eventFromSupabase,
  Database
} from './supabaseClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthView from './views/AuthView';
import PendingApprovalView from './views/PendingApprovalView';
import MainMenuView from './views/MainMenuView';
import ScheduleMeetingView from './views/ScheduleMeetingView';
import ParticipantsView from './views/ParticipantsView';
import CompaniesView from './views/CompaniesView';
import AgendaView from './views/AgendaView';
import ManageMeetingCategoriesView from './views/ManageCommitteesView';
import ManageEventsView from './views/ManageEventsView';
import ManageEventCategoriesView from './views/ManageEventCategoriesView';
import StatsView from './views/StatsView';
import ReportsView from './views/ReportsView';
import AdminUsersView from './views/AdminUsersView';
import UpdatePasswordView from './views/UpdatePasswordView';
import AccountView from './views/AccountView';
import { Theme } from './components/ThemeToggleButton';
import Button from './components/ui/Button';

const AppContent = (): JSX.Element => {
  const { session, profile, loading, awaitingPasswordReset, setAwaitingPasswordReset } = useAuth();
  
  const [activeView, setActiveView] = useState<ViewKey>(ViewKey.MainMenuView);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [meetingCategories, setMeetingCategories] = useState<MeetingCategory[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);
  const [participantMeetingCategories, setParticipantMeetingCategories] = useState<ParticipantMeetingCategory[]>([]);
  const [meetingAttendees, setMeetingAttendees] = useState<MeetingAttendee[]>([]);
  const [eventAttendees, setEventAttendees] = useState<EventAttendee[]>([]);
  const [eventOrganizingMeetingCategories, setEventOrganizingMeetingCategories] = useState<EventOrganizingMeetingCategory[]>([]);
  const [eventOrganizingCategories, setEventOrganizingCategories] = useState<EventOrganizingCategory[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const fetchMeetingCategories = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('Commissions').select('*');
    if (error) console.error('Error al obtener categorías de reunión:', error.message, error);
    else setMeetingCategories(data || []);
  }, []);

  const fetchCompanies = useCallback(async () => {
    if (!supabase) return;
    const { data: affiliations, error: affiliationsError } = await supabase
      .from('afiliaciones_remotos')
      .select('id_establecimiento')
      .eq('rif_institucion', 'J075109112');
    if (affiliationsError) {
      console.error('Error al obtener afiliaciones:', affiliationsError.message);
      setCompanies([]);
      return;
    }
    if (!affiliations || affiliations.length === 0) {
      setCompanies([]); return;
    }
    const affiliatedIds = (affiliations as any[]).map(a => a.id_establecimiento);
    const { data: companiesData, error: companiesError } = await supabase
      .from('establecimientos_completos_remotos')
      .select('id_establecimiento, nombre_establecimiento, rif_compania, email_principal, telefono_principal_1, nombre_municipio')
      .in('id_establecimiento', affiliatedIds);
    if (companiesError) console.error('Error al obtener empresas afiliadas:', companiesError.message);
    else setCompanies(companiesData || []);
  }, []);

  const fetchParticipants = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('Participants').select('*');
    if (error) console.error('Error al obtener participantes:', error.message, error);
    else setParticipants(data ? data.map(participantFromSupabase) : []);
  }, []);

  const fetchMeetings = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('Meetings').select('*');
    if (error) console.error('Error al obtener reuniones:', error.message, error);
    else setMeetings(data ? data.map(meetingFromSupabase) : []);
  }, []);

  const fetchEventCategories = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('EventCategories').select('*');
    if (error) console.error('Error al obtener categorías de eventos:', error.message, error);
    else setEventCategories(data || []);
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!supabase) return;
    const { data: rawEventsData, error: rawEventsError } = await supabase.from('Events').select('*');
    if (rawEventsError) { console.error('Error fetching raw events:', rawEventsError.message); setEvents([]); return; }
    if (!rawEventsData) { setEvents([]); return; }
    const [eocResult, eocaResult] = await Promise.all([
      supabase.from('event_organizing_commissions').select('*'),
      supabase.from('event_organizing_categories').select('*')
    ]);
    const { data: eocData, error: eocError } = eocResult;
    if (eocError) console.error('Error fetching event_organizing_commissions:', eocError.message);
    const { data: eocaData, error: eocaError } = eocaResult;
    if (eocaError) console.error('Error fetching event_organizing_categories:', eocaError.message);
    const processedEvents = (rawEventsData as any[]).map(dbEvent => {
      const baseEvent = eventFromSupabase(dbEvent);
      let determinedOrganizerType: 'meeting_category' | 'category' = 'meeting_category';
      if ((eocData as any)?.some((link: any) => link.event_id === baseEvent.id)) determinedOrganizerType = 'meeting_category';
      else if ((eocaData as any)?.some((link: any) => link.event_id === baseEvent.id)) determinedOrganizerType = 'category';
      else console.warn(`Event ${baseEvent.id} ('${baseEvent.subject}') has no organizer links. Defaulting to 'meeting_category'.`);
      return { ...baseEvent, organizerType: determinedOrganizerType } as Event;
    });
    setEvents(processedEvents);
  }, []);

  const fetchParticipantMeetingCategories = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('participant_commissions').select('participant_id, commission_id');
    if (error) console.error('Error fetching participant_commissions:', error.message);
    else {
      const mappedData = data ? (data as any[]).map(item => ({ participant_id: item.participant_id, meeting_category_id: item.commission_id })) : [];
      setParticipantMeetingCategories(mappedData);
    }
  }, []);

  const fetchMeetingAttendees = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('meeting_attendees').select('*');
    if (error) console.error('Error fetching meeting_attendees:', error.message);
    else setMeetingAttendees(data || []);
  }, []);

  const fetchEventAttendees = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('event_attendees').select('*');
    if (error) console.error('Error fetching event_attendees:', error.message);
    else setEventAttendees(data || []);
  }, []);

  const fetchEventOrganizingMeetingCategories = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('event_organizing_commissions').select('event_id, commission_id');
    if (error) console.error('Error fetching event_organizing_commissions:', error.message);
    else {
      const mappedData = data ? (data as any[]).map(item => ({ event_id: item.event_id, meeting_category_id: item.commission_id })) : [];
      setEventOrganizingMeetingCategories(mappedData);
    }
  }, []);

  const fetchEventOrganizingCategories = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('event_organizing_categories').select('*');
    if (error) console.error('Error fetching event_organizing_categories:', error.message);
    else setEventOrganizingCategories(data || []);
  }, []);

  const fetchUsersAndRoles = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('userprofiles')
        .select(`
          id,
          full_name,
          role_id,
          is_approved,
          roles (
            id,
            name
          )
        `);
      if (usersError) throw usersError;
      setUsers((usersData as any as UserProfile[]) || []);

      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);
    } catch (err: any) {
      console.error("Error fetching users and roles:", err.message);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    if (supabase && profile?.is_approved) {
      await Promise.all([
        fetchMeetingCategories(), fetchCompanies(), fetchParticipants(), fetchMeetings(), fetchEventCategories(),
        fetchEvents(), fetchParticipantMeetingCategories(), fetchMeetingAttendees(), fetchEventAttendees(),
        fetchEventOrganizingMeetingCategories(), fetchEventOrganizingCategories(), fetchUsersAndRoles()
      ]);
    }
  }, [
    profile?.is_approved, fetchMeetingCategories, fetchCompanies, fetchParticipants, fetchMeetings,
    fetchEventCategories, fetchEvents, fetchParticipantMeetingCategories,
    fetchMeetingAttendees, fetchEventAttendees, fetchEventOrganizingMeetingCategories,
    fetchEventOrganizingCategories, fetchUsersAndRoles
  ]);

  useEffect(() => {
    if (profile?.is_approved) {
      fetchAllData();
    }
  }, [profile?.is_approved, fetchAllData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && profile?.is_approved) {
        fetchAllData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAllData, profile?.is_approved]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">Cargando...</div>
      </div>
    );
  }
  
  if (awaitingPasswordReset) return <UpdatePasswordView onPasswordUpdated={() => setAwaitingPasswordReset(false)} />;
  if (!session) return <AuthView />;
  if (!profile?.is_approved) return <PendingApprovalView />;
  
  const navigate = (viewKey: ViewKey) => {
    if (viewKey !== ViewKey.ScheduleMeeting) setMeetingToEdit(null);
    if (viewKey !== ViewKey.ManageEvents) setEventToEdit(null);
    setActiveView(viewKey);
  };

  const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const generateNextId = (prefix: string, items: Array<{id: string | undefined}>, padLength: number = 6): string => {
    let maxNum = 0;
    items.forEach(item => {
      if (item.id && typeof item.id === 'string' && item.id.startsWith(prefix)) {
        const numStr = item.id.substring(prefix.length);
        if (/^\d+$/.test(numStr)) {
          const num = parseInt(numStr, 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `${prefix}${nextNum.toString().padStart(padLength, '0')}`;
  };

  const handleAddParticipant = async (participantData: Omit<Participant, 'id'>, selectedCategoryIds: string[]) => {
    if (!supabase) return;
    const newParticipantId = generateNextId('P-', participants);
    const participantWithId = { ...participantData, id: newParticipantId };
    const { data: newParticipantEntry, error: participantError } = await supabase
      .from('Participants').insert([participantToSupabase(participantWithId)]).select('id').single();
    if (participantError) { console.error('Error al añadir participante:', participantError.message); return; }
    if (newParticipantEntry && selectedCategoryIds.length > 0) {
      const categoryLinks = selectedCategoryIds.map(category_id => ({ participant_id: (newParticipantEntry as any).id as string, commission_id: category_id }));
      const { error: categoryError } = await supabase.from('participant_commissions').insert(categoryLinks);
      if (categoryError) console.error('Error al enlazar categorías con participante:', categoryError.message);
    }
    fetchParticipants(); fetchParticipantMeetingCategories();
  };

  const handleUpdateParticipant = async (participantId: string, participantData: Omit<Participant, 'id'>, selectedCategoryIds: string[]) => {
    if (!supabase) return;
    const { error: participantError } = await supabase.from('Participants').update(participantToSupabaseForUpdate(participantData)).eq('id', participantId);
    if (participantError) { console.error('Error al actualizar participante:', participantError.message); return; }
    const { error: deleteError } = await supabase.from('participant_commissions').delete().eq('participant_id', participantId);
    if (deleteError) console.error('Error al eliminar categorías antiguas del participante:', deleteError.message);
    if (selectedCategoryIds.length > 0) {
      const categoryLinks = selectedCategoryIds.map(category_id => ({ participant_id: participantId, commission_id: category_id }));
      const { error: insertError } = await supabase.from('participant_commissions').insert(categoryLinks);
      if (insertError) console.error('Error al insertar nuevas categorías para el participante:', insertError.message);
    }
    fetchParticipants(); fetchParticipantMeetingCategories();
  };

  const handleDeleteParticipant = async (participantId: string) => {
    if (!supabase) return;
    await supabase.from('participant_commissions').delete().eq('participant_id', participantId);
    await supabase.from('meeting_attendees').delete().eq('participant_id', participantId);
    await supabase.from('event_attendees').delete().eq('participant_id', participantId);
    const { error } = await supabase.from('Participants').delete().eq('id', participantId);
    if (error) console.error('Error al eliminar participante:', error.message);
    else { fetchParticipants(); fetchParticipantMeetingCategories(); fetchMeetingAttendees(); fetchEventAttendees(); }
  };

  const handleAddMeeting = async (meetingData: Omit<Meeting, 'id'>, selectedAttendeesInPersonIds: string[], selectedAttendeesOnlineIds: string[]) => {
    if (!supabase) return;
    const transformedMeetingData = { ...meetingData, subject: toTitleCase(meetingData.subject) };
    const { data: newMeeting, error: meetingError } = await supabase.from('Meetings').insert([meetingToSupabase(transformedMeetingData)]).select('id').single();
    if (meetingError) { console.error('Error al añadir reunión:', meetingError.message); return; }
    if (newMeeting) {
      const attendeesToInsert: { participant_id: string; attendance_type: 'in_person' | 'online' }[] = [];
      selectedAttendeesInPersonIds.forEach(participant_id => attendeesToInsert.push({ participant_id, attendance_type: 'in_person' }));
      selectedAttendeesOnlineIds.forEach(participant_id => attendeesToInsert.push({ participant_id, attendance_type: 'online' }));
      if (attendeesToInsert.length > 0) {
        const finalAttendees = attendeesToInsert.map(att => ({ ...att, meeting_id: (newMeeting as any).id as string }));
        const { error: attendeesError } = await supabase.from('meeting_attendees').insert(finalAttendees);
        if (attendeesError) console.error('Error al añadir asistentes a la reunión:', attendeesError.message);
      }
    }
    fetchMeetings(); fetchMeetingAttendees(); setMeetingToEdit(null);
  };

  const handleUpdateMeeting = async (meetingId: string, meetingData: Omit<Meeting, 'id'>, selectedAttendeesInPersonIds: string[], selectedAttendeesOnlineIds: string[]) => {
    if (!supabase) return;
    const transformedMeetingData = { ...meetingData, subject: toTitleCase(meetingData.subject) };
    const { error: meetingError } = await supabase.from('Meetings').update(meetingToSupabaseForUpdate(transformedMeetingData)).eq('id', meetingId);
    if (meetingError) { console.error('Error al actualizar reunión:', meetingError.message); return; }
    const { error: deleteError } = await supabase.from('meeting_attendees').delete().eq('meeting_id', meetingId);
    if (deleteError) console.error('Error al eliminar asistentes antiguos de la reunión:', deleteError.message);
    const attendeesToInsert: { participant_id: string; attendance_type: 'in_person' | 'online' }[] = [];
    selectedAttendeesInPersonIds.forEach(participant_id => attendeesToInsert.push({ participant_id, attendance_type: 'in_person' }));
    selectedAttendeesOnlineIds.forEach(participant_id => attendeesToInsert.push({ participant_id, attendance_type: 'online' }));
    if (attendeesToInsert.length > 0) {
      const finalAttendees = attendeesToInsert.map(att => ({ ...att, meeting_id: meetingId }));
      const { error: insertError } = await supabase.from('meeting_attendees').insert(finalAttendees);
      if (insertError) console.error('Error al insertar nuevos asistentes para la reunión:', insertError.message);
    }
    fetchMeetings(); fetchMeetingAttendees(); setMeetingToEdit(null);
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!supabase) return;
    await supabase.from('meeting_attendees').delete().eq('meeting_id', meetingId);
    const { error } = await supabase.from('Meetings').delete().eq('id', meetingId);
    if (error) console.error('Error al eliminar reunión:', error.message);
    else { fetchMeetings(); fetchMeetingAttendees(); }
  };

  const handleEditMeeting = (meeting: Meeting) => { setMeetingToEdit(meeting); navigate(ViewKey.ScheduleMeeting); };

  const handleQuickAddMeeting = async (meetingData: Omit<Meeting, 'id'>) => {
    if (!supabase) return;
    const transformedMeetingData = { ...meetingData, subject: toTitleCase(meetingData.subject) };
    const { error } = await supabase.from('Meetings').insert([meetingToSupabase(transformedMeetingData)]);
    if (error) { console.error('Error al añadir reunión rápida:', error.message); alert(`Error al guardar la reunión: ${error.message}`); }
    else fetchMeetings();
  };

  const handleAddEvent = async (eventData: Omit<Event, 'id'>, selectedOrganizerIds: string[], selectedAttendeesInPersonIds: string[], selectedAttendeesOnlineIds: string[]) => {
    if (!supabase) return;
    const transformedEventData = { ...eventData, subject: toTitleCase(eventData.subject) };
    const { data: newEvent, error: eventError } = await supabase.from('Events').insert([eventToSupabase(transformedEventData)]).select('id').single();
    if (eventError) { console.error('Error al añadir evento:', eventError.message); return; }
    if (newEvent) {
      if (selectedOrganizerIds.length > 0) {
        if (transformedEventData.organizerType === 'meeting_category') {
          const links = selectedOrganizerIds.map(id => ({ event_id: (newEvent as any).id as string, commission_id: id }));
          await supabase.from('event_organizing_commissions').insert(links);
        } else {
          const links = selectedOrganizerIds.map(id => ({ event_id: (newEvent as any).id as string, category_id: id }));
          await supabase.from('event_organizing_categories').insert(links);
        }
      }
      const attendeesToInsert: { participant_id: string; attendance_type: 'in_person' | 'online' }[] = [];
      selectedAttendeesInPersonIds.forEach(p_id => attendeesToInsert.push({ participant_id: p_id, attendance_type: 'in_person' }));
      selectedAttendeesOnlineIds.forEach(p_id => attendeesToInsert.push({ participant_id: p_id, attendance_type: 'online' }));
      if (attendeesToInsert.length > 0) {
        const finalAttendees = attendeesToInsert.map(att => ({ ...att, event_id: (newEvent as any).id as string }));
        await supabase.from('event_attendees').insert(finalAttendees);
      }
    }
    fetchEvents(); fetchEventAttendees(); fetchEventOrganizingMeetingCategories(); fetchEventOrganizingCategories(); setEventToEdit(null);
  };

  const handleUpdateEvent = async (eventId: string, eventData: Omit<Event, 'id'>, selectedOrganizerIds: string[], selectedAttendeesInPersonIds: string[], selectedAttendeesOnlineIds: string[]) => {
    if (!supabase) return;
    const transformedEventData = { ...eventData, subject: toTitleCase(eventData.subject) };
    await supabase.from('Events').update(eventToSupabaseForUpdate(transformedEventData)).eq('id', eventId);
    await supabase.from('event_organizing_commissions').delete().eq('event_id', eventId);
    await supabase.from('event_organizing_categories').delete().eq('event_id', eventId);
    if (selectedOrganizerIds.length > 0) {
      if (transformedEventData.organizerType === 'meeting_category') {
        const links = selectedOrganizerIds.map(id => ({ event_id: eventId, commission_id: id }));
        await supabase.from('event_organizing_commissions').insert(links);
      } else {
        const links = selectedOrganizerIds.map(id => ({ event_id: eventId, category_id: id }));
        await supabase.from('event_organizing_categories').insert(links);
      }
    }
    await supabase.from('event_attendees').delete().eq('event_id', eventId);
    const attendeesToInsert: { participant_id: string; attendance_type: 'in_person' | 'online' }[] = [];
    selectedAttendeesInPersonIds.forEach(p_id => attendeesToInsert.push({ participant_id: p_id, attendance_type: 'in_person' }));
    selectedAttendeesOnlineIds.forEach(p_id => attendeesToInsert.push({ participant_id: p_id, attendance_type: 'online' }));
    if (attendeesToInsert.length > 0) {
      const finalAttendees = attendeesToInsert.map(att => ({ ...att, event_id: eventId }));
      await supabase.from('event_attendees').insert(finalAttendees);
    }
    fetchEvents(); fetchEventAttendees(); fetchEventOrganizingMeetingCategories(); fetchEventOrganizingCategories(); setEventToEdit(null);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!supabase) return;
    await supabase.from('event_attendees').delete().eq('event_id', eventId);
    await supabase.from('event_organizing_commissions').delete().eq('event_id', eventId);
    await supabase.from('event_organizing_categories').delete().eq('event_id', eventId);
    const { error } = await supabase.from('Events').delete().eq('id', eventId);
    if (error) console.error('Error al eliminar evento:', error.message);
    else fetchEvents();
  };

  const handleEditEvent = (event: Event) => { setEventToEdit(event); navigate(ViewKey.ManageEvents); };

  const handleQuickAddEvent = async (eventData: Omit<Event, 'id'>, organizerId: string) => {
    if (!supabase) return;
    const transformedEventData = { ...eventData, subject: toTitleCase(eventData.subject) };
    const { data: newEvent, error: eventError } = await supabase.from('Events').insert([eventToSupabase(transformedEventData)]).select('id').single();
    if (eventError) { console.error('Error al añadir evento rápido:', eventError.message); alert(`Error al guardar el evento: ${eventError.message}`); return; }
    if (newEvent) {
      if (transformedEventData.organizerType === 'meeting_category') {
        const { error } = await supabase.from('event_organizing_commissions').insert([{ event_id: (newEvent as any).id as string, commission_id: organizerId }]);
        if (error) console.error('Error al enlazar categoría de reunión con evento:', error.message);
        else fetchEventOrganizingMeetingCategories();
      } else {
        const { error } = await supabase.from('event_organizing_categories').insert([{ event_id: (newEvent as any).id as string, category_id: organizerId }]);
        if (error) console.error('Error al enlazar categoría de evento con evento:', error.message);
        else fetchEventOrganizingCategories();
      }
    }
    fetchEvents();
  };

  const handleAddMeetingCategory = async (category: MeetingCategory) => {
    if (!supabase) return;
    const insertData: Database['public']['Tables']['Commissions']['Insert'] = { id: category.id, name: category.name };
    const { error } = await supabase.from('Commissions').insert([insertData]);
    if (error) console.error('Error al añadir categoría de reunión:', error.message);
    else fetchMeetingCategories();
  };

  const handleUpdateMeetingCategory = async (category: MeetingCategory) => {
    if (!supabase) return;
    const { id, ...categoryData } = category;
    const { error } = await supabase.from('Commissions').update(categoryData).eq('id', id);
    if (error) console.error('Error al actualizar categoría de reunión:', error.message);
    else fetchMeetingCategories();
  };

  const handleDeleteMeetingCategory = async (categoryId: string): Promise<boolean> => {
    if (!supabase) return false;
    const { count: meetingsCount, error: meetingsError } = await supabase.from('Meetings').select('id', { count: 'exact', head: true }).eq('commission_id', categoryId);
    if (meetingsError) { console.error('Error checking for related meetings:', meetingsError.message); alert(`Error al verificar reuniones: ${meetingsError.message}`); return false; }
    if ((meetingsCount ?? 0) > 0) { alert("No se puede eliminar la categoría porque hay reuniones directamente asociadas. Por favor, reasigne o elimine esas reuniones primero."); return false; }
    await supabase.from('participant_commissions').delete().eq('commission_id', categoryId);
    await supabase.from('event_organizing_commissions').delete().eq('commission_id', categoryId);
    const { error: deleteError } = await supabase.from('Commissions').delete().eq('id', categoryId);
    if (deleteError) { console.error('Error al eliminar categoría de reunión:', deleteError.message); alert(`Error: ${deleteError.message}`); return false; }
    fetchMeetingCategories(); return true;
  };

  const handleAddEventCategory = async (category: EventCategory) => {
    if (!supabase) return;
    const insertData: Database['public']['Tables']['EventCategories']['Insert'] = { id: category.id, name: category.name };
    const { error } = await supabase.from('EventCategories').insert([insertData]);
    if (error) console.error('Error al añadir categoría de evento:', error.message);
    else fetchEventCategories();
  };

  const handleUpdateEventCategory = async (category: EventCategory) => {
    if (!supabase) return;
    const { id, ...categoryData } = category;
    const { error } = await supabase.from('EventCategories').update(categoryData).eq('id', id);
    if (error) console.error('Error al actualizar categoría de evento:', error.message);
    else fetchEventCategories();
  };

  const handleDeleteEventCategory = async (categoryId: string): Promise<boolean> => {
    if (!supabase) return false;
    await supabase.from('event_organizing_categories').delete().eq('category_id', categoryId);
    const { error } = await supabase.from('EventCategories').delete().eq('id', categoryId);
    if (error) { console.error('Error al eliminar categoría de evento:', error.message); alert(`Error: ${error.message}`); return false; }
    fetchEventCategories(); return true;
  };

  const clearEditingMeeting = () => setMeetingToEdit(null);
  const clearEditingEvent = () => setEventToEdit(null);

  const renderContent = () => {
    switch (activeView) {
      case ViewKey.MainMenuView:
        return <MainMenuView onNavigate={navigate} currentTheme={theme} toggleTheme={toggleTheme} profile={profile as UserProfile} />;
      case ViewKey.ScheduleMeeting:
        return <ScheduleMeetingView meetings={meetings} participants={participants} meetingCategories={meetingCategories} meetingAttendees={meetingAttendees} participantMeetingCategories={participantMeetingCategories} onAddMeeting={handleAddMeeting} onUpdateMeeting={handleUpdateMeeting} onDeleteMeeting={handleDeleteMeeting} initialMeetingToEdit={meetingToEdit} onAddMeetingCategory={handleAddMeetingCategory} onClearEditingMeeting={clearEditingMeeting} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.Participants:
        return <ParticipantsView participants={participants} meetingCategories={meetingCategories} participantMeetingCategories={participantMeetingCategories} onAddParticipant={handleAddParticipant} onUpdateParticipant={handleUpdateParticipant} onDeleteParticipant={handleDeleteParticipant} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.Companies:
        return <CompaniesView companies={companies} participants={participants} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.Agenda:
        return <AgendaView meetings={meetings} participants={participants} meetingCategories={meetingCategories} events={events} eventCategories={eventCategories} meetingAttendees={meetingAttendees} eventAttendees={eventAttendees} eventOrganizingMeetingCategories={eventOrganizingMeetingCategories} eventOrganizingCategories={eventOrganizingCategories} onEditMeeting={handleEditMeeting} onEditEvent={handleEditEvent} onQuickAddMeeting={handleQuickAddMeeting} onQuickAddEvent={handleQuickAddEvent} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.ManageMeetingCategories:
        return <ManageMeetingCategoriesView meetingCategories={meetingCategories} meetings={meetings} participants={participants} events={events} participantMeetingCategories={participantMeetingCategories} eventOrganizingMeetingCategories={eventOrganizingMeetingCategories} onAddMeetingCategory={handleAddMeetingCategory} onUpdateMeetingCategory={handleUpdateMeetingCategory} onDeleteMeetingCategory={handleDeleteMeetingCategory} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.ManageEvents:
        return <ManageEventsView events={events} participants={participants} meetingCategories={meetingCategories} eventCategories={eventCategories} eventAttendees={eventAttendees} eventOrganizingMeetingCategories={eventOrganizingMeetingCategories} eventOrganizingCategories={eventOrganizingCategories} onAddEvent={handleAddEvent} onUpdateEvent={handleUpdateEvent} onDeleteEvent={handleDeleteEvent} initialEventToEdit={eventToEdit} onAddMeetingCategory={handleAddMeetingCategory} onAddEventCategory={handleAddEventCategory} onClearEditingEvent={clearEditingEvent} onNavigateBack={() => navigate(ViewKey.MainMenuView)} companies={companies} />;
      case ViewKey.ManageEventCategories:
        return <ManageEventCategoriesView eventCategories={eventCategories} events={events} eventOrganizingCategories={eventOrganizingCategories} onAddEventCategory={handleAddEventCategory} onUpdateEventCategory={handleUpdateEventCategory} onDeleteEventCategory={handleDeleteEventCategory} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.StatsView:
        return <StatsView meetings={meetings} participants={participants} companies={companies} meetingCategories={meetingCategories} meetingAttendees={meetingAttendees} participantMeetingCategories={participantMeetingCategories} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.ReportsView:
        return <ReportsView meetings={meetings} events={events} participants={participants} companies={companies} meetingCategories={meetingCategories} eventCategories={eventCategories} meetingAttendees={meetingAttendees} eventAttendees={eventAttendees} eventOrganizingMeetingCategories={eventOrganizingMeetingCategories} eventOrganizingCategories={eventOrganizingCategories} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.AdminUsersView:
        return <AdminUsersView users={users} roles={roles} onUpdate={fetchAllData} onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      case ViewKey.AccountView:
        return <AccountView onNavigateBack={() => navigate(ViewKey.MainMenuView)} />;
      default:
        return (<div className="flex flex-col items-center justify-center h-screen"><h2 className="text-2xl font-bold mb-4">Vista no encontrada</h2><Button onClick={() => navigate(ViewKey.MainMenuView)}>Volver al Menú Principal</Button></div>);
    }
  };

  return <main>{renderContent()}</main>;
};

const InactivityModal: React.FC<{ onConfirm: () => void }> = ({ onConfirm }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8 text-center max-w-sm w-full">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Sesión Suspendida</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Su sesión se ha cerrado por inactividad.</p>
            <Button onClick={onConfirm} variant="primary" size="lg">Aceptar</Button>
        </div>
    </div>
);

const AppWithAuthAndModal = () => {
  const { showInactivityModal, closeInactivityModal } = useAuth();
  
  return (
    <>
      {showInactivityModal && <InactivityModal onConfirm={closeInactivityModal} />}
      <AppContent />
    </>
  );
};

const App = (): JSX.Element => (
  <div className="min-h-screen">
    <AuthProvider>
      <AppWithAuthAndModal />
    </AuthProvider>
  </div>
);

export default App;
