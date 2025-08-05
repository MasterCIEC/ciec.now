// App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  ViewKey, Meeting, Participant, Company, MeetingCategory, Event, EventCategory,
  ParticipantMeetingCategory, MeetingAttendee, EventAttendee, EventOrganizingMeetingCategory, EventOrganizingCategory
} from './types';
import { GALLERY_MENU_ITEMS } from './constants';
import Button from './components/ui/Button';
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

import MainMenuView from './views/MainMenuView';
import ScheduleMeetingView from './views/ScheduleMeetingView';
import ParticipantsView from './views/ParticipantsView';
import CompaniesView from './views/CompaniesView';
import AgendaView from './views/AgendaView';
import ManageMeetingCategoriesView from './views/ManageCommitteesView';
import ManageEventsView from './views/ManageEventsView';
import ManageEventCategoriesView from './views/ManageEventCategoriesView';
import StatsView from './views/StatsView';
import { Theme } from './components/ThemeToggleButton';


const App = (): JSX.Element => {
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


  const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
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

    // 1. Obtener los IDs de los establecimientos afiliados
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
      setCompanies([]); // No hay afiliados, la lista estará vacía
      return;
    }

    const affiliatedIds = affiliations.map(a => a.id_establecimiento);

    // 2. Obtener los detalles de esos establecimientos
    const { data: companiesData, error: companiesError } = await supabase
      .from('establecimientos_completos_remotos')
      .select('id_establecimiento, nombre_establecimiento, rif_compania, email_principal, telefono_principal_1, nombre_municipio')
      .in('id_establecimiento', affiliatedIds);
    
    if (companiesError) {
      console.error('Error al obtener empresas afiliadas:', companiesError.message);
    } else {
      setCompanies(companiesData || []);
    }
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
    if (rawEventsError) {
        console.error('Error fetching raw events:', rawEventsError.message);
        setEvents([]);
        return;
    }
    if (!rawEventsData) {
        setEvents([]);
        return;
    }

    const [eocResult, eocaResult] = await Promise.all([
        supabase.from('event_organizing_commissions').select('*'),
        supabase.from('event_organizing_categories').select('*')
    ]);

    const { data: eocData, error: eocError } = eocResult;
    if (eocError) console.error('Error fetching event_organizing_commissions:', eocError.message);

    const { data: eocaData, error: eocaError } = eocaResult;
    if (eocaError) console.error('Error fetching event_organizing_categories:', eocaError.message);

    const processedEvents = rawEventsData.map(dbEvent => {
        const baseEvent = eventFromSupabase(dbEvent);
        let determinedOrganizerType: 'meeting_category' | 'category' = 'meeting_category';

        if (eocData?.some(link => link.event_id === baseEvent.id)) {
            determinedOrganizerType = 'meeting_category';
        } else if (eocaData?.some(link => link.event_id === baseEvent.id)) {
            determinedOrganizerType = 'category';
        } else {
            console.warn(`Event ${baseEvent.id} ('${baseEvent.subject}') has no organizer links. Defaulting to 'meeting_category'.`);
        }

        return { ...baseEvent, organizerType: determinedOrganizerType } as Event;
    });
    setEvents(processedEvents);
  }, []);


  const fetchParticipantMeetingCategories = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('participant_commissions').select('participant_id, commission_id');
    if (error) console.error('Error fetching participant_commissions:', error.message);
    else {
      const mappedData = data ? data.map(item => ({ participant_id: item.participant_id, meeting_category_id: item.commission_id })) : [];
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
        const mappedData = data ? data.map(item => ({ event_id: item.event_id, meeting_category_id: item.commission_id })) : [];
        setEventOrganizingMeetingCategories(mappedData);
    }
  }, []);

  const fetchEventOrganizingCategories = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('event_organizing_categories').select('*');
    if (error) console.error('Error fetching event_organizing_categories:', error.message);
    else setEventOrganizingCategories(data || []);
  }, []);


  useEffect(() => {
    if (supabase) {
      fetchMeetingCategories();
      fetchCompanies();
      fetchParticipants();
      fetchMeetings();
      fetchEventCategories();
      fetchEvents();
      fetchParticipantMeetingCategories();
      fetchMeetingAttendees();
      fetchEventAttendees();
      fetchEventOrganizingMeetingCategories();
      fetchEventOrganizingCategories();
    }
  }, [
      fetchMeetingCategories, fetchCompanies, fetchParticipants, fetchMeetings,
      fetchEventCategories, fetchEvents, fetchParticipantMeetingCategories,
      fetchMeetingAttendees, fetchEventAttendees, fetchEventOrganizingMeetingCategories,
      fetchEventOrganizingCategories
    ]);


  const navigate = (viewKey: ViewKey) => {
    if (viewKey !== ViewKey.ScheduleMeeting) setMeetingToEdit(null);
    if (viewKey !== ViewKey.ManageEvents) setEventToEdit(null);
    setActiveView(viewKey);
  };

  const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const generateNextId = (prefix: string, items: Array<{id: string | undefined}>, padLength: number = 6): string => {
    let maxNum = 0;
    items.forEach(item => {
      if (item.id && typeof item.id === 'string' && item.id.startsWith(prefix)) {
        const numStr = item.id.substring(prefix.length);
        if (/^\d+$/.test(numStr)) {
          const num = parseInt(numStr, 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    const nextNum = maxNum + 1;
    return `${prefix}${nextNum.toString().padStart(padLength, '0')}`;
  };


  const handleAddParticipant = async (
    participantData: Omit<Participant, 'id'>,
    selectedCategoryIds: string[]
  ) => {
    if (!supabase) return;

    const newParticipantId = generateNextId('P-', participants);
    const participantWithId = { ...participantData, id: newParticipantId };

    const { data: newParticipantEntry, error: participantError } = await supabase
      .from('Participants')
      .insert([participantToSupabase(participantWithId)]) // Ya usa la nueva estructura
      .select('id')
      .single();

    if (participantError) {
      console.error('Error al añadir participante:', participantError.message);
      return;
    }
    if (newParticipantEntry && selectedCategoryIds.length > 0) {
      const categoryLinks = selectedCategoryIds.map(category_id => ({
        participant_id: newParticipantEntry.id,
        commission_id: category_id,
      }));
      const { error: categoryError } = await supabase.from('participant_commissions').insert(categoryLinks);
      if (categoryError) console.error('Error al enlazar categorías con participante:', categoryError.message);
    }
    fetchParticipants();
    fetchParticipantMeetingCategories();
  };

  const handleUpdateParticipant = async (
    participantId: string,
    participantData: Omit<Participant, 'id'>,
    selectedCategoryIds: string[]
  ) => {
    if (!supabase) return;
    const { error: participantError } = await supabase
      .from('Participants')
      .update(participantToSupabaseForUpdate(participantData)) // Ya usa la nueva estructura
      .eq('id', participantId);

    if (participantError) {
      console.error('Error al actualizar participante:', participantError.message);
      return;
    }

    const { error: deleteError } = await supabase.from('participant_commissions').delete().eq('participant_id', participantId);
    if (deleteError) console.error('Error al eliminar categorías antiguas del participante:', deleteError.message);

    if (selectedCategoryIds.length > 0) {
      const categoryLinks = selectedCategoryIds.map(category_id => ({
        participant_id: participantId,
        commission_id: category_id,
      }));
      const { error: insertError } = await supabase.from('participant_commissions').insert(categoryLinks);
      if (insertError) console.error('Error al insertar nuevas categorías para el participante:', insertError.message);
    }
    fetchParticipants();
    fetchParticipantMeetingCategories();
  };

  const handleDeleteParticipant = async (participantId: string) => {
    if (!supabase) return;
    await supabase.from('participant_commissions').delete().eq('participant_id', participantId);
    await supabase.from('meeting_attendees').delete().eq('participant_id', participantId);
    await supabase.from('event_attendees').delete().eq('participant_id', participantId);

    const { error } = await supabase.from('Participants').delete().eq('id', participantId);
    if (error) console.error('Error al eliminar participante:', error.message);
    else {
      fetchParticipants();
      fetchParticipantMeetingCategories();
      fetchMeetingAttendees();
      fetchEventAttendees();
    }
  };

  // SE ELIMINAN los manejadores para Company
  /*
  const handleAddCompany = ...
  const handleUpdateCompany = ...
  const handleDeleteCompany = ...
  */

  // El resto de manejadores (Meeting, Event, etc.) se mantienen igual
  const handleAddMeeting = async (
    meetingData: Omit<Meeting, 'id'>,
    selectedAttendeesInPersonIds: string[],
    selectedAttendeesOnlineIds: string[]
  ) => {
    if (!supabase) return;
    const transformedMeetingData = {
      ...meetingData,
      subject: toTitleCase(meetingData.subject)
    };
    const { data: newMeeting, error: meetingError } = await supabase
      .from('Meetings')
      .insert([meetingToSupabase(transformedMeetingData)])
      .select('id')
      .single();

    if (meetingError) {
      console.error('Error al añadir reunión:', meetingError.message);
      return;
    }
    if (newMeeting) {
      const attendeesToInsert: { participant_id: string; attendance_type: 'in_person' | 'online' }[] = [];
      selectedAttendeesInPersonIds.forEach(participant_id => attendeesToInsert.push({ participant_id, attendance_type: 'in_person' }));
      selectedAttendeesOnlineIds.forEach(participant_id => attendeesToInsert.push({ participant_id, attendance_type: 'online' }));

      if (attendeesToInsert.length > 0) {
        const finalAttendees = attendeesToInsert.map(att => ({ ...att, meeting_id: newMeeting.id }));
        const { error: attendeesError } = await supabase.from('meeting_attendees').insert(finalAttendees);
        if (attendeesError) console.error('Error al añadir asistentes a la reunión:', attendeesError.message);
      }
    }
    fetchMeetings();
    fetchMeetingAttendees();
    setMeetingToEdit(null);
  };

  const handleUpdateMeeting = async (
    meetingId: string,
    meetingData: Omit<Meeting, 'id'>,
    selectedAttendeesInPersonIds: string[],
    selectedAttendeesOnlineIds: string[]
  ) => {
    if (!supabase) return;
    const transformedMeetingData = {
      ...meetingData,
      subject: toTitleCase(meetingData.subject)
    };
    const { error: meetingError } = await supabase
      .from('Meetings')
      .update(meetingToSupabaseForUpdate(transformedMeetingData))
      .eq('id', meetingId);

    if (meetingError) {
      console.error('Error al actualizar reunión:', meetingError.message);
      return;
    }

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
    fetchMeetings();
    fetchMeetingAttendees();
    setMeetingToEdit(null);
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!supabase) return;
    await supabase.from('meeting_attendees').delete().eq('meeting_id', meetingId);

    const { error } = await supabase.from('Meetings').delete().eq('id', meetingId);
    if (error) console.error('Error al eliminar reunión:', error.message);
    else {
      fetchMeetings();
      fetchMeetingAttendees();
    }
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setMeetingToEdit(meeting);
    navigate(ViewKey.ScheduleMeeting);
  };

  const handleQuickAddMeeting = async (meetingData: Omit<Meeting, 'id'>) => {
    if (!supabase) return;

    const transformedMeetingData = {
      ...meetingData,
      subject: toTitleCase(meetingData.subject)
    };
    const { error } = await supabase
      .from('Meetings')
      .insert([meetingToSupabase(transformedMeetingData)]);

    if (error) {
      console.error('Error al añadir reunión rápida:', error.message);
      alert(`Error al guardar la reunión: ${error.message}`);
    } else {
      fetchMeetings();
    }
  };

  const handleAddEvent = async (
    eventData: Omit<Event, 'id'>,
    selectedOrganizerIds: string[],
    selectedAttendeesInPersonIds: string[],
    selectedAttendeesOnlineIds: string[]
  ) => {
    if (!supabase) return;

    const transformedEventData = {
      ...eventData,
      subject: toTitleCase(eventData.subject)
    };

    const { data: newEvent, error: eventError } = await supabase
      .from('Events')
      .insert([eventToSupabase(transformedEventData)])
      .select('id')
      .single();

    if (eventError) {
      console.error('Error al añadir evento:', eventError.message);
      return;
    }

    if (newEvent) {
      if (selectedOrganizerIds.length > 0) {
        if (transformedEventData.organizerType === 'meeting_category') {
          const links = selectedOrganizerIds.map(id => ({ event_id: newEvent.id, commission_id: id }));
          await supabase.from('event_organizing_commissions').insert(links);
        } else {
          const links = selectedOrganizerIds.map(id => ({ event_id: newEvent.id, category_id: id }));
          await supabase.from('event_organizing_categories').insert(links);
        }
      }

      const attendeesToInsert: { participant_id: string; attendance_type: 'in_person' | 'online' }[] = [];
      selectedAttendeesInPersonIds.forEach(p_id => attendeesToInsert.push({ participant_id: p_id, attendance_type: 'in_person' }));
      selectedAttendeesOnlineIds.forEach(p_id => attendeesToInsert.push({ participant_id: p_id, attendance_type: 'online' }));

      if (attendeesToInsert.length > 0) {
        const finalAttendees = attendeesToInsert.map(att => ({ ...att, event_id: newEvent.id }));
        await supabase.from('event_attendees').insert(finalAttendees);
      }
    }
    fetchEvents();
    fetchEventAttendees();
    fetchEventOrganizingMeetingCategories();
    fetchEventOrganizingCategories();
    setEventToEdit(null);
  };

  const handleUpdateEvent = async (
    eventId: string,
    eventData: Omit<Event, 'id'>,
    selectedOrganizerIds: string[],
    selectedAttendeesInPersonIds: string[],
    selectedAttendeesOnlineIds: string[]
  ) => {
    if (!supabase) return;
    
    const transformedEventData = {
      ...eventData,
      subject: toTitleCase(eventData.subject)
    };

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

    fetchEvents();
    fetchEventAttendees();
    fetchEventOrganizingMeetingCategories();
    fetchEventOrganizingCategories();
    setEventToEdit(null);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!supabase) return;
    await supabase.from('event_attendees').delete().eq('event_id', eventId);
    await supabase.from('event_organizing_commissions').delete().eq('event_id', eventId);
    await supabase.from('event_organizing_categories').delete().eq('event_id', eventId);

    const { error } = await supabase.from('Events').delete().eq('id', eventId);
    if (error) console.error('Error al eliminar evento:', error.message);
    else {
      fetchEvents();
    }
  };

  const handleEditEvent = (event: Event) => {
    setEventToEdit(event);
    navigate(ViewKey.ManageEvents);
  };

  const handleQuickAddEvent = async (eventData: Omit<Event, 'id'>, organizerId: string) => {
    if (!supabase) return;

    const transformedEventData = {
      ...eventData,
      subject: toTitleCase(eventData.subject)
    };

    const { data: newEvent, error: eventError } = await supabase
      .from('Events')
      .insert([eventToSupabase(transformedEventData)])
      .select('id')
      .single();

    if (eventError) {
      console.error('Error al añadir evento rápido:', eventError.message);
      alert(`Error al guardar el evento: ${eventError.message}`);
      return;
    }

    if (newEvent) {
      if (transformedEventData.organizerType === 'meeting_category') {
        const { error } = await supabase.from('event_organizing_commissions').insert([{ event_id: newEvent.id, commission_id: organizerId }]);
        if (error) console.error('Error al enlazar categoría de reunión con evento:', error.message);
        else fetchEventOrganizingMeetingCategories();
      } else {
        const { error } = await supabase.from('event_organizing_categories').insert([{ event_id: newEvent.id, category_id: organizerId }]);
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
    const updateData: Database['public']['Tables']['Commissions']['Update'] = categoryData;
    const { error } = await supabase.from('Commissions').update(updateData).eq('id', id);
    if (error) console.error('Error al actualizar categoría de reunión:', error.message);
    else fetchMeetingCategories();
  };

  const handleDeleteMeetingCategory = async (categoryId: string): Promise<boolean> => {
    if (!supabase) return false;

    // Hard check for meetings with a direct foreign key. Deletion is blocked if these exist.
    const { count: meetingsCount, error: meetingsError } = await supabase.from('Meetings').select('id', { count: 'exact', head: true }).eq('commission_id', categoryId);
    
    if (meetingsError) {
        console.error('Error checking for related meetings:', meetingsError.message);
        alert(`Error al verificar reuniones: ${meetingsError.message}`);
        return false;
    }

    if ((meetingsCount ?? 0) > 0) {
        // This alert is a fallback. The UI should prevent this call from being made.
        alert("No se puede eliminar la categoría porque hay reuniones directamente asociadas. Por favor, reasigne o elimine esas reuniones primero.");
        return false;
    }

    // If no hard-linked meetings, we can proceed to delete associations and then the category.
    await supabase.from('participant_commissions').delete().eq('commission_id', categoryId);
    await supabase.from('event_organizing_commissions').delete().eq('commission_id', categoryId);

    const { error: deleteError } = await supabase.from('Commissions').delete().eq('id', categoryId);
    if (deleteError) {
      console.error('Error al eliminar categoría de reunión:', deleteError.message);
      alert(`Error: ${deleteError.message}`);
      return false;
    }
    
    fetchMeetingCategories();
    return true;
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
    const updateData: Database['public']['Tables']['EventCategories']['Update'] = categoryData;
    const { error } = await supabase.from('EventCategories').update(updateData).eq('id', id);
    if (error) console.error('Error al actualizar categoría de evento:', error.message);
    else fetchEventCategories();
  };

  const handleDeleteEventCategory = async (categoryId: string): Promise<boolean> => {
    if (!supabase) return false;

    // Associations will be removed, then the category. This is less restrictive.
    await supabase.from('event_organizing_categories').delete().eq('category_id', categoryId);

    const { error } = await supabase.from('EventCategories').delete().eq('id', categoryId);
    if (error) {
      console.error('Error al eliminar categoría de evento:', error.message);
      alert(`Error: ${error.message}`);
      return false;
    }
    fetchEventCategories();
    return true;
  };

  const clearEditingMeeting = () => setMeetingToEdit(null);
  const clearEditingEvent = () => setEventToEdit(null);

  const renderContent = () => {
    switch (activeView) {
      case ViewKey.MainMenuView:
        return <MainMenuView onNavigate={navigate} currentTheme={theme} toggleTheme={toggleTheme} />;
      case ViewKey.ScheduleMeeting:
        return <ScheduleMeetingView
          meetings={meetings}
          participants={participants}
          meetingCategories={meetingCategories}
          meetingAttendees={meetingAttendees}
          participantMeetingCategories={participantMeetingCategories}
          onAddMeeting={handleAddMeeting}
          onUpdateMeeting={handleUpdateMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          initialMeetingToEdit={meetingToEdit}
          onClearEditingMeeting={clearEditingMeeting}
          onNavigateBack={() => navigate(ViewKey.MainMenuView)}
        />;
      case ViewKey.Participants:
        return <ParticipantsView
          participants={participants}
          meetingCategories={meetingCategories}
          participantMeetingCategories={participantMeetingCategories}
          onAddParticipant={handleAddParticipant}
          onUpdateParticipant={handleUpdateParticipant}
          onDeleteParticipant={handleDeleteParticipant}
          onNavigateBack={() => navigate(ViewKey.MainMenuView)}
        />;
      case ViewKey.Companies:
        return <CompaniesView
          companies={companies}
          participants={participants}
          onNavigateBack={() => navigate(ViewKey.MainMenuView)}
        />;
      case ViewKey.Agenda:
        return <AgendaView
          meetings={meetings}
          participants={participants}
          meetingCategories={meetingCategories}
          events={events}
          eventCategories={eventCategories}
          meetingAttendees={meetingAttendees}
          eventAttendees={eventAttendees}
          eventOrganizingMeetingCategories={eventOrganizingMeetingCategories}
          eventOrganizingCategories={eventOrganizingCategories}
          onEditMeeting={handleEditMeeting}
          onEditEvent={handleEditEvent}
          onQuickAddMeeting={handleQuickAddMeeting}
          onQuickAddEvent={handleQuickAddEvent}
          onNavigateBack={() => navigate(ViewKey.MainMenuView)}
        />;
      case ViewKey.ManageMeetingCategories:
        return <ManageMeetingCategoriesView
          meetingCategories={meetingCategories}
          meetings={meetings}
          participants={participants}
          events={events}
          participantMeetingCategories={participantMeetingCategories}
          eventOrganizingMeetingCategories={eventOrganizingMeetingCategories}
          onAddMeetingCategory={handleAddMeetingCategory}
          onUpdateMeetingCategory={handleUpdateMeetingCategory}
          onDeleteMeetingCategory={handleDeleteMeetingCategory}
          onNavigateBack={() => navigate(ViewKey.MainMenuView)}
        />;
      case ViewKey.ManageEvents:
        return <ManageEventsView
          events={events}
          participants={participants}
          meetingCategories={meetingCategories}
          eventCategories={eventCategories}
          eventAttendees={eventAttendees}
          eventOrganizingMeetingCategories={eventOrganizingMeetingCategories}
          eventOrganizingCategories={eventOrganizingCategories}
          onAddEvent={handleAddEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
          initialEventToEdit={eventToEdit}
          onClearEditingEvent={clearEditingEvent}
          onNavigateBack={() => navigate(ViewKey.MainMenuView)}
        />;
      case ViewKey.ManageEventCategories:
        return <ManageEventCategoriesView
          eventCategories={eventCategories}
          events={events}
          eventOrganizingCategories={eventOrganizingCategories}
          onAddEventCategory={handleAddEventCategory}
          onUpdateEventCategory={handleUpdateEventCategory}
          onDeleteEventCategory={handleDeleteEventCategory}
          onNavigateBack={() => navigate(ViewKey.MainMenuView)}
        />;
      case ViewKey.StatsView:
        return <StatsView
          meetings={meetings}
          participants={participants}
          companies={companies}
          meetingCategories={meetingCategories}
          meetingAttendees={meetingAttendees}
          participantMeetingCategories={participantMeetingCategories}
          onNavigateBack={() => navigate(ViewKey.MainMenuView)}
        />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-screen">
            <h2 className="text-2xl font-bold mb-4">Vista no encontrada</h2>
            <Button onClick={() => navigate(ViewKey.MainMenuView)}>Volver al Menú Principal</Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen">
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
