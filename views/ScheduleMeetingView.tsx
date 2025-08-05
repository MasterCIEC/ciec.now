

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Meeting, Participant, MeetingCategory, MeetingAttendee, ParticipantMeetingCategory } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import EmailIcon from '../components/icons/EmailIcon';
import { generateId } from '../constants';

interface ScheduleMeetingViewProps {
  meetings: Meeting[];
  participants: Participant[];
  meetingCategories: MeetingCategory[];
  meetingAttendees: MeetingAttendee[];
  participantMeetingCategories: ParticipantMeetingCategory[]; 
  onAddMeeting: (meeting: Omit<Meeting, 'id'>, attendeesInPersonIds: string[], attendeesOnlineIds: string[]) => void;
  onUpdateMeeting: (meetingId: string, meeting: Omit<Meeting, 'id'>, attendeesInPersonIds: string[], attendeesOnlineIds: string[]) => void;
  onDeleteMeeting: (meetingId: string) => void;
  initialMeetingToEdit?: Meeting | null;
  onClearEditingMeeting?: () => void;
  onNavigateBack?: () => void;
}

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialMeetingFormState: Omit<Meeting, 'id'> = {
  subject: '', 
  meetingCategoryId: '',
  date: getTodayDateString(),
  startTime: '',
  endTime: '',
  location: '',
  externalParticipantsCount: 0,
  description: '',
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

const ScheduleMeetingView: React.FC<ScheduleMeetingViewProps> = ({
  meetings,
  participants,
  meetingCategories,
  meetingAttendees,
  participantMeetingCategories,
  onAddMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
  initialMeetingToEdit,
  onClearEditingMeeting,
  onNavigateBack,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [meetingForViewOrEdit, setMeetingForViewOrEdit] = useState<Meeting | null>(null);
  const [formData, setFormData] = useState<Omit<Meeting, 'id'>>(initialMeetingFormState);
  const [selectedAttendeesInPerson, setSelectedAttendeesInPerson] = useState<string[]>([]);
  const [selectedAttendeesOnline, setSelectedAttendeesOnline] = useState<string[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});

  const [isParticipantSelectorModalOpen, setIsParticipantSelectorModalOpen] = useState(false);
  const [participantSelectionMode, setParticipantSelectionMode] = useState<'attendeesInPerson' | 'attendeesOnline' | null>(null);
  const [tempSelectedParticipantIds, setTempSelectedParticipantIds] = useState<string[]>([]);
  const [participantSearchTerm, setParticipantSearchTerm] = useState('');
  const participantSelectAllModalCheckboxRef = useRef<HTMLInputElement>(null);
  const [highlightedParticipantIndex, setHighlightedParticipantIndex] = useState(-1);
  const participantListRef = useRef<HTMLDivElement>(null);


  const getParticipantName = (id: string) => participants.find(p => p.id === id)?.name || 'Desconocido';
  const getMeetingCategoryName = useMemo(() => (id: string) => meetingCategories.find(c => c.id === id)?.name || 'Categoría Desconocida', [meetingCategories]);

  useEffect(() => {
    if (initialMeetingToEdit && !isModalOpen) { 
      setMeetingForViewOrEdit(initialMeetingToEdit);
      setFormData({
        subject: initialMeetingToEdit.subject, 
        meetingCategoryId: initialMeetingToEdit.meetingCategoryId,
        date: initialMeetingToEdit.date,
        startTime: initialMeetingToEdit.startTime,
        endTime: initialMeetingToEdit.endTime || '',
        location: initialMeetingToEdit.location || '',
        externalParticipantsCount: initialMeetingToEdit.externalParticipantsCount || 0,
        description: initialMeetingToEdit.description || '',
      });
      const currentAttendees = meetingAttendees.filter(ma => ma.meeting_id === initialMeetingToEdit.id);
      setSelectedAttendeesInPerson(currentAttendees.filter(ma => ma.attendance_type === 'in_person').map(ma => ma.participant_id));
      setSelectedAttendeesOnline(currentAttendees.filter(ma => ma.attendance_type === 'online').map(ma => ma.participant_id));
      setModalMode('edit');
      setCurrentStep(1); 
      setFormErrors({});
      setIsModalOpen(true);
    } else if (!initialMeetingToEdit && meetingForViewOrEdit && (modalMode === 'edit' || modalMode === 'view')) {
        setFormData({
            subject: meetingForViewOrEdit.subject,
            meetingCategoryId: meetingForViewOrEdit.meetingCategoryId,
            date: meetingForViewOrEdit.date,
            startTime: meetingForViewOrEdit.startTime,
            endTime: meetingForViewOrEdit.endTime || '',
            location: meetingForViewOrEdit.location || '',
            externalParticipantsCount: meetingForViewOrEdit.externalParticipantsCount || 0,
            description: meetingForViewOrEdit.description || '',
        });
        const currentAttendees = meetingAttendees.filter(ma => ma.meeting_id === meetingForViewOrEdit.id);
        setSelectedAttendeesInPerson(currentAttendees.filter(ma => ma.attendance_type === 'in_person').map(ma => ma.participant_id));
        setSelectedAttendeesOnline(currentAttendees.filter(ma => ma.attendance_type === 'online').map(ma => ma.participant_id));
    } else if (modalMode === 'create' && !initialMeetingToEdit) {
      setFormData({...initialMeetingFormState, date: getTodayDateString(), endTime: '' });
      setSelectedAttendeesInPerson([]);
      setSelectedAttendeesOnline([]);
      setCurrentStep(1);
    }
  }, [initialMeetingToEdit, meetingForViewOrEdit, modalMode, meetingAttendees, isModalOpen]);


  const handleOpenCreateModal = () => {
    setMeetingForViewOrEdit(null);
    setFormData({...initialMeetingFormState, date: getTodayDateString(), endTime: '' });
    setSelectedAttendeesInPerson([]);
    setSelectedAttendeesOnline([]);
    setCurrentStep(1);
    setFormErrors({});
    setModalMode('create');
    setIsModalOpen(true);
    if (onClearEditingMeeting) onClearEditingMeeting();
  };

  const handleOpenViewModal = (meeting: Meeting) => {
    setMeetingForViewOrEdit(meeting); 
    setFormErrors({});
    setModalMode('view');
    setIsModalOpen(true);
    if (onClearEditingMeeting) onClearEditingMeeting();
  };

  const switchToEditModeFromView = () => {
    if (meetingForViewOrEdit) setModalMode('edit'); 
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setMeetingForViewOrEdit(null);
    setFormData(initialMeetingFormState);
    setSelectedAttendeesInPerson([]);
    setSelectedAttendeesOnline([]);
    setCurrentStep(1);
    setFormErrors({});
    if (onClearEditingMeeting) onClearEditingMeeting();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({...prev, [name]: ''}));
  };

  const handleCategoryChangeForCreate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategoryId = e.target.value;
    const newCategoryName = meetingCategories.find(c => c.id === newCategoryId)?.name || '';

    setFormData(prev => {
        const oldCategoryId = prev.meetingCategoryId;
        const oldCategoryName = meetingCategories.find(c => c.id === oldCategoryId)?.name || '';
        const oldDefaultSubject = oldCategoryId ? `Reunión ${oldCategoryName}` : '';
        
        const shouldUpdateSubject = !prev.subject.trim() || prev.subject.trim() === oldDefaultSubject.trim();

        return {
            ...prev,
            meetingCategoryId: newCategoryId,
            subject: shouldUpdateSubject ? (newCategoryId ? `Reunión ${newCategoryName}` : '') : prev.subject
        };
    });

    if (formErrors.meetingCategoryId) {
        setFormErrors(prev => ({ ...prev, meetingCategoryId: '' }));
    }
  };

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : parseFloat(value) }));
    if (formErrors[name]) setFormErrors(prev => ({...prev, [name]: ''}));
  };

  const validateCreateStep = () => {
    const errors: Record<string, string> = {};
    if (currentStep === 1) { 
      if (!formData.subject.trim()) errors.subject = 'El asunto es obligatorio.';
      if (!formData.meetingCategoryId) errors.meetingCategoryId = 'Debe seleccionar una categoría.';
    } 
    else if (currentStep === 2) { 
      if (!formData.date) errors.date = 'La fecha es obligatoria.';
      if (!formData.startTime) errors.startTime = 'La hora de inicio es obligatoria.';
      if (formData.endTime && formData.startTime && formData.endTime <= formData.startTime) errors.endTime = 'La hora de fin debe ser posterior a la hora de inicio.';
    } 
    else if (currentStep === 3) { 
      if (formData.externalParticipantsCount && formData.externalParticipantsCount < 0) errors.externalParticipantsCount = 'El número no puede ser negativo.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEditForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.subject.trim()) errors.subject = 'El asunto es obligatorio.';
    if (!formData.meetingCategoryId) errors.meetingCategoryId = 'Debe seleccionar una categoría.';
    if (!formData.date) errors.date = 'La fecha es obligatoria.';
    if (!formData.startTime) errors.startTime = 'La hora de inicio es obligatoria.';
    if (formData.externalParticipantsCount && formData.externalParticipantsCount < 0) errors.externalParticipantsCount = 'El número no puede ser negativo.';
    if (formData.endTime && formData.startTime && formData.endTime <= formData.startTime) errors.endTime = 'La hora de fin debe ser posterior a la hora de inicio.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStepOrCreate = () => {
    if (validateCreateStep()) {
      if (currentStep < TOTAL_STEPS_CREATE) {
        setCurrentStep(prev => prev + 1);
      } else {
        onAddMeeting(formData, selectedAttendeesInPerson, selectedAttendeesOnline);
        setMeetingForViewOrEdit({...formData, id: generateId()});
        setModalMode('view');
      }
    }
  };

  const handlePrevStep = () => { if (currentStep > 1) setCurrentStep(prev => prev - 1); };

  const handleUpdateSubmit = () => {
    if (meetingForViewOrEdit && validateEditForm()) {
      onUpdateMeeting(meetingForViewOrEdit.id, formData, selectedAttendeesInPerson, selectedAttendeesOnline);
      setMeetingForViewOrEdit({...formData, id: meetingForViewOrEdit.id }); 
      handleCloseModal(); 
    }
  };

  const handleDeleteInternal = (meetingId: string) => {
    const meetingToDelete = meetings.find(m => m.id === meetingId) || meetingForViewOrEdit;
    if (window.confirm(`¿Está seguro de que desea eliminar la reunión: "${meetingToDelete?.subject || ''}"?`)) {
      onDeleteMeeting(meetingId);
      handleCloseModal();
    }
  };

  const handleOpenParticipantSelector = (mode: 'attendeesInPerson' | 'attendeesOnline') => {
    if (!formData.meetingCategoryId) {
        alert("Por favor, seleccione una categoría de reunión primero.");
        return;
    }
    setParticipantSelectionMode(mode);
    setTempSelectedParticipantIds(mode === 'attendeesInPerson' ? selectedAttendeesInPerson : selectedAttendeesOnline);
    setParticipantSearchTerm('');
    setIsParticipantSelectorModalOpen(true);
  };
  const handleParticipantSelectionModalClose = () => { setIsParticipantSelectorModalOpen(false); setParticipantSelectionMode(null); setTempSelectedParticipantIds([]); };

  const handleToggleParticipantSelection = (participantId: string) => {
    setTempSelectedParticipantIds(prev => prev.includes(participantId) ? prev.filter(id => id !== participantId) : [...prev, participantId]);
  };

  const availableParticipantsForSelector = useMemo(() => {
    if (!participantSelectionMode || !formData.meetingCategoryId) return [];

    const participantIdsInSelectedCategory = participantMeetingCategories
      .filter(pc => pc.meeting_category_id === formData.meetingCategoryId)
      .map(pc => pc.participant_id);

    const categoryFilteredParticipants = participants.filter(p =>
      participantIdsInSelectedCategory.includes(p.id)
    );
    
    const otherModeSelectedIds = participantSelectionMode === 'attendeesInPerson' ? selectedAttendeesOnline : selectedAttendeesInPerson;
    const normalizedSearch = normalizeString(participantSearchTerm);

    return categoryFilteredParticipants
      .filter(p => normalizeString(p.name).includes(normalizedSearch))
      .map(p => ({ ...p, isDisabled: otherModeSelectedIds.includes(p.id) }));
  }, [participants, participantSearchTerm, participantSelectionMode, selectedAttendeesInPerson, selectedAttendeesOnline, formData.meetingCategoryId, participantMeetingCategories]);

  const handleSelectAllFilteredParticipants = () => {
    const selectableParticipants = availableParticipantsForSelector.filter(p => !p.isDisabled);
    const allSelectableIds = selectableParticipants.map(p => p.id);
    const allCurrentlySelected = selectableParticipants.length > 0 && selectableParticipants.every(p => tempSelectedParticipantIds.includes(p.id));
    if (allCurrentlySelected) setTempSelectedParticipantIds(prev => prev.filter(id => !allSelectableIds.includes(id)));
    else setTempSelectedParticipantIds(prev => [...new Set([...prev, ...allSelectableIds])]);
  };

  useEffect(() => {
    if (participantSelectAllModalCheckboxRef.current && isParticipantSelectorModalOpen) {
      const selectable = availableParticipantsForSelector.filter(p => !p.isDisabled);
      if (selectable.length === 0) { participantSelectAllModalCheckboxRef.current.checked = false; participantSelectAllModalCheckboxRef.current.indeterminate = false; return; }
      const numSelected = selectable.filter(p => tempSelectedParticipantIds.includes(p.id)).length;
      if (numSelected === selectable.length) { participantSelectAllModalCheckboxRef.current.checked = true; participantSelectAllModalCheckboxRef.current.indeterminate = false; }
      else if (numSelected === 0) { participantSelectAllModalCheckboxRef.current.checked = false; participantSelectAllModalCheckboxRef.current.indeterminate = false; }
      else { participantSelectAllModalCheckboxRef.current.checked = false; participantSelectAllModalCheckboxRef.current.indeterminate = true; }
    }
  }, [tempSelectedParticipantIds, availableParticipantsForSelector, isParticipantSelectorModalOpen]);

  const handleConfirmParticipantSelection = () => {
    if (participantSelectionMode === 'attendeesInPerson') setSelectedAttendeesInPerson(tempSelectedParticipantIds);
    else if (participantSelectionMode === 'attendeesOnline') setSelectedAttendeesOnline(tempSelectedParticipantIds);
    handleParticipantSelectionModalClose();
  };

  const meetingsFilteredBySearch = useMemo(() =>
    meetings.filter(m =>
      (m.subject || '').toLowerCase().includes(searchTerm.toLowerCase())
    ), [meetings, searchTerm]);

  const sidebarCategories = useMemo(() => {
    const counts = meetingsFilteredBySearch.reduce((acc, meeting) => {
        acc[meeting.meetingCategoryId] = (acc[meeting.meetingCategoryId] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return meetingCategories
        .map(c => ({ ...c, count: counts[c.id] || 0 }))
        .filter(c => c.count > 0)
        .sort((a,b) => a.name.localeCompare(b.name));
  }, [meetingCategories, meetingsFilteredBySearch]);

  useEffect(() => {
    const allCategoryIds = sidebarCategories.map(c => c.id);
    const isSelectedCategoryPresent = allCategoryIds.includes(selectedCategoryId);

    if (!isSelectedCategoryPresent && allCategoryIds.length > 0) {
      setSelectedCategoryId(allCategoryIds[0]);
    } else if (allCategoryIds.length === 0) {
      setSelectedCategoryId('');
    }
  }, [sidebarCategories, selectedCategoryId]);

  const filteredMeetings = useMemo(() => {
    if (!selectedCategoryId) return [];
    
    return meetingsFilteredBySearch
      .filter(m => m.meetingCategoryId === selectedCategoryId)
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.startTime || '').localeCompare(a.startTime || ''));
  }, [meetingsFilteredBySearch, selectedCategoryId]);

  const handleBackNavigation = () => { if (onClearEditingMeeting) onClearEditingMeeting(); if (onNavigateBack) onNavigateBack(); };
  
  const isMeetingInProgress = (meeting: Meeting): boolean => {
    if (meeting.endTime) return false;
    try { const now = new Date(); const meetingStartDateTime = new Date(`${meeting.date}T${meeting.startTime}`); return now >= meetingStartDateTime; }
    catch (e) { console.error("Error parsing meeting date/time for progress check:", e); return false; }
  };

  const handleEndMeetingNow = (meetingId: string) => {
    const meetingToEnd = meetings.find(m => m.id === meetingId);
    if (meetingToEnd) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      const currentAttendeesForMeeting = meetingAttendees.filter(ma => ma.meeting_id === meetingId);
      const inPerson = currentAttendeesForMeeting.filter(ma => ma.attendance_type === 'in_person').map(ma => ma.participant_id);
      const online = currentAttendeesForMeeting.filter(ma => ma.attendance_type === 'online').map(ma => ma.participant_id);
      
      onUpdateMeeting(meetingId, { ...meetingToEnd, endTime: currentTime }, inPerson, online);
    }
  };

  const handleSendInvitation = (meeting: Meeting) => {
    const attendees = meetingAttendees.filter(ma => ma.meeting_id === meeting.id);
    const participantEmails = attendees.map(attendee => {
      const participant = participants.find(p => p.id === attendee.participant_id);
      return participant?.email;
    }).filter((email): email is string => !!email);

    if (participantEmails.length === 0) {
      alert('No hay participantes con correos electrónicos registrados para esta reunión.');
      return;
    }

    const to = participantEmails.join(',');
    const subject = encodeURIComponent(`Invitación: ${meeting.subject}`);
    
    const formattedDate = new Date(meeting.date + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const body = encodeURIComponent(
`Hola,

Estás invitado(a) a la siguiente reunión:

Asunto: ${meeting.subject}
Fecha: ${formattedDate}
Hora: ${meeting.startTime || 'No especificada'}${meeting.endTime ? ` - ${meeting.endTime}` : ''}
Lugar: ${meeting.location || 'No especificado'}

Descripción:
${meeting.description || 'Sin descripción.'}

Saludos,
CIEC.Now`
    );

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const renderParticipantSelectionButton = (attendeeList: string[], mode: 'attendeesInPerson' | 'attendeesOnline', label: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <Button type="button" variant="secondary" onClick={() => handleOpenParticipantSelector(mode)} className="w-full justify-center" disabled={!formData.meetingCategoryId}>Seleccionar ({attendeeList.length})</Button>
      {!formData.meetingCategoryId && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Seleccione una categoría para habilitar la selección de participantes.</p>}
      {attendeeList.length > 0 && (<div className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-h-16 overflow-y-auto p-1 border dark:border-gray-600 rounded">{attendeeList.map(getParticipantName).join(', ')}</div>)}
    </div>
  );
  
  const renderCreateWizardStepContent = () => {
    switch (currentStep) {
      case 1: return (<div className="space-y-4"><Select label="Categoría de Reunión" name="meetingCategoryId" value={formData.meetingCategoryId} onChange={handleCategoryChangeForCreate} options={[{value: '', label: 'Seleccione una categoría'}, ...meetingCategories.map(c => ({ value: c.id, label: c.name }))]} required error={formErrors.meetingCategoryId} autoFocus /><Input label="Asunto de la Reunión" name="subject" value={formData.subject} onChange={handleInputChange} required error={formErrors.subject} /></div>);
      case 2: return (<><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleInputChange} required error={formErrors.date} className="dark:[color-scheme:dark]" /><Input label="Hora de Inicio" name="startTime" type="time" value={formData.startTime || ''} onChange={handleInputChange} required error={formErrors.startTime} className="dark:[color-scheme:dark]" /></div><Input label="Hora de Fin (Opcional)" name="endTime" type="time" value={formData.endTime || ''} onChange={handleInputChange} error={formErrors.endTime} className="dark:[color-scheme:dark]" /><Input label="Lugar (Opcional)" name="location" value={formData.location || ''} onChange={handleInputChange} error={formErrors.location} /></>);
      case 3: return (<>{renderParticipantSelectionButton(selectedAttendeesInPerson, 'attendeesInPerson', 'Asistentes Presenciales (Opcional)')}{renderParticipantSelectionButton(selectedAttendeesOnline, 'attendeesOnline', 'Asistentes En Línea (Opcional)')}<Input label="Nº Participantes Externos (Opcional)" name="externalParticipantsCount" type="number" min="0" value={formData.externalParticipantsCount || 0} onChange={handleNumberInputChange} error={formErrors.externalParticipantsCount} /></>);
      case 4: return (<Textarea label="Descripción (Opcional)" name="description" value={formData.description || ''} onChange={handleInputChange} error={formErrors.description} />);
      default: return null;
    }
  };

  const renderEditFormContent = () => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <Input label="Asunto de la Reunión" name="subject" value={formData.subject} onChange={handleInputChange} required error={formErrors.subject}/>
        <Select label="Categoría de Reunión" name="meetingCategoryId" value={formData.meetingCategoryId} onChange={handleInputChange} options={[{value: '', label: 'Seleccione una categoría'}, ...meetingCategories.map(c => ({ value: c.id, label: c.name }))]} required error={formErrors.meetingCategoryId}/>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleInputChange} required error={formErrors.date} className="dark:[color-scheme:dark]" /><Input label="Hora de Inicio" name="startTime" type="time" value={formData.startTime || ''} onChange={handleInputChange} required error={formErrors.startTime} className="dark:[color-scheme:dark]" /></div>
        <div className="flex items-end gap-2"><Input label="Hora de Fin (Opcional)" name="endTime" type="time" value={formData.endTime || ''} onChange={handleInputChange} error={formErrors.endTime} className="dark:[color-scheme:dark] grow" /><Button type="button" variant="secondary" size="sm" onClick={() => { const now = new Date(); setFormData(prev => ({ ...prev, endTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}` })); if (formErrors.endTime) setFormErrors(prev => ({...prev, endTime: ''})); }} className="mb-1" aria-label="Fijar hora de fin actual">Fijar Actual</Button></div>
        <Input label="Lugar (Opcional)" name="location" value={formData.location || ''} onChange={handleInputChange} error={formErrors.location} />
        {renderParticipantSelectionButton(selectedAttendeesInPerson, 'attendeesInPerson', 'Asistentes Presenciales (Opcional)')}
        {renderParticipantSelectionButton(selectedAttendeesOnline, 'attendeesOnline', 'Asistentes En Línea (Opcional)')}
        <Input label="Nº Participantes Externos (Opcional)" name="externalParticipantsCount" type="number" min="0" value={formData.externalParticipantsCount || 0} onChange={handleNumberInputChange} error={formErrors.externalParticipantsCount} />
        <Textarea label="Descripción (Opcional)" name="description" value={formData.description || ''} onChange={handleInputChange} error={formErrors.description} />
    </div>
  );

  const renderViewMeetingContent = () => {
    if (!meetingForViewOrEdit) return <p>No hay detalles de reunión para mostrar.</p>;
    const meeting = meetingForViewOrEdit;
    const attendees = meetingAttendees.filter(ma => ma.meeting_id === meeting.id);
    const inPersonCount = attendees.filter(ma => ma.attendance_type === 'in_person').length;
    const onlineCount = attendees.filter(ma => ma.attendance_type === 'online').length;
    
    return (
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
        <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{meeting.subject}</h4>
        <p><strong>Categoría de Reunión:</strong> {getMeetingCategoryName(meeting.meetingCategoryId)}</p>
        <p><strong>Fecha:</strong> {new Date(meeting.date + 'T00:00:00Z').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Hora:</strong> {meeting.startTime || 'N/A'} {meeting.endTime ? `- ${meeting.endTime}` : '(En curso)'}</p>
        {meeting.location && <p><strong>Lugar:</strong> {meeting.location}</p>}
        {(inPersonCount > 0 || onlineCount > 0) && (
          <div className="pt-2 mt-2 border-t dark:border-gray-600">
            <h5 className="font-semibold">Asistentes Registrados:</h5>
            {inPersonCount > 0 && <p className="text-sm"><strong>Presencial:</strong> {inPersonCount} participante(s)</p>}
            {onlineCount > 0 && <p className="text-sm"><strong>En Línea:</strong> {onlineCount} participante(s)</p>}
          </div>
        )}
        {typeof meeting.externalParticipantsCount === 'number' && meeting.externalParticipantsCount > 0 && <p><strong>Participantes Externos:</strong> {meeting.externalParticipantsCount}</p>}
        {meeting.description && <p className="mt-2"><strong>Descripción:</strong> <span className="italic">{`"${meeting.description}"`}</span></p>}
      </div>
    );
  };

  const getModalTitle = () => {
    const displayTotalSteps = TOTAL_STEPS_CREATE; 
    if (modalMode === 'create') return `Añadir Nueva Reunión (Paso ${currentStep} de ${displayTotalSteps})`;
    if (modalMode === 'edit') return `Editar Reunión: ${meetingForViewOrEdit?.subject || 'Reunión'}`;
    if (modalMode === 'view') return `Detalles de la Reunión: ${meetingForViewOrEdit?.subject || 'Reunión'}`;
    return 'Reunión';
  };

  // Keyboard navigation effects
  useEffect(() => { if (isParticipantSelectorModalOpen) { setHighlightedParticipantIndex(-1); setTimeout(() => participantListRef.current?.focus(), 100); } }, [isParticipantSelectorModalOpen]);
  useEffect(() => { participantListRef.current?.children[highlightedParticipantIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [highlightedParticipantIndex]);
  useEffect(() => { setHighlightedParticipantIndex(-1); }, [availableParticipantsForSelector]);

  const handleParticipantKeyDown = (e: React.KeyboardEvent) => {
    const participants = availableParticipantsForSelector;
    if (!participants.length) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            setHighlightedParticipantIndex(p => (p + 1) % participants.length);
            break;
        case 'ArrowUp':
            e.preventDefault();
            setHighlightedParticipantIndex(p => (p - 1 + participants.length) % participants.length);
            break;
        case 'Enter':
        case ' ':
            e.preventDefault();
            if (highlightedParticipantIndex >= 0) {
                const participant = participants[highlightedParticipantIndex];
                if (!participant.isDisabled) {
                    handleToggleParticipantSelection(participant.id);
                }
            }
            break;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Reuniones</h1>
        <div className="flex space-x-2"><Button onClick={handleOpenCreateModal} variant="primary"><PlusIcon className="w-5 h-5 mr-2" /> Añadir Reunión</Button>{onNavigateBack && (<Button onClick={handleBackNavigation} variant="secondary">Volver al Menú</Button>)}</div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="md:w-64 flex-shrink-0">
          <div className="sticky top-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Categorías</h3>
            <Input containerClassName="mb-4" placeholder="Buscar por asunto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <nav>
              <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
                {sidebarCategories.map(cat => (
                  <li key={cat.id}>
                    <button
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex justify-between items-center ${
                        selectedCategoryId === cat.id
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="truncate pr-2">{cat.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${ selectedCategoryId === cat.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>
                          {cat.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-grow">
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              {searchTerm ? 'No se encontraron reuniones que coincidan.' : 'No hay reuniones en esta categoría.'}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredMeetings.map(meeting => (
                  <div key={meeting.id} className="bg-white dark:bg-gray-800 shadow-sm rounded-md p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => handleOpenViewModal(meeting)} role="button" tabIndex={0} aria-label={`Ver detalles de ${meeting.subject}`}>
                    <div className="flex justify-between items-start w-full gap-3">
                      <div className="flex-grow space-y-0.5">
                        <h3 className="text-md font-semibold text-primary-700 dark:text-primary-400 break-words">{meeting.subject}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300"><strong>Categoría:</strong> {getMeetingCategoryName(meeting.meetingCategoryId)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400"><strong>Fecha:</strong> {new Date(meeting.date + 'T00:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400"><strong>Hora:</strong> {meeting.startTime || 'N/A'}{meeting.endTime ? ` - ${meeting.endTime}` : ' (En curso)'}</p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col space-y-1.5 items-end">
                        {isMeetingInProgress(meeting) && (<Button onClick={(e) => { e.stopPropagation(); handleEndMeetingNow(meeting.id);}} variant="primary" size="sm" className="py-1 px-2 text-xs" aria-label={`Finalizar ${meeting.subject}`}>Finalizar</Button>)}
                        <Button onClick={(e)=>{e.stopPropagation(); setMeetingForViewOrEdit(meeting); setModalMode('edit'); setIsModalOpen(true);}} variant="ghost" className="py-1 px-2 text-xs w-full max-w-[100px] flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-700/30" aria-label={`Editar ${meeting.subject}`}><EditIcon className="w-3 h-3 mr-1"/>Editar</Button>
                        <Button onClick={(e)=>{e.stopPropagation(); handleDeleteInternal(meeting.id);}} variant="ghost" className="py-1 px-2 text-xs w-full max-w-[100px] flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-700/30" aria-label={`Eliminar ${meeting.subject}`}><TrashIcon className="w-3 h-3 mr-1"/>Eliminar</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-2/5">Asunto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha y Hora</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredMeetings.map(meeting => (
                      <tr key={meeting.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => handleOpenViewModal(meeting)} role="button" tabIndex={0} aria-label={`Ver detalles de ${meeting.subject}`}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100" title={meeting.subject}>
                          {meeting.subject}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300" title={getMeetingCategoryName(meeting.meetingCategoryId)}>
                            {getMeetingCategoryName(meeting.meetingCategoryId)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {new Date(meeting.date + 'T00:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          <span className="ml-2">{meeting.startTime || 'N/A'}{meeting.endTime ? ` - ${meeting.endTime}` : ' (En curso)'}</span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                              {isMeetingInProgress(meeting) && (<Button onClick={(e) => { e.stopPropagation(); handleEndMeetingNow(meeting.id);}} variant="primary" size="sm" className="!py-1 !px-2 text-xs" aria-label={`Finalizar ${meeting.subject}`}>Finalizar</Button>)}
                              <Button onClick={(e) => { e.stopPropagation(); setMeetingForViewOrEdit(meeting); setModalMode('edit'); setIsModalOpen(true); }} variant="ghost" size="sm" className="!p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-700/30" aria-label={`Editar ${meeting.subject}`}><EditIcon className="w-4 h-4" /></Button>
                              <Button onClick={(e) => { e.stopPropagation(); handleDeleteInternal(meeting.id); }} variant="ghost" size="sm" className="!p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-700/30" aria-label={`Eliminar ${meeting.subject}`}><TrashIcon className="w-4 h-4" /></Button>
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
        <div className="space-y-4">
          {modalMode === 'create' && renderCreateWizardStepContent()}
          {modalMode === 'edit' && renderEditFormContent()}
          {modalMode === 'view' && renderViewMeetingContent()}
        </div>
        <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-200 dark:border-gray-700">
          {modalMode === 'create' && (<><div>{currentStep > 1 && (<Button type="button" variant="secondary" onClick={handlePrevStep}>Anterior</Button>)}</div><div className="space-x-3"><Button type="button" variant="ghost" onClick={handleCloseModal}>Cancelar</Button><Button type="button" variant="primary" onClick={handleNextStepOrCreate}>{currentStep === TOTAL_STEPS_CREATE ? 'Añadir Reunión' : 'Siguiente'}</Button></div></>)}
          {modalMode === 'edit' && (<><div /><div className="space-x-3"><Button type="button" variant="ghost" onClick={handleCloseModal}>Cancelar</Button><Button type="button" variant="primary" onClick={handleUpdateSubmit}>Guardar Cambios</Button></div></>)}
          {modalMode === 'view' && meetingForViewOrEdit && (<><div className="flex items-center gap-2"><Button type="button" variant="danger" onClick={() => handleDeleteInternal(meetingForViewOrEdit.id)} className="mr-auto"><TrashIcon className="w-4 h-4 mr-1" /> Eliminar</Button><Button type="button" variant="ghost" onClick={() => handleSendInvitation(meetingForViewOrEdit)}><EmailIcon className="w-4 h-4 mr-1"/> Invitar por Correo</Button></div><div className="space-x-3"><Button type="button" variant="secondary" onClick={handleCloseModal}>Cerrar</Button><Button type="button" variant="primary" onClick={switchToEditModeFromView}><EditIcon className="w-4 h-4 mr-1" /> Editar</Button></div></>)}
        </div>
      </Modal>

      {isParticipantSelectorModalOpen && participantSelectionMode && (
        <Modal isOpen={isParticipantSelectorModalOpen} onClose={handleParticipantSelectionModalClose} title={`Seleccionar Asistentes ${participantSelectionMode === 'attendeesInPerson' ? 'Presenciales' : 'En Línea'}`} size="lg">
          <div className="space-y-4"><Input type="search" placeholder="Buscar participante por nombre..." value={participantSearchTerm} onChange={(e) => setParticipantSearchTerm(e.target.value)} autoFocus />
            {availableParticipantsForSelector.length > 0 && (<div className="flex items-center my-2"><input type="checkbox" id="select-all-participants-modal" className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700" ref={participantSelectAllModalCheckboxRef} onChange={handleSelectAllFilteredParticipants} /><label htmlFor="select-all-participants-modal" className="ml-2 text-sm text-gray-700 dark:text-gray-300">Seleccionar/Deseleccionar todos los visibles y habilitados</label></div>)}
            <div ref={participantListRef} onKeyDown={handleParticipantKeyDown} tabIndex={-1} className="max-h-60 overflow-y-auto border dark:border-gray-600 rounded-md p-2 space-y-1 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
              {availableParticipantsForSelector.length > 0 ? (availableParticipantsForSelector.map((p, index) => {
                const isHighlighted = index === highlightedParticipantIndex;
                return (
                  <div key={p.id} onClick={() => !p.isDisabled && handleToggleParticipantSelection(p.id)} onMouseEnter={() => setHighlightedParticipantIndex(index)} className={`flex items-center p-1.5 rounded cursor-pointer ${isHighlighted ? 'bg-primary-100 dark:bg-primary-800' : ''} ${p.isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                      <input type="checkbox" id={`participant-select-${p.id}`} checked={tempSelectedParticipantIds.includes(p.id)} readOnly disabled={p.isDisabled} className="h-4 w-4 text-primary-600 border-gray-300 rounded pointer-events-none" />
                      <label htmlFor={`participant-select-${p.id}`} className={`ml-2 text-sm w-full pointer-events-none ${p.isDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{p.name} {p.isDisabled ? <span className="text-xs italic">(seleccionado en otra modalidad)</span> : ''}</label>
                  </div>
                )
              })) : (<p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{formData.meetingCategoryId ? (participantSearchTerm ? 'No se encontraron participantes.' : 'No hay participantes en esta categoría.') : 'Seleccione una categoría para ver participantes.'}</p>)}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={handleParticipantSelectionModalClose}>Cancelar</Button><Button variant="primary" onClick={handleConfirmParticipantSelection}>Confirmar Selección</Button></div>
        </Modal>
      )}
    </div>
  );
};
export default ScheduleMeetingView;