import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Event, Participant, MeetingCategory, EventCategory, EventAttendee, EventOrganizingMeetingCategory, EventOrganizingCategory, Company, EventInvitee } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import EmailIcon from '../components/icons/EmailIcon';
import { generateId } from '../constants';

const formatTo12Hour = (timeString: string | null | undefined): string => {
  if (!timeString) return 'N/A';
  const [hours, minutes] = timeString.split(':');
  const h = parseInt(hours, 10);
  if (isNaN(h) || !minutes) return timeString;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${minutes} ${ampm}`;
};

interface ManageEventsViewProps {
  events: Event[];
  participants: Participant[];
  meetingCategories: MeetingCategory[];
  eventCategories: EventCategory[];
  eventAttendees: EventAttendee[];
  eventInvitees: EventInvitee[]; // Prop para recibir la lista de invitados
  eventOrganizingMeetingCategories: EventOrganizingMeetingCategory[];
  eventOrganizingCategories: EventOrganizingCategory[];
  companies: Company[];
  onAddEvent: (eventData: Omit<Event, 'id'>, selectedOrganizerIds: string[], inviteeIds: string[], attendeesInPersonIds: string[], attendeesOnlineIds: string[]) => void;
  onUpdateEvent: (eventId: string, eventData: Omit<Event, 'id'>, selectedOrganizerIds: string[], inviteeIds: string[], attendeesInPersonIds: string[], attendeesOnlineIds: string[]) => void;
  onDeleteEvent: (eventId: string) => void;
  onAddMeetingCategory: (category: MeetingCategory) => void;
  onAddEventCategory: (category: EventCategory) => void;
  initialEventToEdit?: Event | null;
  onClearEditingEvent?: () => void;
  onNavigateBack?: () => void;
}

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialEventFormState: Omit<Event, 'id'> = {
  subject: '',
  organizerType: 'meeting_category',
  date: getTodayDateString(),
  startTime: '',
  endTime: '',
  location: '',
  externalParticipantsCount: 0,
  description: '',
  cost: undefined,
  investment: undefined,
  revenue: undefined,
  is_cancelled: false,
  flyer_url: '',
};

const TOTAL_STEPS_CREATE = 4;
type ModalMode = 'create' | 'edit' | 'view';

const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
};

const ManageEventsView: React.FC<ManageEventsViewProps> = ({
  events, participants, meetingCategories, eventCategories,
  eventAttendees, eventInvitees, eventOrganizingMeetingCategories, eventOrganizingCategories,
  companies,
  onAddEvent, onUpdateEvent, onDeleteEvent,
  onAddMeetingCategory, onAddEventCategory,
  initialEventToEdit, onClearEditingEvent, onNavigateBack,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [eventForViewOrEdit, setEventForViewOrEdit] = useState<Event | null>(null);
  const [formData, setFormData] = useState<Omit<Event, 'id'>>(initialEventFormState);
  const [selectedOrganizerIdsState, setSelectedOrganizerIdsState] = useState<string[]>([]);
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);
  const [selectedAttendeesInPerson, setSelectedAttendeesInPerson] = useState<string[]>([]);
  const [selectedAttendeesOnline, setSelectedAttendeesOnline] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrganizer, setSelectedOrganizer] = useState<{ type: string; id: string } | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [isEventParticipantSelectorModalOpen, setIsEventParticipantSelectorModalOpen] = useState(false);
  const [eventParticipantSelectionMode, setEventParticipantSelectionMode] = useState<'attendeesInPerson' | 'attendeesOnline' | 'invitees' | null>(null);
  const [tempSelectedEventParticipantIds, setTempSelectedEventParticipantIds] = useState<string[]>([]);
  const [eventParticipantSearchTerm, setEventParticipantSearchTerm] = useState('');
  const eventParticipantSelectAllModalCheckboxRef = useRef<HTMLInputElement>(null);
  const [highlightedEventParticipantIndex, setHighlightedEventParticipantIndex] = useState(-1);
  const eventParticipantListRef = useRef<HTMLDivElement>(null);

  const [isOrganizerSelectorModalOpen, setIsOrganizerSelectorModalOpen] = useState(false);
  const [tempSelectedOrganizerIdsModal, setTempSelectedOrganizerIdsModal] = useState<string[]>([]);
  const [organizerSearchTermModal, setOrganizerSearchTermModal] = useState('');
  const organizerSelectAllModalCheckboxRef = useRef<HTMLInputElement>(null);

  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [addCatModalType, setAddCatModalType] = useState<'meeting_category' | 'category' | null>(null);
  const [newCatName, setNewCatName] = useState('');

  const [isCompanyEvent, setIsCompanyEvent] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companySuggestions, setCompanySuggestions] = useState<Company[]>([]);

  const [tempOrganizerTypeModal, setTempOrganizerTypeModal] = useState<'meeting_category' | 'category'>('meeting_category');

  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [flyerPreview, setFlyerPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notifyingEventId, setNotifyingEventId] = useState<string | null>(null);


  const getParticipantName = useCallback((id: string) => participants.find(p => p.id === id)?.name || 'Desconocido', [participants]);
  const getMeetingCategoryName = useCallback((id: string) => meetingCategories.find(c => c.id === id)?.name || 'Categoría de Reunión Desconocida', [meetingCategories]);
  const getEventCategoryName = useCallback((id: string) => eventCategories.find(ec => ec.id === id)?.name || 'Categoría Desconocida', [eventCategories]);

  const getDisplayOrganizerNameForEvent = useCallback((eventItem: Event): string => {
    if (!eventItem) return 'Categoría no disponible';

    if (eventItem.organizerType === 'meeting_category') {
      const orgLinks = eventOrganizingMeetingCategories.filter(eoc => eoc.event_id === eventItem.id);
      const categoryNames = orgLinks.map(eoc => getMeetingCategoryName(eoc.meeting_category_id));

      if (categoryNames.length === 0) return 'Cat. Reunión No Especificada';
      return `${categoryNames.join(', ')}`;
    } else { // category
      const orgLinks = eventOrganizingCategories.filter(eoc => eoc.event_id === eventItem.id);
      const categoryNames = orgLinks.map(eoc => getEventCategoryName(eoc.category_id));

      if (categoryNames.length === 0) return 'Cat. Evento No Especificada';
      return categoryNames.join(', ');
    }
  }, [eventOrganizingMeetingCategories, eventOrganizingCategories, getMeetingCategoryName, getEventCategoryName]);

  const handleCompanyInputBlur = () => {
    setTimeout(() => {
      setCompanySuggestions([]);
    }, 200);
    if (selectedCompanyId) return;
    if (modalMode === 'create' && isCompanyEvent && companySearchTerm.trim() && selectedOrganizerIdsState.length > 0) {
      const firstCategoryId = selectedOrganizerIdsState[0];
      const categoryName = formData.organizerType === 'meeting_category'
        ? getMeetingCategoryName(firstCategoryId)
        : getEventCategoryName(firstCategoryId);

      if (categoryName && !categoryName.includes('Desconocida')) {
        setFormData(prev => ({
          ...prev,
          subject: `${categoryName} - ${companySearchTerm.trim()}`
        }));
      }
    }
  };

  useEffect(() => {
    if (modalMode === 'create' && isCompanyEvent && selectedCompanyId && selectedOrganizerIdsState.length > 0) {
      const company = companies.find(c => c.id_establecimiento === selectedCompanyId);
      const firstCategoryId = selectedOrganizerIdsState[0];
      let categoryName = '';
      if (formData.organizerType === 'meeting_category') {
        categoryName = meetingCategories.find(c => c.id === firstCategoryId)?.name || '';
      } else {
        categoryName = eventCategories.find(c => c.id === firstCategoryId)?.name || '';
      }

      if (company && categoryName) {
        setFormData(prev => ({
          ...prev,
          subject: `${categoryName} - ${company.nombre_establecimiento}`
        }));
      }
    }
  }, [isCompanyEvent, selectedCompanyId, selectedOrganizerIdsState, formData.organizerType, companies, meetingCategories, eventCategories, modalMode]);

  useEffect(() => {
    if (companySearchTerm.length > 2) {
      const suggestions = companies.filter(c =>
        normalizeString(c.nombre_establecimiento).includes(normalizeString(companySearchTerm))
      ).slice(0, 5);
      setCompanySuggestions(suggestions);
    } else {
      setCompanySuggestions([]);
    }
  }, [companySearchTerm, companies]);

  useEffect(() => {
    if (initialEventToEdit) {
      setEventForViewOrEdit(initialEventToEdit);
      setFormData({
        subject: initialEventToEdit.subject, organizerType: initialEventToEdit.organizerType,
        date: initialEventToEdit.date, startTime: initialEventToEdit.startTime,
        endTime: initialEventToEdit.endTime || '', location: initialEventToEdit.location || '',
        externalParticipantsCount: initialEventToEdit.externalParticipantsCount || 0,
        description: initialEventToEdit.description || '',
        cost: initialEventToEdit.cost, investment: initialEventToEdit.investment, revenue: initialEventToEdit.revenue,
        is_cancelled: initialEventToEdit.is_cancelled,
        flyer_url: initialEventToEdit.flyer_url,
      });
      const currentOrganizers = initialEventToEdit.organizerType === 'meeting_category'
        ? eventOrganizingMeetingCategories.filter(eoc => eoc.event_id === initialEventToEdit.id).map(eoc => eoc.meeting_category_id)
        : eventOrganizingCategories.filter(eoc => eoc.event_id === initialEventToEdit.id).map(eoc => eoc.category_id);
      setSelectedOrganizerIdsState(currentOrganizers);

      const currentInvitees = eventInvitees.filter(ei => ei.event_id === initialEventToEdit.id).map(ei => ei.participant_id);
      setSelectedInviteeIds(currentInvitees);

      const currentAttendees = eventAttendees.filter(ea => ea.event_id === initialEventToEdit.id);
      setSelectedAttendeesInPerson(currentAttendees.filter(ea => ea.attendance_type === 'in_person').map(ea => ea.participant_id));
      setSelectedAttendeesOnline(currentAttendees.filter(ea => ea.attendance_type === 'online').map(ea => ea.participant_id));

      setFlyerFile(null);
      setFlyerPreview(initialEventToEdit.flyer_url || null);
      setModalMode('edit');
      setCurrentStep(1);
      setFormErrors({});
      setIsModalOpen(true);
    }
  }, [initialEventToEdit, eventAttendees, eventInvitees, eventOrganizingMeetingCategories, eventOrganizingCategories]);

  useEffect(() => {
    if (isModalOpen && eventForViewOrEdit && (modalMode === 'edit' || modalMode === 'view')) {
        setFormData({
            subject: eventForViewOrEdit.subject, organizerType: eventForViewOrEdit.organizerType,
            date: eventForViewOrEdit.date, startTime: eventForViewOrEdit.startTime,
            endTime: eventForViewOrEdit.endTime || '', location: eventForViewOrEdit.location || '',
            externalParticipantsCount: eventForViewOrEdit.externalParticipantsCount || 0,
            description: eventForViewOrEdit.description || '',
            cost: eventForViewOrEdit.cost, investment: eventForViewOrEdit.investment, revenue: eventForViewOrEdit.revenue,
            is_cancelled: eventForViewOrEdit.is_cancelled,
            flyer_url: eventForViewOrEdit.flyer_url,
        });
        const currentOrganizers = eventForViewOrEdit.organizerType === 'meeting_category'
            ? eventOrganizingMeetingCategories.filter(eoc => eoc.event_id === eventForViewOrEdit.id).map(eoc => eoc.meeting_category_id)
            : eventOrganizingCategories.filter(eoc => eoc.event_id === eventForViewOrEdit.id).map(eoc => eoc.category_id);
        setSelectedOrganizerIdsState(currentOrganizers);

        const currentInvitees = eventInvitees.filter(ei => ei.event_id === eventForViewOrEdit.id).map(ei => ei.participant_id);
        setSelectedInviteeIds(currentInvitees);

        const currentAttendees = eventAttendees.filter(ea => ea.event_id === eventForViewOrEdit.id);
        setSelectedAttendeesInPerson(currentAttendees.filter(ea => ea.attendance_type === 'in_person').map(ea => ea.participant_id));
        setSelectedAttendeesOnline(currentAttendees.filter(ea => ea.attendance_type === 'online').map(ea => ea.participant_id));

        setFlyerFile(null);
        setFlyerPreview(eventForViewOrEdit.flyer_url || null);
    }
  }, [eventForViewOrEdit, modalMode, isModalOpen, eventAttendees, eventInvitees, eventOrganizingMeetingCategories, eventOrganizingCategories]);

  useEffect(() => {
    if (!isModalOpen) {
        setIsCompanyEvent(false);
        setCompanySearchTerm('');
        setSelectedCompanyId(null);
    }
  }, [isModalOpen]);


  const handleOpenCreateModal = () => {
    if (onClearEditingEvent) onClearEditingEvent();
    setEventForViewOrEdit(null);
    setFormData({...initialEventFormState, date: getTodayDateString()});
    setSelectedOrganizerIdsState([]); 
    setSelectedInviteeIds([]);
    setSelectedAttendeesInPerson([]); 
    setSelectedAttendeesOnline([]);
    setFlyerFile(null);
    setFlyerPreview(null);
    setCurrentStep(1); setFormErrors({}); setModalMode('create'); setIsModalOpen(true);
  };

  const handleOpenViewModal = (event: Event) => {
    if (onClearEditingEvent) onClearEditingEvent();
    setEventForViewOrEdit(event);
    setFormErrors({}); setModalMode('view'); setIsModalOpen(true);
  };

  const switchToEditModeFromView = () => { if (eventForViewOrEdit) setModalMode('edit'); };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFlyerFile(null);
    setFlyerPreview(null);
    if (onClearEditingEvent) onClearEditingEvent();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({...prev, [name]: ''}));
  };

  // --- CORREGIDO: Función renombrada y con lógica actualizada ---
  const handleSendInvitations = async (event: Event) => {
    const currentInvitees = eventInvitees.filter(ei => ei.event_id === event.id);
    if (currentInvitees.length === 0) {
      alert('No hay invitados registrados para este evento. Por favor, edite el evento y añada invitados antes de enviar las invitaciones.');
      return;
    }
    
    if (window.confirm(`¿Está seguro de que desea enviar ${currentInvitees.length} invitaciones por correo para el evento "${event.subject}"?`)) {
      setNotifyingEventId(event.id);
      try {
          const { error } = await supabase.functions.invoke('notify-event-attendees', {
              body: { eventId: event.id },
          });
          if (error) throw error;
          alert('Invitaciones enviadas con éxito a la cola de procesamiento.');
      } catch (error: any) {
          console.error('Error al enviar invitaciones:', error);
          alert(`Error al enviar invitaciones: ${error.message}`);
      } finally {
          setNotifyingEventId(null);
      }
    }
  };


  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (['cost', 'investment', 'revenue'].includes(name)) setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    else setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : parseInt(value, 10) }));
    if (formErrors[name]) setFormErrors(prev => ({...prev, [name]: ''}));
  };

  const validateCreateStep = () => {
    const errors: Record<string, string> = {};
    if (currentStep === 1) {
      if (!formData.subject.trim()) errors.subject = 'El asunto es obligatorio.';
      if (isCompanyEvent && !selectedCompanyId && !companySearchTerm.trim()) errors.company = 'Debe seleccionar o escribir el nombre de una empresa.';
      if (selectedOrganizerIdsState.length === 0) {
        errors.organizerId = `Debe seleccionar al menos un(a) ${formData.organizerType === 'meeting_category' ? 'categoría de reunión' : 'categoría de evento'}.`;
      }
    } else if (currentStep === 2) {
      if (!formData.date) errors.date = 'La fecha es obligatoria.';
      if (!formData.startTime) errors.startTime = 'La hora de inicio es obligatoria.';
      if (formData.endTime && formData.startTime && formData.endTime <= formData.startTime) errors.endTime = 'La hora de fin debe ser posterior a la hora de inicio.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEditForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.subject.trim()) errors.subject = 'El asunto es obligatorio.';
    if (selectedOrganizerIdsState.length === 0) errors.organizerId = `Debe seleccionar al menos un(a) ${formData.organizerType === 'meeting_category' ? 'categoría de reunión' : 'categoría de evento'}.`;
    if (!formData.date) errors.date = 'La fecha es obligatoria.';
    if (!formData.startTime) errors.startTime = 'La hora de inicio es obligatoria.';
    if (formData.endTime && formData.startTime && formData.endTime <= formData.startTime) errors.endTime = 'La hora de fin debe ser posterior a la hora de inicio.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStepOrCreate = async () => {
    if (validateCreateStep()) {
      if (currentStep < TOTAL_STEPS_CREATE) {
        setCurrentStep(prev => prev + 1);
      } else {
        setIsUploading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          alert('Error: Sesión de usuario no encontrada. Por favor, inicie sesión de nuevo.');
          setIsUploading(false);
          return;
        }

        let flyerUrlToSave: string | null = null;
        if (flyerFile) {
          const fileName = `${Date.now()}_${flyerFile.name}`;
          const { error } = await supabase.storage.from('event_flyers').upload(fileName, flyerFile);
          if (error) {
            alert(`Error al subir el flyer: ${error.message}`);
            setIsUploading(false);
            return;
          }
          const { data } = supabase.storage.from('event_flyers').getPublicUrl(fileName);
          flyerUrlToSave = data.publicUrl;
        }
        const finalEventData = { ...formData, flyer_url: flyerUrlToSave || undefined };
        onAddEvent(finalEventData, selectedOrganizerIdsState, selectedInviteeIds, selectedAttendeesInPerson, selectedAttendeesOnline);
        setIsUploading(false);
        handleCloseModal();
      }
    }
  };
  const handlePrevStep = () => { if (currentStep > 1) setCurrentStep(prev => prev - 1); };

  const handleUpdateSubmit = async () => {
    if (eventForViewOrEdit && validateEditForm()) {
        setIsUploading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          alert('Error: Sesión de usuario no encontrada. Por favor, inicie sesión de nuevo.');
          setIsUploading(false);
          return;
        }

        let flyerUrlToSave: string | null | undefined = eventForViewOrEdit.flyer_url;

        if (flyerFile) {
            const fileName = `${Date.now()}_${flyerFile.name}`;
            const { error } = await supabase.storage.from('event_flyers').upload(fileName, flyerFile, { upsert: true });
            if (error) {
                alert(`Error al subir el flyer: ${error.message}`);
                setIsUploading(false);
                return;
            }
            const { data } = supabase.storage.from('event_flyers').getPublicUrl(fileName);
            flyerUrlToSave = data.publicUrl;
        } else if (flyerPreview === null) {
            flyerUrlToSave = undefined;
        }

        const finalEventData = { ...formData, flyer_url: flyerUrlToSave };
        onUpdateEvent(eventForViewOrEdit.id, finalEventData, selectedOrganizerIdsState, selectedInviteeIds, selectedAttendeesInPerson, selectedAttendeesOnline);
        setIsUploading(false);
        handleCloseModal();
    }
  };

  const handleOpenEventParticipantSelector = (mode: 'attendeesInPerson' | 'attendeesOnline' | 'invitees') => {
    setEventParticipantSelectionMode(mode);
    if (mode === 'invitees') {
      setTempSelectedEventParticipantIds(selectedInviteeIds);
    } else {
      setTempSelectedEventParticipantIds(mode === 'attendeesInPerson' ? selectedAttendeesInPerson : selectedAttendeesOnline);
    }
    setEventParticipantSearchTerm('');
    setIsEventParticipantSelectorModalOpen(true);
  };

  const handleEventParticipantSelectionModalClose = () => {
    setIsEventParticipantSelectorModalOpen(false);
    setEventParticipantSelectionMode(null);
    setTempSelectedEventParticipantIds([]);
  };

  const handleToggleEventParticipantSelection = (participantId: string) => {
    setTempSelectedEventParticipantIds(prev => prev.includes(participantId) ? prev.filter(id => id !== participantId) : [...prev, participantId]);
  };

  const availableEventParticipantsForSelector = useMemo(() => {
    if (!eventParticipantSelectionMode) return [];
    
    let otherModeSelectedIds: string[] = [];
    if (eventParticipantSelectionMode === 'attendeesInPerson') {
      otherModeSelectedIds = selectedAttendeesOnline;
    } else if (eventParticipantSelectionMode === 'attendeesOnline') {
      otherModeSelectedIds = selectedAttendeesInPerson;
    }

    const normalizedSearch = normalizeString(eventParticipantSearchTerm);
    return participants
      .filter(p => normalizeString(p.name).includes(normalizedSearch))
      .map(p => ({ ...p, isDisabled: otherModeSelectedIds.includes(p.id) }));
  }, [participants, eventParticipantSearchTerm, eventParticipantSelectionMode, selectedAttendeesInPerson, selectedAttendeesOnline]);

  const handleSelectAllFilteredEventParticipants = () => {
    const selectableParticipants = availableEventParticipantsForSelector.filter(p => !p.isDisabled);
    const allSelectableIds = selectableParticipants.map(p => p.id);
    const allCurrentlySelectedInModal = selectableParticipants.length > 0 && selectableParticipants.every(p => tempSelectedEventParticipantIds.includes(p.id));

    if (allCurrentlySelectedInModal) {
      setTempSelectedEventParticipantIds(prev => prev.filter(id => !allSelectableIds.includes(id)));
    } else {
      setTempSelectedEventParticipantIds(prev => [...new Set([...prev, ...allSelectableIds])]);
    }
  };

  useEffect(() => {
    if (eventParticipantSelectAllModalCheckboxRef.current && isEventParticipantSelectorModalOpen) {
      const selectable = availableEventParticipantsForSelector.filter(p => !p.isDisabled);
      if (selectable.length === 0) {
        eventParticipantSelectAllModalCheckboxRef.current.checked = false;
        eventParticipantSelectAllModalCheckboxRef.current.indeterminate = false;
        return;
      }
      const numSelected = selectable.filter(p => tempSelectedEventParticipantIds.includes(p.id)).length;
      if (numSelected === selectable.length) {
        eventParticipantSelectAllModalCheckboxRef.current.checked = true;
        eventParticipantSelectAllModalCheckboxRef.current.indeterminate = false;
      } else if (numSelected === 0) {
        eventParticipantSelectAllModalCheckboxRef.current.checked = false;
        eventParticipantSelectAllModalCheckboxRef.current.indeterminate = false;
      } else {
        eventParticipantSelectAllModalCheckboxRef.current.checked = false;
        eventParticipantSelectAllModalCheckboxRef.current.indeterminate = true;
      }
    }
  }, [tempSelectedEventParticipantIds, availableEventParticipantsForSelector, isEventParticipantSelectorModalOpen]);

  const handleConfirmEventParticipantSelection = () => {
    if (eventParticipantSelectionMode === 'invitees') {
      setSelectedInviteeIds(tempSelectedEventParticipantIds);
    } else if (eventParticipantSelectionMode === 'attendeesInPerson') {
      setSelectedAttendeesInPerson(tempSelectedEventParticipantIds);
    } else if (eventParticipantSelectionMode === 'attendeesOnline') {
      setSelectedAttendeesOnline(tempSelectedEventParticipantIds);
    }
    handleEventParticipantSelectionModalClose();
  };
  
  const handleSuggestInvitees = async () => {
    if (selectedOrganizerIdsState.length === 0) {
      alert('Por favor, seleccione primero una categoría para poder sugerir invitados.');
      return;
    }

    let pastEventIds: string[] = [];
    if (formData.organizerType === 'meeting_category') {
      const { data } = await supabase.from('event_organizing_commissions').select('event_id').in('commission_id', selectedOrganizerIdsState);
      pastEventIds = data?.map(e => e.event_id) || [];
    } else {
      const { data } = await supabase.from('event_organizing_categories').select('event_id').in('category_id', selectedOrganizerIdsState);
      pastEventIds = data?.map(e => e.event_id) || [];
    }
    
    if (pastEventIds.length > 0) {
      const { data: pastAttendees } = await supabase.from('event_attendees').select('participant_id').in('event_id', pastEventIds);
      const suggestedIds = pastAttendees?.map(a => a.participant_id) || [];
      
      setTempSelectedEventParticipantIds(prev => [...new Set([...prev, ...suggestedIds])]);
      alert(`${suggestedIds.length} invitados sugeridos y añadidos a la selección actual.`);
    } else {
      alert('No se encontraron eventos pasados en esta categoría para sugerir invitados.');
    }
  };

  const handleOpenOrganizerSelector = () => {
    setTempSelectedOrganizerIdsModal(selectedOrganizerIdsState);
    setTempOrganizerTypeModal(formData.organizerType);
    setOrganizerSearchTermModal('');
    setIsOrganizerSelectorModalOpen(true);
  };

  const handleOrganizerSelectionModalClose = () => {
    setIsOrganizerSelectorModalOpen(false);
  };

  const handleToggleOrganizerSelection = (id: string, type: 'meeting_category' | 'category') => {
    if (type !== tempOrganizerTypeModal) {
        setTempSelectedOrganizerIdsModal([id]);
        setTempOrganizerTypeModal(type);
    } else {
        setTempSelectedOrganizerIdsModal(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    }
  };

  const handleConfirmOrganizerSelection = () => {
    setSelectedOrganizerIdsState(tempSelectedOrganizerIdsModal);
    setFormData(prev => ({ ...prev, organizerType: tempOrganizerTypeModal }));
    if(formErrors.organizerId) setFormErrors(prev => ({...prev, organizerId: ''}));
    handleOrganizerSelectionModalClose();
  };

  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !addCatModalType) return;

    const newId = generateId();

    if (addCatModalType === 'meeting_category') {
      const newCategory: MeetingCategory = { id: newId, name: newCatName.trim() };
      onAddMeetingCategory(newCategory);
    } else {
      const newCategory: EventCategory = { id: newId, name: newCatName.trim() };
      onAddEventCategory(newCategory);
    }

    if (addCatModalType !== tempOrganizerTypeModal) {
      setTempOrganizerTypeModal(addCatModalType);
      setTempSelectedOrganizerIdsModal([newId]);
    } else {
      setTempSelectedOrganizerIdsModal(prev => [...prev, newId]);
    }

    setNewCatName('');
    setIsAddCatModalOpen(false);
    setAddCatModalType(null);
  };

  const eventsFilteredBySearch = useMemo(() =>
    events.filter(e => (e.subject || '').toLowerCase().includes(searchTerm.toLowerCase())),
    [events, searchTerm]
  );

  const sidebarMeetingCategoryOrganizers = useMemo(() => {
      const counts: Record<string, number> = {};
      eventsFilteredBySearch.forEach(event => {
          if (event.organizerType === 'meeting_category') {
              eventOrganizingMeetingCategories.forEach(link => {
                  if (link.event_id === event.id) {
                      counts[link.meeting_category_id] = (counts[link.meeting_category_id] || 0) + 1;
                  }
              });
          }
      });
      return meetingCategories
          .filter(Boolean)
          .map(c => ({ ...c, count: counts[c.id] || 0 }))
          .filter(c => c.count > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
  }, [meetingCategories, eventsFilteredBySearch, eventOrganizingMeetingCategories]);

  const sidebarEventCategoryOrganizers = useMemo(() => {
      const counts: Record<string, number> = {};
      eventsFilteredBySearch.forEach(event => {
          if (event.organizerType === 'category') {
              eventOrganizingCategories.forEach(link => {
                  if (link.event_id === event.id) {
                      counts[link.category_id] = (counts[link.category_id] || 0) + 1;
                  }
              });
          }
      });
      return eventCategories
          .filter(Boolean)
          .map(c => ({ ...c, count: counts[c.id] || 0 }))
          .filter(c => c.count > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
  }, [eventCategories, eventsFilteredBySearch, eventOrganizingCategories]);

  useEffect(() => {
    const allOrganizers = [
        ...sidebarMeetingCategoryOrganizers.map(c => ({ type: 'meeting_category', id: c.id })),
        ...sidebarEventCategoryOrganizers.map(c => ({ type: 'category', id: c.id })),
    ];

    const isSelectedOrganizerStillValid = selectedOrganizer 
        ? allOrganizers.some(org => org.id === selectedOrganizer.id && org.type === selectedOrganizer.type)
        : false;

    if (!isSelectedOrganizerStillValid) {
        if (allOrganizers.length > 0) {
            setSelectedOrganizer(allOrganizers[0]);
        } else {
            setSelectedOrganizer(null);
        }
    }
  }, [sidebarMeetingCategoryOrganizers, sidebarEventCategoryOrganizers]);


  const filteredEvents = useMemo(() => {
    if (!selectedOrganizer) return [];

    if (selectedOrganizer.type === 'meeting_category') {
        const eventIdsForCategory = eventOrganizingMeetingCategories
            .filter(link => link.meeting_category_id === selectedOrganizer.id)
            .map(link => link.event_id);

        return eventsFilteredBySearch
            .filter(event => eventIdsForCategory.includes(event.id))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.startTime || '').localeCompare(a.startTime || ''));
    }

    if (selectedOrganizer.type === 'category') {
        const eventIdsForCategory = eventOrganizingCategories
            .filter(link => link.category_id === selectedOrganizer.id)
            .map(link => link.event_id);

        return eventsFilteredBySearch
            .filter(event => eventIdsForCategory.includes(event.id))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.startTime || '').localeCompare(a.startTime || ''));
    }

    return [];
  }, [eventsFilteredBySearch, selectedOrganizer, eventOrganizingMeetingCategories, eventOrganizingCategories]);

  const handleBackNavigation = () => { if (onClearEditingEvent) onClearEditingEvent(); if (onNavigateBack) onNavigateBack(); };

  const handleFlyerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setFlyerFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setFlyerPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    } else {
        setFlyerFile(null);
        if (eventForViewOrEdit) {
            setFlyerPreview(eventForViewOrEdit.flyer_url || null);
        } else {
            setFlyerPreview(null);
        }
    }
  };

  const renderParticipantSelectionButton = (
    list: string[],
    mode: 'attendeesInPerson' | 'attendeesOnline' | 'invitees',
    label: string
  ) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenEventParticipantSelector(mode)} className="w-full justify-center">
            Seleccionar ({list.length})
          </Button>
          {mode === 'invitees' && (
            <Button type="button" variant="outline" onClick={handleSuggestInvitees}>
              Sugerir
            </Button>
          )}
        </div>
        {list.length > 0 && (<div className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-h-16 overflow-y-auto p-1 border dark:border-gray-600 rounded">{list.map(getParticipantName).join(', ')}</div>)}
    </div>
  );

  const organizerTypeLabel = tempOrganizerTypeModal === 'meeting_category' ? 'Categorías de Reunión' : 'Categorías de Evento';
  const selectedOrganizerNames = selectedOrganizerIdsState.map(id => formData.organizerType === 'meeting_category' ? getMeetingCategoryName(id) : getEventCategoryName(id)).join(', ');

  const renderOrganizerSelectionButton = () => (
      <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría(s)</label>
          <Button type="button" variant="secondary" onClick={handleOpenOrganizerSelector} className="w-full justify-center">Seleccionar Categoría(s) ({selectedOrganizerIdsState.length})</Button>
          {formErrors.organizerId && <p className="text-xs text-red-500 mt-1">{formErrors.organizerId}</p>}
          {selectedOrganizerIdsState.length > 0 && (<div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{selectedOrganizerNames}</div>)}
      </div>
  );

  const renderCreateWizardStepContent = () => {
    switch(currentStep) {
        case 1: return (
          <div className="space-y-4">
            {renderOrganizerSelectionButton()}
            <div className="flex items-center space-x-2 p-2 rounded-md bg-gray-50 dark:bg-slate-700/50">
              <input type="checkbox" id="isCompanyEvent" checked={isCompanyEvent} onChange={(e) => {
                  setIsCompanyEvent(e.target.checked);
                  if (!e.target.checked) {
                      setSelectedCompanyId(null);
                      setCompanySearchTerm('');
                  }
              }} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/>
              <label htmlFor="isCompanyEvent" className="text-sm font-medium text-gray-700 dark:text-gray-300">Evento organizado por empresa</label>
            </div>
            {isCompanyEvent && (
              <div className="relative">
                <Input
                  label="Nombre de la Empresa"
                  value={companySearchTerm}
                  onChange={(e) => { setCompanySearchTerm(e.target.value); setSelectedCompanyId(null); }}
                  onBlur={handleCompanyInputBlur}
                  placeholder="Escriba para buscar o registrar"
                  error={formErrors.company}
                />
                {companySuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
                    {companySuggestions.map(company => (
                      <li key={company.id_establecimiento} className="px-3 py-2 hover:bg-primary-100 dark:hover:bg-primary-800 cursor-pointer" onMouseDown={() => { setSelectedCompanyId(company.id_establecimiento); setCompanySearchTerm(company.nombre_establecimiento); setCompanySuggestions([]); }}>{company.nombre_establecimiento}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Input label="Asunto del Evento" name="subject" value={formData.subject} onChange={handleInputChange} required error={formErrors.subject} />
            <Textarea label="Descripción (Opcional)" name="description" value={formData.description || ''} onChange={handleInputChange} />
          </div>
        );
        case 2: return <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleInputChange} required error={formErrors.date} className="dark:[color-scheme:dark]" /><Input label="Hora de Inicio" name="startTime" type="time" value={formData.startTime || ''} onChange={handleInputChange} required error={formErrors.startTime} className="dark:[color-scheme:dark]" /></div><Input label="Hora de Fin (Opcional)" name="endTime" type="time" value={formData.endTime || ''} onChange={handleInputChange} error={formErrors.endTime} className="dark:[color-scheme:dark]" /><Input label="Lugar (Opcional)" name="location" value={formData.location || ''} onChange={handleInputChange} /></div>
        case 3: return (
          <div className="space-y-4">
            {renderParticipantSelectionButton(selectedInviteeIds, 'invitees', 'Invitados al Evento')}
            <hr className="dark:border-gray-600"/>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Registro de Asistencia (Opcional, post-evento)</h3>
            {renderParticipantSelectionButton(selectedAttendeesInPerson, 'attendeesInPerson', 'Asistentes Presenciales')}
            {renderParticipantSelectionButton(selectedAttendeesOnline, 'attendeesOnline', 'Asistentes En Línea')}
            <Input label="Nº Participantes Externos (Opcional)" name="externalParticipantsCount" type="number" min="0" value={formData.externalParticipantsCount || 0} onChange={handleNumberInputChange} error={formErrors.externalParticipantsCount} />
          </div>
        );
        case 4: return <div className="space-y-4">
            <Input label="Costo" name="cost" type="number" value={formData.cost ?? ''} onChange={handleNumberInputChange} error={formErrors.cost} prefix="$" placeholder="0.00" />
            <Input label="Inversión" name="investment" type="number" value={formData.investment ?? ''} onChange={handleNumberInputChange} error={formErrors.investment} prefix="$" placeholder="0.00" />
            <Input label="Ingresos" name="revenue" type="number" value={formData.revenue ?? ''} onChange={handleNumberInputChange} error={formErrors.revenue} prefix="$" placeholder="0.00" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flyer del Evento (Opcional)</label>
              <Input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFlyerChange} />
              {flyerPreview && (
                  <div className="mt-2 relative w-fit">
                      <img src={flyerPreview} alt="Vista previa del flyer" className="w-full max-w-sm h-auto object-contain rounded shadow" />
                      <Button variant="danger" size="sm" onClick={() => { setFlyerFile(null); setFlyerPreview(null); }} className="absolute top-1 right-1 !p-1 h-auto">
                          <TrashIcon className="w-4 h-4" />
                      </Button>
                  </div>
              )}
            </div>
          </div>;
        default: return null;
    }
  };

  const renderEditFormContent = () => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <Input label="Asunto del Evento" name="subject" value={formData.subject} onChange={handleInputChange} required error={formErrors.subject} autoFocus />
      <Textarea label="Descripción (Opcional)" name="description" value={formData.description || ''} onChange={handleInputChange} />
      {renderOrganizerSelectionButton()}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleInputChange} required error={formErrors.date} className="dark:[color-scheme:dark]" /><Input label="Hora de Inicio" name="startTime" type="time" value={formData.startTime || ''} onChange={handleInputChange} required error={formErrors.startTime} className="dark:[color-scheme:dark]" /></div>
      <Input label="Hora de Fin (Opcional)" name="endTime" type="time" value={formData.endTime || ''} onChange={handleInputChange} error={formErrors.endTime} className="dark:[color-scheme:dark]" />
      <Input label="Lugar (Opcional)" name="location" value={formData.location || ''} onChange={handleInputChange} />
      {renderParticipantSelectionButton(selectedInviteeIds, 'invitees', 'Invitados al Evento')}
      <hr className="dark:border-gray-600"/>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Registro de Asistencia</h3>
      {renderParticipantSelectionButton(selectedAttendeesInPerson, 'attendeesInPerson', 'Asistentes Presenciales')}
      {renderParticipantSelectionButton(selectedAttendeesOnline, 'attendeesOnline', 'Asistentes En Línea')}
      <Input label="Nº Participantes Externos (Opcional)" name="externalParticipantsCount" type="number" min="0" value={formData.externalParticipantsCount || 0} onChange={handleNumberInputChange} error={formErrors.externalParticipantsCount} />
      <Input label="Costo" name="cost" type="number" min="0" step="0.01" value={formData.cost ?? ''} onChange={handleNumberInputChange} error={formErrors.cost} prefix="$" placeholder="0.00" />
      <Input label="Inversión" name="investment" type="number" min="0" step="0.01" value={formData.investment ?? ''} onChange={handleNumberInputChange} error={formErrors.investment} prefix="$" placeholder="0.00" />
      <Input label="Ingresos" name="revenue" type="number" min="0" step="0.01" value={formData.revenue ?? ''} onChange={handleNumberInputChange} error={formErrors.revenue} prefix="$" placeholder="0.00" />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flyer del Evento</label>
        <Input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFlyerChange} />
        {flyerPreview && (
            <div className="mt-2 relative w-fit">
                <img src={flyerPreview} alt="Vista previa del flyer" className="w-full max-w-sm h-auto object-contain rounded shadow" />
                <Button variant="danger" size="sm" onClick={() => { setFlyerFile(null); setFlyerPreview(null); }} className="absolute top-1 right-1 !p-1 h-auto">
                    <TrashIcon className="w-4 h-4" />
                </Button>
            </div>
        )}
      </div>
    </div>
  );

  const renderViewEventContent = () => {
    if (!eventForViewOrEdit) return <p>No hay detalles de evento para mostrar.</p>;
    const event = eventForViewOrEdit;
    const attendees = eventAttendees.filter(ea => ea.event_id === event.id);
    const inPersonCount = attendees.filter(ma => ma.attendance_type === 'in_person').length;
    const onlineCount = attendees.filter(ma => ma.attendance_type === 'online').length;
    const organizerName = getDisplayOrganizerNameForEvent(event);

    return(
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
        <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{event.subject}</h4>
        {event.flyer_url && <img src={event.flyer_url} alt="Flyer del evento" className="w-full h-auto object-contain rounded my-4" />}
        <p><strong>Categoría:</strong> {organizerName}</p>
        <p><strong>Fecha:</strong> {new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</p>
        <p><strong>Hora:</strong> {formatTo12Hour(event.startTime)} {event.endTime ? `- ${formatTo12Hour(event.endTime)}` : '(En curso)'}</p>
        {event.location && <p><strong>Lugar:</strong> {event.location}</p>}
        {(inPersonCount > 0 || onlineCount > 0) && (
            <div className="pt-2 mt-2 border-t dark:border-gray-600">
                <h5 className="font-semibold">Asistentes Registrados:</h5>
                {inPersonCount > 0 && <p className="text-sm"><strong>Presencial:</strong> {inPersonCount} participante(s)</p>}
                {onlineCount > 0 && <p className="text-sm"><strong>En Línea:</strong> {onlineCount} participante(s)</p>}
            </div>
        )}
        {typeof event.externalParticipantsCount === 'number' && event.externalParticipantsCount > 0 && <p><strong>Participantes Externos:</strong> {event.externalParticipantsCount}</p>}
        {event.description && <p className="mt-2"><strong>Descripción:</strong> <span className="italic">{`"${event.description}"`}</span></p>}
      </div>
    );
  };

  const getModalTitle = () => {
    const displayTotalSteps = TOTAL_STEPS_CREATE;
    if (modalMode === 'create') return `Añadir Nuevo Evento (Paso ${currentStep} de ${displayTotalSteps})`;
    if (modalMode === 'edit') return `Editar Evento: ${eventForViewOrEdit?.subject || 'Evento'}`;
    if (modalMode === 'view') return `Detalles del Evento`;
    return 'Evento';
  };

    // Keyboard navigation for event participants
    useEffect(() => { if (isEventParticipantSelectorModalOpen) { setHighlightedEventParticipantIndex(-1); setTimeout(() => eventParticipantListRef.current?.focus(), 100); } }, [isEventParticipantSelectorModalOpen]);
    useEffect(() => { eventParticipantListRef.current?.children[highlightedEventParticipantIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [highlightedEventParticipantIndex]);
    useEffect(() => { setHighlightedEventParticipantIndex(-1); }, [availableEventParticipantsForSelector]);

    const handleEventParticipantKeyDown = (e: React.KeyboardEvent) => {
        const participants = availableEventParticipantsForSelector;
        if (!participants.length) return;
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setHighlightedEventParticipantIndex(p => (p + 1) % participants.length); break;
            case 'ArrowUp': e.preventDefault(); setHighlightedEventParticipantIndex(p => (p - 1 + participants.length) % participants.length); break;
            case 'Enter': case ' ':
                e.preventDefault();
                if (highlightedEventParticipantIndex >= 0) {
                    const p = participants[highlightedEventParticipantIndex];
                    if (!p.isDisabled) handleToggleEventParticipantSelection(p.id);
                }
                break;
        }
    };

    const meetingCategoriesForModal = useMemo(() => meetingCategories.filter(c => normalizeString(c.name).includes(normalizeString(organizerSearchTermModal))), [meetingCategories, organizerSearchTermModal]);
    const eventCategoriesForModal = useMemo(() => eventCategories.filter(c => normalizeString(c.name).includes(normalizeString(organizerSearchTermModal))), [eventCategories, organizerSearchTermModal]);


  return (
    <div className="p-4 sm:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Programar Eventos</h1>
        <div className="flex space-x-2"><Button onClick={handleOpenCreateModal} variant="primary"><PlusIcon className="w-5 h-5 mr-2" /> Añadir Evento</Button>{onNavigateBack && (<Button onClick={handleBackNavigation} variant="secondary">Volver al Menú</Button>)}</div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-grow overflow-hidden">
        {/* Sidebar */}
        <aside className="md:w-64 flex-shrink-0">
          <div className="sticky top-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-full flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Categorías</h3>
            <Input containerClassName="mb-4 flex-shrink-0" placeholder="Buscar por asunto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <nav className="flex-grow overflow-y-auto">
              <ul className="space-y-1">
                {sidebarMeetingCategoryOrganizers.length > 0 && (
                  <>
                    <li className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Por Cat. de Reunión</li>
                    {sidebarMeetingCategoryOrganizers.map(cat => (
                      <li key={`mc-${cat.id}`}>
                        <button
                          onClick={() => setSelectedOrganizer({ type: 'meeting_category', id: cat.id })}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex justify-between items-center ${
                            selectedOrganizer?.type === 'meeting_category' && selectedOrganizer.id === cat.id
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span className="truncate pr-2">{cat.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${ selectedOrganizer?.type === 'meeting_category' && selectedOrganizer.id === cat.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>
                              {cat.count}
                          </span>
                        </button>
                      </li>
                    ))}
                  </>
                )}
                 {sidebarEventCategoryOrganizers.length > 0 && (
                  <>
                    <li className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Por Cat. de Evento</li>
                    {sidebarEventCategoryOrganizers.map(cat => (
                      <li key={`ec-${cat.id}`}>
                        <button
                          onClick={() => setSelectedOrganizer({ type: 'category', id: cat.id })}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex justify-between items-center ${
                            selectedOrganizer?.type === 'category' && selectedOrganizer.id === cat.id
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span className="truncate pr-2">{cat.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${ selectedOrganizer?.type === 'category' && selectedOrganizer.id === cat.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>
                              {cat.count}
                          </span>
                        </button>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-grow overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-md h-full flex items-center justify-center">
              {searchTerm ? 'No se encontraron eventos que coincidan.' : 'No hay eventos para esta categoría.'}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredEvents.map(event => (
                  <div key={event.id} className="bg-white dark:bg-gray-800 shadow-sm rounded-md p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => handleOpenViewModal(event)} role="button" tabIndex={0} aria-label={`Ver detalles de ${event.subject}`}>
                    <div className="flex justify-between items-start w-full gap-3">
                      <div className="flex-grow space-y-0.5">
                        <h3 className="text-md font-semibold text-primary-700 dark:text-primary-400 break-words">{event.subject}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300"><strong>Categoría:</strong> {getDisplayOrganizerNameForEvent(event)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400"><strong>Fecha:</strong> {new Date(event.date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400"><strong>Hora:</strong> {formatTo12Hour(event.startTime)}</p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-stretch gap-2">
                          <Button onClick={(e) => { e.stopPropagation(); handleSendInvitations(event); }} variant="info" size="sm" className="!py-1 !px-2 !text-xs justify-center" disabled={notifyingEventId === event.id} aria-label={`Enviar invitaciones para ${event.subject}`}><EmailIcon className="w-3 h-3 mr-1"/>{notifyingEventId === event.id ? '...' : 'Invitar'}</Button>
                          <Button onClick={(e) => { e.stopPropagation(); setEventForViewOrEdit(event); setModalMode('edit'); setIsModalOpen(true); }} variant="accent" size="sm" className="!py-1 !px-2 !text-xs" aria-label={`Editar ${event.subject}`}><EditIcon className="w-3 h-3 mr-1"/>Editar</Button>
                          <Button onClick={(e) => { e.stopPropagation(); setEventToDelete(event); }} variant="danger" size="sm" className="!py-1 !px-2 !text-xs" aria-label={`Eliminar ${event.subject}`}><TrashIcon className="w-3 h-3 mr-1"/>Eliminar</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asunto</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th></tr></thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                    {filteredEvents.map(event => (<tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => handleOpenViewModal(event)}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{event.subject}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getDisplayOrganizerNameForEvent(event)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(event.date).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatTo12Hour(event.startTime)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <Button onClick={(e) => { e.stopPropagation(); handleSendInvitations(event); }} variant="info" size="sm" disabled={notifyingEventId === event.id} aria-label={`Enviar invitaciones para ${event.subject}`}><EmailIcon className="w-4 h-4 mr-1"/>{notifyingEventId === event.id ? 'Enviando...' : 'Invitar'}</Button>
                          <Button onClick={(e) => { e.stopPropagation(); setEventForViewOrEdit(event); setModalMode('edit'); setIsModalOpen(true); }} variant="accent" size="sm" aria-label={`Editar ${event.subject}`}><EditIcon className="w-4 h-4 mr-1"/>Editar</Button>
                          <Button onClick={(e) => { e.stopPropagation(); setEventToDelete(event); }} variant="danger" size="sm" aria-label={`Eliminar ${event.subject}`}><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button>
                        </div>
                      </td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={getModalTitle()}>
        <div className="space-y-4">{modalMode === 'create' && renderCreateWizardStepContent()}{modalMode === 'edit' && renderEditFormContent()}{modalMode === 'view' && renderViewEventContent()}</div>
        <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-200 dark:border-gray-700">
          {modalMode === 'create' && (
            <>
              <div><Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isUploading}>Cancelar</Button></div>
              <div className="flex items-center space-x-3">
                {currentStep > 1 && (<Button type="button" variant="secondary" onClick={handlePrevStep} disabled={isUploading}>Anterior</Button>)}
                <Button type="button" variant="primary" onClick={handleNextStepOrCreate} disabled={isUploading}>{isUploading ? 'Guardando...' : (currentStep === TOTAL_STEPS_CREATE ? 'Añadir Evento' : 'Siguiente')}</Button>
              </div>
            </>
          )}
          {modalMode === 'edit' && (
            <>
              <div><Button type="button" variant="danger" className="bg-red-600 text-white" onClick={handleCloseModal} disabled={isUploading}>Cancelar</Button></div>
              <Button type="button" variant="primary" onClick={handleUpdateSubmit} disabled={isUploading}>{isUploading ? 'Guardando...' : 'Guardar Cambios'}</Button>
            </>
          )}
          {modalMode === 'view' && eventForViewOrEdit && (
            <div className="w-full flex flex-col sm:flex-row items-center gap-2">
              <Button type="button" variant="info" onClick={() => handleSendInvitations(eventForViewOrEdit)} className="w-full sm:flex-1">
                  <EmailIcon className="w-4 h-4 mr-1"/> Enviar Invitaciones
              </Button>
              <Button type="button" variant="danger" onClick={() => { if(eventForViewOrEdit) setEventToDelete(eventForViewOrEdit) }} className="w-full sm:flex-1">
                  <TrashIcon className="w-4 h-4 mr-1" /> Eliminar
              </Button>
              <Button type="button" variant="accent" onClick={switchToEditModeFromView} className="w-full sm:flex-1">
                  <EditIcon className="w-4 h-4 mr-1" /> Editar
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isOrganizerSelectorModalOpen} onClose={handleOrganizerSelectionModalClose} title="Seleccionar Categoría(s)" size="lg">
        <div className="space-y-4">
            <Input type="search" placeholder="Buscar categorías..." value={organizerSearchTermModal} onChange={(e) => setOrganizerSearchTermModal(e.target.value)} autoFocus />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">Categorías de Evento</h4>
                        <Button type="button" variant="accent" onClick={() => { setIsAddCatModalOpen(true); setAddCatModalType('category'); }} size="sm" className="!p-1.5"><PlusIcon className="w-4 h-4" /></Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border dark:border-slate-600 rounded-md p-2 space-y-1 bg-white dark:bg-gray-700">{eventCategoriesForModal.map(cat => (<div key={cat.id} className="flex items-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600"><input type="checkbox" id={`cat-select-${cat.id}`} checked={tempOrganizerTypeModal === 'category' && tempSelectedOrganizerIdsModal.includes(cat.id)} onChange={() => handleToggleOrganizerSelection(cat.id, 'category')} className="h-4 w-4 text-primary-600 border-gray-300 rounded" /><label htmlFor={`cat-select-${cat.id}`} className="ml-2 text-sm w-full cursor-pointer">{cat.name}</label></div>))}</div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">Categorías de Reunión</h4>
                        <Button type="button" variant="accent" onClick={() => { setIsAddCatModalOpen(true); setAddCatModalType('meeting_category'); }} size="sm" className="!p-1.5"><PlusIcon className="w-4 h-4" /></Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border dark:border-slate-600 rounded-md p-2 space-y-1 bg-white dark:bg-gray-700">{meetingCategoriesForModal.map(cat => (<div key={cat.id} className="flex items-center p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600"><input type="checkbox" id={`mcat-select-${cat.id}`} checked={tempOrganizerTypeModal === 'meeting_category' && tempSelectedOrganizerIdsModal.includes(cat.id)} onChange={() => handleToggleOrganizerSelection(cat.id, 'meeting_category')} className="h-4 w-4 text-primary-600 border-gray-300 rounded" /><label htmlFor={`mcat-select-${cat.id}`} className="ml-2 text-sm w-full cursor-pointer">{cat.name}</label></div>))}</div>
                </div>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Seleccionar una categoría de un tipo diferente reemplazará la selección actual.</div>
        </div>
        <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-slate-700"><Button variant="secondary" onClick={handleOrganizerSelectionModalClose}>Cancelar</Button><Button variant="primary" onClick={handleConfirmOrganizerSelection}>Confirmar</Button></div>
      </Modal>

      <Modal isOpen={isEventParticipantSelectorModalOpen} onClose={handleEventParticipantSelectionModalClose} title={`Seleccionar ${eventParticipantSelectionMode === 'invitees' ? 'Invitados' : `Asistentes ${eventParticipantSelectionMode === 'attendeesInPerson' ? 'Presenciales' : 'En Línea'}`}`} size="lg">
          <div className="space-y-4"><Input type="search" placeholder="Buscar participante por nombre..." value={eventParticipantSearchTerm} onChange={(e) => setEventParticipantSearchTerm(e.target.value)} autoFocus />
            {availableEventParticipantsForSelector.length > 0 && (<div className="flex items-center my-2"><input type="checkbox" id="select-all-participants-modal" className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700" ref={eventParticipantSelectAllModalCheckboxRef} onChange={handleSelectAllFilteredEventParticipants} /><label htmlFor="select-all-participants-modal" className="ml-2 text-sm text-gray-700 dark:text-gray-300">Seleccionar/Deseleccionar todos los visibles y habilitados</label></div>)}
            <div ref={eventParticipantListRef} onKeyDown={handleEventParticipantKeyDown} tabIndex={-1} className="max-h-60 overflow-y-auto border dark:border-gray-600 rounded-md p-2 space-y-1 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
              {availableEventParticipantsForSelector.length > 0 ? (availableEventParticipantsForSelector.map((p, index) => {
                const isHighlighted = index === highlightedEventParticipantIndex;
                return (
                  <div key={p.id} onClick={() => !p.isDisabled && handleToggleEventParticipantSelection(p.id)} onMouseEnter={() => setHighlightedEventParticipantIndex(index)} className={`flex items-center p-1.5 rounded cursor-pointer ${isHighlighted ? 'bg-primary-100 dark:bg-primary-800' : ''} ${p.isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                      <input type="checkbox" id={`participant-select-${p.id}`} checked={tempSelectedEventParticipantIds.includes(p.id)} readOnly disabled={p.isDisabled} className="h-4 w-4 text-primary-600 border-gray-300 rounded pointer-events-none" />
                      <label htmlFor={`participant-select-${p.id}`} className={`ml-2 text-sm w-full pointer-events-none ${p.isDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{p.name} {p.isDisabled ? <span className="text-xs italic">(seleccionado en otra modalidad)</span> : ''}</label>
                  </div>
                )
              })) : (<p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No se encontraron participantes.</p>)}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={handleEventParticipantSelectionModalClose}>Cancelar</Button><Button variant="primary" onClick={handleConfirmEventParticipantSelection}>Confirmar Selección</Button></div>
      </Modal>

      <Modal isOpen={isAddCatModalOpen} onClose={() => setIsAddCatModalOpen(false)} title={`Añadir Nueva ${addCatModalType === 'meeting_category' ? 'Categoría de Reunión' : 'Categoría de Evento'}`}>
        <form onSubmit={handleAddNewCategory} id="add-category-form-events" className="space-y-4">
          <Input label="Nombre de la Categoría" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required autoFocus />
        </form>
        <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={() => setIsAddCatModalOpen(false)}>Cancelar</Button><Button variant="primary" type="submit" form="add-category-form-events">Guardar</Button></div>
      </Modal>

      <Modal isOpen={!!eventToDelete} onClose={() => setEventToDelete(null)} title="Confirmar Eliminación">
        {eventToDelete && (<div className="text-sm"><p className="mb-4">¿Está seguro de que desea eliminar el evento: <strong>"{eventToDelete.subject}"</strong>?</p><p className="mb-4">Esta acción también eliminará todos sus registros de asistencia asociados.</p><p>Esta acción no se puede deshacer.</p><div className="flex justify-end mt-6 space-x-2"><Button variant="secondary" onClick={() => setEventToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={() => {onDeleteEvent(eventToDelete.id); setEventToDelete(null); if (isModalOpen) handleCloseModal();}}>Sí, Eliminar</Button></div></div>)}
      </Modal>
    </div>
  );
};

export default ManageEventsView;