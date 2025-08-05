
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Event, Participant, MeetingCategory, EventCategory, EventAttendee, EventOrganizingMeetingCategory, EventOrganizingCategory } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import AddToGoogleCalendar from '../components/AddToGoogleCalendar';
import { generateId } from '../constants';

interface ManageEventsViewProps {
  events: Event[];
  participants: Participant[];
  meetingCategories: MeetingCategory[];
  eventCategories: EventCategory[];
  eventAttendees: EventAttendee[];
  eventOrganizingMeetingCategories: EventOrganizingMeetingCategory[];
  eventOrganizingCategories: EventOrganizingCategory[];
  onAddEvent: (eventData: Omit<Event, 'id'>, selectedOrganizerIds: string[], attendeesInPersonIds: string[], attendeesOnlineIds: string[]) => void;
  onUpdateEvent: (eventId: string, eventData: Omit<Event, 'id'>, selectedOrganizerIds: string[], attendeesInPersonIds: string[], attendeesOnlineIds: string[]) => void;
  onDeleteEvent: (eventId: string) => void;
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
};

const TOTAL_STEPS_CREATE = 5; 
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
  eventAttendees, eventOrganizingMeetingCategories, eventOrganizingCategories,
  onAddEvent, onUpdateEvent, onDeleteEvent,
  initialEventToEdit, onClearEditingEvent, onNavigateBack,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [eventForViewOrEdit, setEventForViewOrEdit] = useState<Event | null>(null);
  const [formData, setFormData] = useState<Omit<Event, 'id'>>(initialEventFormState);
  const [selectedOrganizerIdsState, setSelectedOrganizerIdsState] = useState<string[]>([]);
  const [selectedAttendeesInPerson, setSelectedAttendeesInPerson] = useState<string[]>([]);
  const [selectedAttendeesOnline, setSelectedAttendeesOnline] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrganizer, setFilterOrganizer] = useState(''); 
  const [currentStep, setCurrentStep] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [isEventParticipantSelectorModalOpen, setIsEventParticipantSelectorModalOpen] = useState(false);
  const [eventParticipantSelectionMode, setEventParticipantSelectionMode] = useState<'attendeesInPerson' | 'attendeesOnline' | null>(null);
  const [tempSelectedEventParticipantIds, setTempSelectedEventParticipantIds] = useState<string[]>([]);
  const [eventParticipantSearchTerm, setEventParticipantSearchTerm] = useState('');
  const eventParticipantSelectAllModalCheckboxRef = useRef<HTMLInputElement>(null);
  const [highlightedEventParticipantIndex, setHighlightedEventParticipantIndex] = useState(-1);
  const eventParticipantListRef = useRef<HTMLDivElement>(null);


  const [isOrganizerSelectorModalOpen, setIsOrganizerSelectorModalOpen] = useState(false);
  const [tempSelectedOrganizerIdsModal, setTempSelectedOrganizerIdsModal] = useState<string[]>([]);
  const [organizerSearchTermModal, setOrganizerSearchTermModal] = useState('');
  const organizerSelectAllModalCheckboxRef = useRef<HTMLInputElement>(null);
  const [highlightedOrganizerIndex, setHighlightedOrganizerIndex] = useState(-1);
  const organizerListRef = useRef<HTMLDivElement>(null);

  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);


  const getParticipantName = useCallback((id: string) => participants.find(p => p.id === id)?.name || 'Desconocido', [participants]);
  const getMeetingCategoryName = useCallback((id: string) => meetingCategories.find(c => c.id === id)?.name || 'Categoría de Reunión Desconocida', [meetingCategories]);
  const getEventCategoryName = useCallback((id: string) => eventCategories.find(ec => ec.id === id)?.name || 'Categoría Desconocida', [eventCategories]);
  
  const getDisplayOrganizerNameForEvent = useCallback((eventItem: Event): string => {
    if (!eventItem) return 'Organizador no disponible';

    if (eventItem.organizerType === 'meeting_category') {
      const orgLinks = eventOrganizingMeetingCategories.filter(eoc => eoc.event_id === eventItem.id);
      const categoryNames = orgLinks.map(eoc => getMeetingCategoryName(eoc.meeting_category_id));
      
      if (categoryNames.length === 0) return 'Cat. Reunión No Especificada';
      return `Cat. Reunión: ${categoryNames.join(', ')}`;
    } else { // category
      const orgLinks = eventOrganizingCategories.filter(eoc => eoc.event_id === eventItem.id);
      const categoryNames = orgLinks.map(eoc => getEventCategoryName(eoc.category_id));

      if (categoryNames.length === 0) return 'Cat. Evento No Especificada';
      return categoryNames.join(', ');
    }
  }, [eventOrganizingMeetingCategories, eventOrganizingCategories, getMeetingCategoryName, getEventCategoryName]);


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
      });
      const currentOrganizers = initialEventToEdit.organizerType === 'meeting_category'
        ? eventOrganizingMeetingCategories.filter(eoc => eoc.event_id === initialEventToEdit.id).map(eoc => eoc.meeting_category_id)
        : eventOrganizingCategories.filter(eoc => eoc.event_id === initialEventToEdit.id).map(eoc => eoc.category_id);
      setSelectedOrganizerIdsState(currentOrganizers);

      const currentAttendees = eventAttendees.filter(ea => ea.event_id === initialEventToEdit.id);
      setSelectedAttendeesInPerson(currentAttendees.filter(ea => ea.attendance_type === 'in_person').map(ea => ea.participant_id));
      setSelectedAttendeesOnline(currentAttendees.filter(ea => ea.attendance_type === 'online').map(ea => ea.participant_id));
      
      setModalMode('edit');
      setCurrentStep(1); 
      setFormErrors({});
      setIsModalOpen(true);
    }
  }, [initialEventToEdit, eventAttendees, eventOrganizingMeetingCategories, eventOrganizingCategories]);
  
  useEffect(() => {
    if (isModalOpen && eventForViewOrEdit && (modalMode === 'edit' || modalMode === 'view')) {
        setFormData({
            subject: eventForViewOrEdit.subject, organizerType: eventForViewOrEdit.organizerType,
            date: eventForViewOrEdit.date, startTime: eventForViewOrEdit.startTime,
            endTime: eventForViewOrEdit.endTime || '', location: eventForViewOrEdit.location || '',
            externalParticipantsCount: eventForViewOrEdit.externalParticipantsCount || 0,
            description: eventForViewOrEdit.description || '',
            cost: eventForViewOrEdit.cost, investment: eventForViewOrEdit.investment, revenue: eventForViewOrEdit.revenue,
        });
        const currentOrganizers = eventForViewOrEdit.organizerType === 'meeting_category'
            ? eventOrganizingMeetingCategories.filter(eoc => eoc.event_id === eventForViewOrEdit.id).map(eoc => eoc.meeting_category_id)
            : eventOrganizingCategories.filter(eoc => eoc.event_id === eventForViewOrEdit.id).map(eoc => eoc.category_id);
        setSelectedOrganizerIdsState(currentOrganizers);

        const currentAttendees = eventAttendees.filter(ea => ea.event_id === eventForViewOrEdit.id);
        setSelectedAttendeesInPerson(currentAttendees.filter(ea => ea.attendance_type === 'in_person').map(ea => ea.participant_id));
        setSelectedAttendeesOnline(currentAttendees.filter(ea => ea.attendance_type === 'online').map(ea => ea.participant_id));
    }
  }, [eventForViewOrEdit, modalMode, isModalOpen, eventAttendees, eventOrganizingMeetingCategories, eventOrganizingCategories]);

  const handleOpenCreateModal = () => {
    if (onClearEditingEvent) onClearEditingEvent();
    setEventForViewOrEdit(null);
    setFormData({...initialEventFormState, date: getTodayDateString()});
    setSelectedOrganizerIdsState([]); setSelectedAttendeesInPerson([]); setSelectedAttendeesOnline([]);
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
    if (onClearEditingEvent) onClearEditingEvent();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "organizerType") {
        setFormData(prev => ({ ...prev, organizerType: value as 'meeting_category' | 'category'}));
        setSelectedOrganizerIdsState([]); 
        if (formErrors.organizerId) setFormErrors(prevErrors => ({...prevErrors, organizerId: ''})); 
    }
    else setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({...prev, [name]: ''}));
  };


  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (['cost', 'investment', 'revenue'].includes(name)) setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    else setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : parseInt(value, 10) }));
    if (formErrors[name]) setFormErrors(prev => ({...prev, [name]: ''}));
  };

  const validateCreateStep = () => {
    const errors: Record<string, string> = {};
    if (currentStep === 1 && !formData.subject.trim()) errors.subject = 'El asunto es obligatorio.';
    else if (currentStep === 2 && selectedOrganizerIdsState.length === 0) errors.organizerId = `Debe seleccionar al menos un(a) ${formData.organizerType === 'meeting_category' ? 'categoría de reunión' : 'categoría de evento'}.`;
    else if (currentStep === 3) {
      if (!formData.date) errors.date = 'La fecha es obligatoria.';
      if (!formData.startTime) errors.startTime = 'La hora de inicio es obligatoria.';
      if (formData.endTime && formData.startTime && formData.endTime <= formData.startTime) errors.endTime = 'La hora de fin debe ser posterior a la hora de inicio.';
    } else if (currentStep === 4 && typeof formData.externalParticipantsCount === 'number' && formData.externalParticipantsCount < 0) errors.externalParticipantsCount = 'El número no puede ser negativo.';
    else if (currentStep === 5) {
      if (typeof formData.cost === 'number' && formData.cost < 0) errors.cost = 'El costo no puede ser negativo.';
      if (typeof formData.investment === 'number' && formData.investment < 0) errors.investment = 'La inversión no puede ser negativa.';
      if (typeof formData.revenue === 'number' && formData.revenue < 0) errors.revenue = 'Los ingresos no pueden ser negativos.';
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
    if (typeof formData.externalParticipantsCount === 'number' && formData.externalParticipantsCount < 0) errors.externalParticipantsCount = 'El número no puede ser negativo.';
    if (typeof formData.cost === 'number' && formData.cost < 0) errors.cost = 'El costo no puede ser negativo.';
    if (typeof formData.investment === 'number' && formData.investment < 0) errors.investment = 'La inversión no puede ser negativa.';
    if (typeof formData.revenue === 'number' && formData.revenue < 0) errors.revenue = 'Los ingresos no pueden ser negativos.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStepOrCreate = () => {
    if (validateCreateStep()) {
      if (currentStep < TOTAL_STEPS_CREATE) setCurrentStep(prev => prev + 1);
      else {
        onAddEvent(formData, selectedOrganizerIdsState, selectedAttendeesInPerson, selectedAttendeesOnline);
        setEventForViewOrEdit({...formData, id: generateId()}); 
        setModalMode('view'); 
      }
    }
  };
  const handlePrevStep = () => { if (currentStep > 1) setCurrentStep(prev => prev - 1); };

  const handleUpdateSubmit = () => {
    if (eventForViewOrEdit && validateEditForm()) {
      onUpdateEvent(eventForViewOrEdit.id, formData, selectedOrganizerIdsState, selectedAttendeesInPerson, selectedAttendeesOnline);
      setEventForViewOrEdit({...formData, id: eventForViewOrEdit.id}); 
      handleCloseModal(); 
    }
  };

  const handleOpenEventParticipantSelector = (mode: 'attendeesInPerson' | 'attendeesOnline') => {
    setEventParticipantSelectionMode(mode);
    setTempSelectedEventParticipantIds(mode === 'attendeesInPerson' ? selectedAttendeesInPerson : selectedAttendeesOnline);
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
    const otherModeSelectedIds = eventParticipantSelectionMode === 'attendeesInPerson' ? selectedAttendeesOnline : selectedAttendeesInPerson;
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
    if (eventParticipantSelectionMode === 'attendeesInPerson') setSelectedAttendeesInPerson(tempSelectedEventParticipantIds);
    else if (eventParticipantSelectionMode === 'attendeesOnline') setSelectedAttendeesOnline(tempSelectedEventParticipantIds);
    handleEventParticipantSelectionModalClose();
  };
  
  const handleOpenOrganizerSelector = () => {
    setTempSelectedOrganizerIdsModal(selectedOrganizerIdsState);
    setOrganizerSearchTermModal('');
    setIsOrganizerSelectorModalOpen(true);
  };
  
  const handleOrganizerSelectionModalClose = () => {
    setIsOrganizerSelectorModalOpen(false);
    setTempSelectedOrganizerIdsModal([]);
  };
  
  const handleToggleOrganizerSelection = (organizerId: string) => {
    setTempSelectedOrganizerIdsModal(prev => prev.includes(organizerId) ? prev.filter(id => id !== organizerId) : [...prev, organizerId]);
  };
  
  const availableOrganizersForSelector = useMemo(() => {
    const organizers = formData.organizerType === 'meeting_category' ? meetingCategories : eventCategories;
    return organizers.filter(o => o.name.toLowerCase().includes(organizerSearchTermModal.toLowerCase()));
  }, [formData.organizerType, meetingCategories, eventCategories, organizerSearchTermModal]);
  
  const handleSelectAllOrganizersInModal = () => {
    const allVisibleIds = availableOrganizersForSelector.map(o => o.id);
    const allCurrentlySelectedInModal = availableOrganizersForSelector.length > 0 && availableOrganizersForSelector.every(o => tempSelectedOrganizerIdsModal.includes(o.id));
    if (allCurrentlySelectedInModal) setTempSelectedOrganizerIdsModal(prev => prev.filter(id => !allVisibleIds.includes(id)));
    else setTempSelectedOrganizerIdsModal(prev => [...new Set([...prev, ...allVisibleIds])]);
  };
  
  useEffect(() => {
    if (organizerSelectAllModalCheckboxRef.current && isOrganizerSelectorModalOpen) {
      if (availableOrganizersForSelector.length === 0) {
        organizerSelectAllModalCheckboxRef.current.checked = false;
        organizerSelectAllModalCheckboxRef.current.indeterminate = false;
        return;
      }
      const numSelected = availableOrganizersForSelector.filter(o => tempSelectedOrganizerIdsModal.includes(o.id)).length;
      if (numSelected === availableOrganizersForSelector.length) {
        organizerSelectAllModalCheckboxRef.current.checked = true;
        organizerSelectAllModalCheckboxRef.current.indeterminate = false;
      } else if (numSelected === 0) {
        organizerSelectAllModalCheckboxRef.current.checked = false;
        organizerSelectAllModalCheckboxRef.current.indeterminate = false;
      } else {
        organizerSelectAllModalCheckboxRef.current.checked = false;
        organizerSelectAllModalCheckboxRef.current.indeterminate = true;
      }
    }
  }, [tempSelectedOrganizerIdsModal, availableOrganizersForSelector, isOrganizerSelectorModalOpen]);
  
  const handleConfirmOrganizerSelection = () => {
    setSelectedOrganizerIdsState(tempSelectedOrganizerIdsModal);
    if(formErrors.organizerId) setFormErrors(prev => ({...prev, organizerId: ''}));
    handleOrganizerSelectionModalClose();
  };

  const sidebarOrganizerOptions = useMemo(() => {
    const getCount = (type: 'mc' | 'ec', id: string) => {
        return events.filter(e => {
            if (e.subject.toLowerCase().includes(searchTerm.toLowerCase())) {
                if (type === 'mc' && e.organizerType === 'meeting_category') {
                    return eventOrganizingMeetingCategories.some(link => link.event_id === e.id && link.meeting_category_id === id);
                }
                if (type === 'ec' && e.organizerType === 'category') {
                    return eventOrganizingCategories.some(link => link.event_id === e.id && link.category_id === id);
                }
            }
            return false;
        }).length;
    };
  
    const options = [
      ...meetingCategories.map(c => ({ value: `mc__${c.id}`, label: `Cat. Reunión: ${c.name}`, count: getCount('mc', c.id) })),
      ...eventCategories.map(c => ({ value: `ec__${c.id}`, label: c.name, count: getCount('ec', c.id) })),
    ];
    
    return options
      .filter(opt => opt.count > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [events, meetingCategories, eventCategories, eventOrganizingMeetingCategories, eventOrganizingCategories, searchTerm]);

  useEffect(() => {
    const availableOrganizers = sidebarOrganizerOptions.filter(opt => opt.count > 0);
    const availableOrganizerValues = availableOrganizers.map(opt => opt.value);
    const isFilterOrganizerPresent = availableOrganizerValues.includes(filterOrganizer);

    if (!isFilterOrganizerPresent && availableOrganizers.length > 0) {
      setFilterOrganizer(availableOrganizers[0].value);
    } else if (availableOrganizers.length === 0) {
      setFilterOrganizer('');
    }
  }, [sidebarOrganizerOptions, filterOrganizer]);

  const filteredEvents = useMemo(() => {
    const baseFiltered = events
      .filter(e => (e.subject || '').toLowerCase().includes(searchTerm.toLowerCase()));

    if (!filterOrganizer) return [];
    
    return baseFiltered.filter(e => {
        const [type, id] = filterOrganizer.split('__');
        if (type === 'mc' && e.organizerType === 'meeting_category') {
            return eventOrganizingMeetingCategories.some(link => link.event_id === e.id && link.meeting_category_id === id);
        }
        if (type === 'ec' && e.organizerType === 'category') {
            return eventOrganizingCategories.some(link => link.event_id === e.id && link.category_id === id);
        }
        return false;
    })
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.startTime || '').localeCompare(a.startTime || ''));
  }, [events, searchTerm, filterOrganizer, eventOrganizingMeetingCategories, eventOrganizingCategories]);

  const handleBackNavigation = () => { if (onClearEditingEvent) onClearEditingEvent(); if (onNavigateBack) onNavigateBack(); };
  
  const renderParticipantSelectionButton = (attendeeList: string[], mode: 'attendeesInPerson' | 'attendeesOnline', label: string) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <Button type="button" variant="secondary" onClick={() => handleOpenEventParticipantSelector(mode)} className="w-full justify-center">Seleccionar ({attendeeList.length})</Button>
        {attendeeList.length > 0 && (<div className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-h-16 overflow-y-auto p-1 border dark:border-gray-600 rounded">{attendeeList.map(getParticipantName).join(', ')}</div>)}
    </div>
  );
  
  const organizerTypeLabel = formData.organizerType === 'meeting_category' ? 'Categorías de Reunión' : 'Categorías de Evento';
  const selectedOrganizerNames = selectedOrganizerIdsState.map(id => formData.organizerType === 'meeting_category' ? getMeetingCategoryName(id) : getEventCategoryName(id)).join(', ');
  const renderOrganizerSelectionButton = () => (
      <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{organizerTypeLabel}</label>
          <Button type="button" variant="secondary" onClick={handleOpenOrganizerSelector} className="w-full justify-center">Seleccionar ({selectedOrganizerIdsState.length})</Button>
          {formErrors.organizerId && <p className="text-xs text-red-500 mt-1">{formErrors.organizerId}</p>}
          {selectedOrganizerIdsState.length > 0 && (<div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{selectedOrganizerNames}</div>)}
      </div>
  );

  const renderCreateWizardStepContent = () => {
    switch(currentStep) {
        case 1: return <div className="space-y-4"><Input label="Asunto del Evento" name="subject" value={formData.subject} onChange={handleInputChange} required error={formErrors.subject} autoFocus /><Textarea label="Descripción (Opcional)" name="description" value={formData.description || ''} onChange={handleInputChange} /></div>;
        case 2: return <div className="space-y-4"><Select label="Tipo de Organizador" name="organizerType" value={formData.organizerType} onChange={handleInputChange} options={[{value: 'meeting_category', label: 'Categoría de Reunión'}, {value: 'category', label: 'Categoría de Evento'}]} />{renderOrganizerSelectionButton()}</div>;
        case 3: return <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleInputChange} required error={formErrors.date} className="dark:[color-scheme:dark]" /><Input label="Hora de Inicio" name="startTime" type="time" value={formData.startTime || ''} onChange={handleInputChange} required error={formErrors.startTime} className="dark:[color-scheme:dark]" /></div><Input label="Hora de Fin (Opcional)" name="endTime" type="time" value={formData.endTime || ''} onChange={handleInputChange} error={formErrors.endTime} className="dark:[color-scheme:dark]" /><Input label="Lugar (Opcional)" name="location" value={formData.location || ''} onChange={handleInputChange} /></div>
        case 4: return <div className="space-y-4">{renderParticipantSelectionButton(selectedAttendeesInPerson, 'attendeesInPerson', 'Asistentes Presenciales (Opcional)')}{renderParticipantSelectionButton(selectedAttendeesOnline, 'attendeesOnline', 'Asistentes En Línea (Opcional)')}<Input label="Nº Participantes Externos (Opcional)" name="externalParticipantsCount" type="number" min="0" value={formData.externalParticipantsCount || 0} onChange={handleNumberInputChange} error={formErrors.externalParticipantsCount} /></div>;
        case 5: return <div className="space-y-4"><Input label="Costo" name="cost" type="number" value={formData.cost ?? ''} onChange={handleNumberInputChange} error={formErrors.cost} prefix="$" placeholder="0.00" /><Input label="Inversión" name="investment" type="number" value={formData.investment ?? ''} onChange={handleNumberInputChange} error={formErrors.investment} prefix="$" placeholder="0.00" /><Input label="Ingresos" name="revenue" type="number" value={formData.revenue ?? ''} onChange={handleNumberInputChange} error={formErrors.revenue} prefix="$" placeholder="0.00" /></div>;
        default: return null;
    }
  };

  const renderEditFormContent = () => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <Input label="Asunto del Evento" name="subject" value={formData.subject} onChange={handleInputChange} required error={formErrors.subject} autoFocus />
      <Textarea label="Descripción (Opcional)" name="description" value={formData.description || ''} onChange={handleInputChange} />
      <Select label="Tipo de Organizador" name="organizerType" value={formData.organizerType} onChange={handleInputChange} options={[{value: 'meeting_category', label: 'Categoría de Reunión'}, {value: 'category', label: 'Categoría de Evento'}]} />
      {renderOrganizerSelectionButton()}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleInputChange} required error={formErrors.date} className="dark:[color-scheme:dark]" /><Input label="Hora de Inicio" name="startTime" type="time" value={formData.startTime || ''} onChange={handleInputChange} required error={formErrors.startTime} className="dark:[color-scheme:dark]" /></div>
      <Input label="Hora de Fin (Opcional)" name="endTime" type="time" value={formData.endTime || ''} onChange={handleInputChange} error={formErrors.endTime} className="dark:[color-scheme:dark]" />
      <Input label="Lugar (Opcional)" name="location" value={formData.location || ''} onChange={handleInputChange} />
      {renderParticipantSelectionButton(selectedAttendeesInPerson, 'attendeesInPerson', 'Asistentes Presenciales')}
      {renderParticipantSelectionButton(selectedAttendeesOnline, 'attendeesOnline', 'Asistentes En Línea')}
      <Input label="Nº Participantes Externos (Opcional)" name="externalParticipantsCount" type="number" min="0" value={formData.externalParticipantsCount || 0} onChange={handleNumberInputChange} error={formErrors.externalParticipantsCount} />
      <Input label="Costo" name="cost" type="number" min="0" step="0.01" value={formData.cost ?? ''} onChange={handleNumberInputChange} error={formErrors.cost} prefix="$" placeholder="0.00" />
      <Input label="Inversión" name="investment" type="number" min="0" step="0.01" value={formData.investment ?? ''} onChange={handleNumberInputChange} error={formErrors.investment} prefix="$" placeholder="0.00" />
      <Input label="Ingresos" name="revenue" type="number" min="0" step="0.01" value={formData.revenue ?? ''} onChange={handleNumberInputChange} error={formErrors.revenue} prefix="$" placeholder="0.00" />
    </div>
  );

  const renderViewEventContent = () => {
    if (!eventForViewOrEdit) return <p>No hay detalles de evento para mostrar.</p>;
    const event = eventForViewOrEdit;
    const attendees = eventAttendees.filter(ea => ea.event_id === event.id);
    const inPersonNames = attendees.filter(a => a.attendance_type === 'in_person').map(a => getParticipantName(a.participant_id)).join(', ');
    const onlineNames = attendees.filter(a => a.attendance_type === 'online').map(a => getParticipantName(a.participant_id)).join(', ');
    const organizerName = getDisplayOrganizerNameForEvent(event);

    const eventDetailsForCalendar = {
        title: event.subject,
        startDate: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        description: `Organizador: ${organizerName}\n\n${event.description || ''}`,
        location: event.location || '',
    };
    
    return(
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
        <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{event.subject}</h4>
        <p><strong>Organizador:</strong> {organizerName}</p>
        <p><strong>Fecha:</strong> {new Date(event.date + 'T00:00:00Z').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Hora:</strong> {event.startTime} {event.endTime ? `- ${event.endTime}` : ''}</p>
        {event.location && <p><strong>Lugar:</strong> {event.location}</p>}
        {(inPersonNames || onlineNames || (event.externalParticipantsCount || 0) > 0) && (
            <div className="pt-2 mt-2 border-t dark:border-gray-600">
                <h5 className="font-semibold">Asistentes:</h5>
                {inPersonNames && <p className="text-sm"><strong>Presencial:</strong> {inPersonNames}</p>}
                {onlineNames && <p className="text-sm"><strong>En Línea:</strong> {onlineNames}</p>}
                {(event.externalParticipantsCount || 0) > 0 && <p className="text-sm"><strong>Externos:</strong> {event.externalParticipantsCount}</p>}
            </div>
        )}
        {(typeof event.cost === 'number' || typeof event.investment === 'number' || typeof event.revenue === 'number') && (
            <div className="pt-2 mt-2 border-t dark:border-gray-600">
                <h5 className="font-semibold">Detalles Financieros:</h5>
                {typeof event.cost === 'number' && <p className="text-sm"><strong>Costo:</strong> $ {event.cost.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                {typeof event.investment === 'number' && <p className="text-sm"><strong>Inversión:</strong> $ {event.investment.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                {typeof event.revenue === 'number' && <p className="text-sm"><strong>Ingresos:</strong> $ {event.revenue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
            </div>
        )}
        {event.description && <p className="mt-2"><strong>Descripción:</strong> <span className="italic">{`"${event.description}"`}</span></p>}
         <AddToGoogleCalendar eventDetails={eventDetailsForCalendar} />
      </div>
    );
  };

  const getModalTitle = () => {
    const displayTotalSteps = TOTAL_STEPS_CREATE; 
    if (modalMode === 'create') return `Añadir Nuevo Evento (Paso ${currentStep} de ${displayTotalSteps})`;
    if (modalMode === 'edit') return `Editar Evento: ${eventForViewOrEdit?.subject || 'Evento'}`;
    if (modalMode === 'view') return `Detalles del Evento: ${eventForViewOrEdit?.subject || 'Evento'}`;
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
    
    // Keyboard navigation for organizers
    useEffect(() => { if (isOrganizerSelectorModalOpen) { setHighlightedOrganizerIndex(-1); setTimeout(() => organizerListRef.current?.focus(), 100); } }, [isOrganizerSelectorModalOpen]);
    useEffect(() => { organizerListRef.current?.children[highlightedOrganizerIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [highlightedOrganizerIndex]);
    useEffect(() => { setHighlightedOrganizerIndex(-1); }, [availableOrganizersForSelector]);

    const handleOrganizerKeyDown = (e: React.KeyboardEvent) => {
        const organizers = availableOrganizersForSelector;
        if (!organizers.length) return;
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setHighlightedOrganizerIndex(p => (p + 1) % organizers.length); break;
            case 'ArrowUp': e.preventDefault(); setHighlightedOrganizerIndex(p => (p - 1 + organizers.length) % organizers.length); break;
            case 'Enter': case ' ':
                e.preventDefault();
                if (highlightedOrganizerIndex >= 0) {
                    handleToggleOrganizerSelection(organizers[highlightedOrganizerIndex].id);
                }
                break;
        }
    };


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Eventos</h1>
        <div className="flex space-x-2"><Button onClick={handleOpenCreateModal} variant="primary"><PlusIcon className="w-5 h-5 mr-2" /> Añadir Evento</Button>{onNavigateBack && (<Button onClick={handleBackNavigation} variant="secondary">Volver al Menú</Button>)}</div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="md:w-64 flex-shrink-0">
            <div className="sticky top-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Organizadores</h3>
                <Input containerClassName="mb-4" placeholder="Buscar por asunto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <nav>
                    <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
                        {sidebarOrganizerOptions.map(opt => (
                           <li key={opt.value}>
                               <button
                                   onClick={() => setFilterOrganizer(opt.value)}
                                   className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex justify-between items-center ${
                                       filterOrganizer === opt.value
                                           ? 'bg-primary-600 text-white'
                                           : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                   }`}
                               >
                                   <span className="truncate pr-2">{opt.label}</span>
                                   <span className={`text-xs px-1.5 py-0.5 rounded-full ${ filterOrganizer === opt.value ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>{opt.count}</span>
                               </button>
                           </li>
                        ))}
                         {sidebarOrganizerOptions.length === 0 && <li className='text-sm text-gray-500'>No hay organizadores.</li>}
                    </ul>
                </nav>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-grow">
          {filteredEvents.length === 0 ? (
             <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              {searchTerm || filterOrganizer ? 'No se encontraron eventos que coincidan.' : 'No hay eventos programados.'}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Asunto</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Organizador</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fecha</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Hora</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th></tr></thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredEvents.map(event => (<tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => handleOpenViewModal(event)}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{event.subject}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getDisplayOrganizerNameForEvent(event)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(event.date + 'T00:00:00Z').toLocaleDateString('es-ES')}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{event.startTime}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2"><Button onClick={(e) => { e.stopPropagation(); setEventForViewOrEdit(event); setModalMode('edit'); setIsModalOpen(true); }} variant="ghost" size="sm" className="py-1 px-2 text-indigo-600 dark:text-indigo-400"><EditIcon className="w-4 h-4 mr-1"/>Editar</Button><Button onClick={(e) => { e.stopPropagation(); setEventToDelete(event); }} variant="ghost" size="sm" className="py-1 px-2 text-red-600 dark:text-red-400"><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button></td></tr>))}
                  </tbody>
              </table>
            </div>
          )}
        </main>
      </div>


      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={getModalTitle()}>
        <div className="space-y-4">{modalMode === 'create' && renderCreateWizardStepContent()}{modalMode === 'edit' && renderEditFormContent()}{modalMode === 'view' && renderViewEventContent()}</div>
        <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-200 dark:border-gray-700">
          {modalMode === 'create' && (<><div>{currentStep > 1 && (<Button type="button" variant="secondary" onClick={handlePrevStep}>Anterior</Button>)}</div><div className="space-x-3"><Button type="button" variant="ghost" onClick={handleCloseModal}>Cancelar</Button><Button type="button" variant="primary" onClick={handleNextStepOrCreate}>{currentStep === TOTAL_STEPS_CREATE ? 'Añadir Evento' : 'Siguiente'}</Button></div></>)}
          {modalMode === 'edit' && (<><div /><div className="space-x-3"><Button type="button" variant="ghost" onClick={handleCloseModal}>Cancelar</Button><Button type="button" variant="primary" onClick={handleUpdateSubmit}>Guardar Cambios</Button></div></>)}
          {modalMode === 'view' && eventForViewOrEdit && (<><Button type="button" variant="danger" onClick={() => { if(eventForViewOrEdit) setEventToDelete(eventForViewOrEdit) }} className="mr-auto"><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button><div className="space-x-3"><Button type="button" variant="secondary" onClick={handleCloseModal}>Cerrar</Button><Button type="button" variant="primary" onClick={switchToEditModeFromView}><EditIcon className="w-4 h-4 mr-1"/>Editar</Button></div></>)}
        </div>
      </Modal>

      <Modal isOpen={isOrganizerSelectorModalOpen} onClose={handleOrganizerSelectionModalClose} title={`Seleccionar ${organizerTypeLabel}`} size="lg">
          <div className="space-y-4"><Input type="search" placeholder={`Buscar ${organizerTypeLabel.toLowerCase()}...`} value={organizerSearchTermModal} onChange={(e) => setOrganizerSearchTermModal(e.target.value)} autoFocus />
            {availableOrganizersForSelector.length > 0 && (<div className="flex items-center my-2"><input type="checkbox" id="select-all-organizers-modal" ref={organizerSelectAllModalCheckboxRef} onChange={handleSelectAllOrganizersInModal} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" /><label htmlFor="select-all-organizers-modal" className="ml-2 text-sm">Seleccionar/Deseleccionar todos los visibles</label></div>)}
            <div ref={organizerListRef} tabIndex={-1} onKeyDown={handleOrganizerKeyDown} className="max-h-60 overflow-y-auto border dark:border-gray-600 rounded-md p-2 space-y-1 focus:outline-none focus:ring-2 focus:ring-primary-500">
                {availableOrganizersForSelector.map((o, index) => {
                    const isHighlighted = index === highlightedOrganizerIndex;
                    return (
                        <div key={o.id} onClick={() => handleToggleOrganizerSelection(o.id)} onMouseEnter={() => setHighlightedOrganizerIndex(index)} className={`flex items-center p-1.5 rounded cursor-pointer ${isHighlighted ? 'bg-primary-100 dark:bg-primary-800' : 'hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                            <input type="checkbox" id={`org-select-${o.id}`} checked={tempSelectedOrganizerIdsModal.includes(o.id)} readOnly className="h-4 w-4 text-primary-600 border-gray-300 rounded pointer-events-none" />
                            <label htmlFor={`org-select-${o.id}`} className="ml-2 text-sm w-full pointer-events-none">{o.name}</label>
                        </div>
                    );
                })}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={handleOrganizerSelectionModalClose}>Cancelar</Button><Button variant="primary" onClick={handleConfirmOrganizerSelection}>Confirmar Selección</Button></div>
      </Modal>

      {isEventParticipantSelectorModalOpen && eventParticipantSelectionMode && (<Modal isOpen={isEventParticipantSelectorModalOpen} onClose={handleEventParticipantSelectionModalClose} title={`Seleccionar Asistentes ${eventParticipantSelectionMode === 'attendeesInPerson' ? 'Presenciales' : 'En Línea'}`} size="lg">
          <div className="space-y-4"><Input type="search" placeholder="Buscar participante por nombre..." value={eventParticipantSearchTerm} onChange={(e) => setEventParticipantSearchTerm(e.target.value)} autoFocus />
            {availableEventParticipantsForSelector.length > 0 && (<div className="flex items-center my-2"><input type="checkbox" id="select-all-event-participants-modal" ref={eventParticipantSelectAllModalCheckboxRef} onChange={handleSelectAllFilteredEventParticipants} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" /><label htmlFor="select-all-event-participants-modal" className="ml-2 text-sm">Seleccionar/Deseleccionar todos los visibles y habilitados</label></div>)}
            <div ref={eventParticipantListRef} tabIndex={-1} onKeyDown={handleEventParticipantKeyDown} className="max-h-60 overflow-y-auto border dark:border-gray-600 rounded-md p-2 space-y-1 focus:outline-none focus:ring-2 focus:ring-primary-500">
              {availableEventParticipantsForSelector.length > 0 ? (availableEventParticipantsForSelector.map((p, index) => {
                const isHighlighted = index === highlightedEventParticipantIndex;
                return(
                <div key={p.id} onClick={() => !p.isDisabled && handleToggleEventParticipantSelection(p.id)} onMouseEnter={() => setHighlightedEventParticipantIndex(index)} className={`flex items-center p-1.5 rounded cursor-pointer ${isHighlighted ? 'bg-primary-100 dark:bg-primary-800' : ''} ${p.isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                  <input type="checkbox" id={`event-participant-select-${p.id}`} checked={tempSelectedEventParticipantIds.includes(p.id)} readOnly disabled={p.isDisabled} className="h-4 w-4 text-primary-600 pointer-events-none" />
                  <label htmlFor={`event-participant-select-${p.id}`} className={`ml-2 text-sm w-full pointer-events-none ${p.isDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{p.name} {p.isDisabled && <span className="text-xs italic">(seleccionado en otra modalidad)</span>}</label>
                </div>
              )})) : (<p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No se encontraron participantes.</p>)}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={handleEventParticipantSelectionModalClose}>Cancelar</Button><Button variant="primary" onClick={handleConfirmEventParticipantSelection}>Confirmar Selección</Button></div>
      </Modal>)}

      <Modal isOpen={!!eventToDelete} onClose={() => setEventToDelete(null)} title="Confirmar Eliminación">
        {eventToDelete && (
          <div className="text-sm">
            <p className="mb-4">
              ¿Está seguro de que desea eliminar el evento: <strong>"{eventToDelete.subject}"</strong>?
            </p>
            <p className="mb-4">
              Esta acción también eliminará todos sus registros de asistencia y enlaces de organizador asociados.
            </p>
            <p>Esta acción no se puede deshacer.</p>
            <div className="flex justify-end mt-6 space-x-2">
              <Button variant="secondary" onClick={() => setEventToDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => {
                onDeleteEvent(eventToDelete.id);
                if (isModalOpen && eventForViewOrEdit?.id === eventToDelete.id) {
                    handleCloseModal();
                }
                setEventToDelete(null);
              }}>
                Sí, Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
export default ManageEventsView;
