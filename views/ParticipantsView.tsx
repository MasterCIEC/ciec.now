// This file was not provided in the prompt, so a new version has been created 
// to ensure the functionality is complete and correct based on the application's structure.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Participant, Company, MeetingCategory, Meeting, ParticipantAffiliationType, ParticipantMeetingCategory, MeetingAttendee } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { generateId } from '../constants';

interface ParticipantsViewProps {
  participants: Participant[];
  companies: Company[];
  meetingCategories: MeetingCategory[];
  meetings: Meeting[]; 
  participantMeetingCategories: ParticipantMeetingCategory[];
  meetingAttendees: MeetingAttendee[]; 
  onAddParticipant: (participantData: Omit<Participant, 'id'>, selectedCategoryIds: string[]) => void;
  onUpdateParticipant: (participantId: string, participantData: Omit<Participant, 'id'>, selectedCategoryIds: string[]) => void;
  onDeleteParticipant: (participantId: string) => void;
  onNavigateBack?: () => void;
}

const initialParticipantFormState: Omit<Participant, 'id'> = {
  name: '',
  affiliationType: 'company',
  companyId: '',
  externalCompanyName: '',
  role: '',
  email: null, 
  phone: null, 
};

type ModalMode = 'add' | 'edit' | 'view';

const ParticipantsView: React.FC<ParticipantsViewProps> = ({
  participants,
  companies,
  meetingCategories,
  meetings,
  participantMeetingCategories,
  meetingAttendees,
  onAddParticipant,
  onUpdateParticipant,
  onDeleteParticipant,
  onNavigateBack,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [participantToViewOrEdit, setParticipantToViewOrEdit] = useState<Participant | null>(null);
  const [formData, setFormData] = useState<Omit<Participant, 'id'>>(initialParticipantFormState);
  const [selectedCategoryIdsInModal, setSelectedCategoryIdsInModal] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [potentialDuplicates, setPotentialDuplicates] = useState<Participant[]>([]);
  const [isDuplicateConfirmModalOpen, setIsDuplicateConfirmModalOpen] = useState(false);
  const [dataForConfirmationSave, setDataForConfirmationSave] = useState<{participantData: Omit<Participant, 'id'>, categoryIds: string[]} | null>(null);

  const [nameSuggestions, setNameSuggestions] = useState<Participant[]>([]);
  const [emailSuggestions, setEmailSuggestions] = useState<Participant[]>([]);
  const [activeSuggestionInput, setActiveSuggestionInput] = useState<'name' | 'email' | null>(null);
  const suggestionTimeoutRef = useRef<number | null>(null);


  useEffect(() => {
    if (participantToViewOrEdit && (modalMode === 'edit' || modalMode === 'view')) {
      setFormData({
        name: participantToViewOrEdit.name,
        affiliationType: participantToViewOrEdit.affiliationType || 'company',
        companyId: participantToViewOrEdit.companyId || '',
        externalCompanyName: participantToViewOrEdit.externalCompanyName || '',
        role: participantToViewOrEdit.role,
        email: participantToViewOrEdit.email || null,
        phone: participantToViewOrEdit.phone || null,
      });
      if (modalMode === 'edit') {
        const currentCategories = participantMeetingCategories
          .filter(pc => pc.participant_id === participantToViewOrEdit.id)
          .map(pc => pc.meeting_category_id);
        setSelectedCategoryIdsInModal(currentCategories);
      } else {
         setSelectedCategoryIdsInModal([]); 
      }
    } else {
      setFormData(initialParticipantFormState);
      setSelectedCategoryIdsInModal([]);
    }
  }, [participantToViewOrEdit, modalMode, participantMeetingCategories]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);

    if (name === 'affiliationType') {
      const newAffiliationType = value as ParticipantAffiliationType;
      setFormData(prev => ({
        ...prev,
        affiliationType: newAffiliationType,
        companyId: newAffiliationType === 'company' ? prev.companyId : '',
        externalCompanyName: newAffiliationType === 'external' ? prev.externalCompanyName : '',
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (name === 'name') {
      if (value.trim().length > 1) {
        const filtered = participants.filter(p =>
          p.name.toLowerCase().includes(value.toLowerCase()) &&
          !(modalMode === 'edit' && participantToViewOrEdit && p.id === participantToViewOrEdit.id)
        );
        setNameSuggestions(filtered.slice(0, 5));
        if(filtered.length > 0) setActiveSuggestionInput('name'); else setActiveSuggestionInput(null);
      } else {
        setNameSuggestions([]);
        if(activeSuggestionInput === 'name') setActiveSuggestionInput(null);
      }
    } else if (name === 'email') {
      if (value.trim().length > 2 && value.includes('@')) {
        const filtered = participants.filter(p =>
          p.email && p.email.toLowerCase().includes(value.toLowerCase()) &&
          !(modalMode === 'edit' && participantToViewOrEdit && p.id === participantToViewOrEdit.id)
        );
        setEmailSuggestions(filtered.slice(0,5));
        if(filtered.length > 0) setActiveSuggestionInput('email'); else setActiveSuggestionInput(null);
      } else {
        setEmailSuggestions([]);
        if(activeSuggestionInput === 'email') setActiveSuggestionInput(null);
      }
    }
  };

  const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
    setSelectedCategoryIdsInModal(selectedOptions);
  };

  const handleInputFocus = (inputType: 'name' | 'email') => {
    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    const value = inputType === 'name' ? formData.name : (formData.email || '');
    if (value.trim().length > (inputType === 'name' ? 1 : 2)) {
      setActiveSuggestionInput(inputType);
      if (inputType === 'name' && formData.name.trim().length > 1) {
        const filtered = participants.filter(p =>
          p.name.toLowerCase().includes(formData.name.toLowerCase()) &&
          !(modalMode === 'edit' && participantToViewOrEdit && p.id === participantToViewOrEdit.id)
        );
        setNameSuggestions(filtered.slice(0,5));
        if(filtered.length === 0) setActiveSuggestionInput(null);
      } else if (inputType === 'email' && (formData.email || '').trim().length > 2 && (formData.email || '').includes('@')) {
        const filtered = participants.filter(p =>
          p.email && p.email.toLowerCase().includes((formData.email || '').toLowerCase()) &&
          !(modalMode === 'edit' && participantToViewOrEdit && p.id === participantToViewOrEdit.id)
        );
        setEmailSuggestions(filtered.slice(0,5));
        if(filtered.length === 0) setActiveSuggestionInput(null);
      }
    }
  };

  const handleInputBlur = () => {
    suggestionTimeoutRef.current = window.setTimeout(() => {
      setActiveSuggestionInput(null);
    }, 150);
  };

  const handleSuggestionClick = (suggestion: Participant) => {
    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    setFormData({
      name: suggestion.name,
      affiliationType: suggestion.affiliationType,
      companyId: suggestion.companyId || '',
      externalCompanyName: suggestion.externalCompanyName || '',
      role: suggestion.role,
      email: suggestion.email,
      phone: suggestion.phone || null,
    });
    const suggestedCategories = participantMeetingCategories
      .filter(pc => pc.participant_id === suggestion.id)
      .map(pc => pc.meeting_category_id);
    setSelectedCategoryIdsInModal(suggestedCategories);
    setParticipantToViewOrEdit(suggestion); 
    setModalMode('edit');
    setNameSuggestions([]);
    setEmailSuggestions([]);
    setActiveSuggestionInput(null);
  };

  const performSave = (participantDataToSave: Omit<Participant, 'id'>, categoryIds: string[]) => {
    const finalParticipantData: Omit<Participant, 'id'> = {
      ...participantDataToSave,
      email: participantDataToSave.email?.trim() ? participantDataToSave.email.trim() : null,
      phone: participantDataToSave.phone?.trim() ? participantDataToSave.phone.trim() : null,
      companyId: participantDataToSave.affiliationType === 'company' ? (participantDataToSave.companyId?.trim() || null) : null,
      externalCompanyName: participantDataToSave.affiliationType === 'external' ? (participantDataToSave.externalCompanyName?.trim() || null) : null,
    };

    if (modalMode === 'edit' && participantToViewOrEdit) {
      onUpdateParticipant(participantToViewOrEdit.id, finalParticipantData, categoryIds);
    } else if (modalMode === 'add') {
      onAddParticipant(finalParticipantData, categoryIds);
    }
    setIsModalOpen(false);
    setParticipantToViewOrEdit(null);
    setIsDuplicateConfirmModalOpen(false);
    setPotentialDuplicates([]);
    setDataForConfirmationSave(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role ) {
      alert("Por favor, complete todos los campos obligatorios: Nombre y Rol.");
      return;
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      alert("Por favor, ingrese un correo electrónico válido.");
      return;
    }
    if (formData.affiliationType === 'company' && !formData.companyId) {
      alert("Por favor, seleccione una empresa afiliada.");
      return;
    }
    if (formData.affiliationType === 'external' && !(formData.externalCompanyName || '').trim()) {
      alert("Por favor, ingrese el nombre de la empresa externa.");
      return;
    }

    const participantDataForSave: Omit<Participant, 'id'> = {
        name: formData.name.trim(),
        affiliationType: formData.affiliationType,
        companyId: formData.affiliationType === 'company' ? (formData.companyId?.trim() || null) : null,
        externalCompanyName: formData.affiliationType === 'external' ? (formData.externalCompanyName?.trim() || null) : null,
        role: formData.role.trim(),
        email: formData.email?.trim() ? formData.email.trim() : null, 
        phone: formData.phone?.trim() ? formData.phone.trim() : null, 
    };

    const duplicates: Participant[] = [];
    const currentNameLower = participantDataForSave.name.toLowerCase();
    const currentEmailLower = participantDataForSave.email?.toLowerCase();

    participants.forEach(p => {
      if (modalMode === 'edit' && participantToViewOrEdit && p.id === participantToViewOrEdit.id) return;
      if (p.name.trim().toLowerCase() === currentNameLower) duplicates.push(p);
      else if (currentEmailLower && p.email?.trim().toLowerCase() === currentEmailLower) duplicates.push(p);
    });

    if (duplicates.length > 0) {
      setPotentialDuplicates(duplicates);
      setDataForConfirmationSave({participantData: participantDataForSave, categoryIds: selectedCategoryIdsInModal});
      setIsDuplicateConfirmModalOpen(true);
      return;
    }
    performSave(participantDataForSave, selectedCategoryIdsInModal);
  };

  const handleForceSave = () => {
    if (dataForConfirmationSave) {
      performSave(dataForConfirmationSave.participantData, dataForConfirmationSave.categoryIds);
    }
  };

  const openAddModal = () => {
    setParticipantToViewOrEdit(null);
    setFormData(initialParticipantFormState);
    setSelectedCategoryIdsInModal([]);
    setModalMode('add');
    setIsModalOpen(true);
    setNameSuggestions([]);
    setEmailSuggestions([]);
  };

  const openViewModal = (participant: Participant) => {
    setParticipantToViewOrEdit(participant);
    setModalMode('view');
    setIsModalOpen(true);
    setNameSuggestions([]);
    setEmailSuggestions([]);
  };

  const switchToEditModeFromView = () => {
    if (participantToViewOrEdit) setModalMode('edit');
  };

  const handleDelete = (participant: Participant) => {
    if (window.confirm(`¿Está seguro de que desea eliminar al participante: "${participant.name}"? Esto también lo eliminará de cualquier reunión en la que esté listado y de sus categorías asignadas.`)) {
      onDeleteParticipant(participant.id);
      if (participantToViewOrEdit && participantToViewOrEdit.id === participant.id) {
        setIsModalOpen(false);
        setParticipantToViewOrEdit(null);
      }
    }
  };

  const getParticipantAffiliationDetails = (participant: Participant): string => {
    if (participant.affiliationType === 'external') return participant.externalCompanyName ? `Externa: ${participant.externalCompanyName}` : 'Empresa Externa';
    if (participant.affiliationType === 'independent') return 'Independiente';
    if (participant.affiliationType === 'company' && participant.companyId) return companies.find(c => c.id === participant.companyId)?.name || 'Empresa Afiliada Desconocida';
    return 'Afiliación No Especificada';
  };

  const getCategoryNamesForParticipant = (participantId: string) => {
    return participantMeetingCategories
      .filter(pc => pc.participant_id === participantId)
      .map(pc => meetingCategories.find(c => c.id === pc.meeting_category_id)?.name || 'Desconocida')
      .join(', ');
  };

  const filteredParticipantsGlobal = useMemo(() => participants
    .filter(p =>
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.phone && (p.phone || '').toLowerCase().includes(searchTerm.toLowerCase()))
      )
    .sort((a,b)=> (a.name || '').localeCompare(b.name || '')),
  [participants, searchTerm]);
  
  const sortedMeetingCategories = useMemo(() =>
    [...meetingCategories].sort((a,b) => (a.name || '').localeCompare(b.name || '')),
  [meetingCategories]);

  const sidebarCategories = useMemo(() => {
    const participantCounts: Record<string, number> = {};
    
    filteredParticipantsGlobal.forEach(p => {
        const categoriesForP = participantMeetingCategories.filter(pmc => pmc.participant_id === p.id).map(pmc => pmc.meeting_category_id);
        if (categoriesForP.length === 0) {
            participantCounts['uncategorized'] = (participantCounts['uncategorized'] || 0) + 1;
        } else {
            categoriesForP.forEach(catId => {
                participantCounts[catId] = (participantCounts[catId] || 0) + 1;
            });
        }
    });
    
    const categories = [
      ...sortedMeetingCategories.map(cat => ({...cat, count: participantCounts[cat.id] || 0})),
      { id: 'uncategorized', name: 'Sin Categoría Asignada', count: participantCounts['uncategorized'] || 0 },
    ];
    
    return categories.filter(cat => cat.count > 0);
  }, [sortedMeetingCategories, filteredParticipantsGlobal, participantMeetingCategories]);

  useEffect(() => {
    const availableCategoryIds = sidebarCategories.filter(c => c.count > 0).map(c => c.id);
    const isSelectedCategoryInList = availableCategoryIds.includes(selectedCategoryId);
    
    if (!isSelectedCategoryInList && availableCategoryIds.length > 0) {
        setSelectedCategoryId(availableCategoryIds[0]);
    } else if (availableCategoryIds.length === 0) {
        setSelectedCategoryId('');
    }
  }, [sidebarCategories, selectedCategoryId]);


  const filteredParticipants = useMemo(() => {
    if (!selectedCategoryId) return [];

    if (selectedCategoryId === 'uncategorized') {
      return filteredParticipantsGlobal.filter(p => !participantMeetingCategories.some(pmc => pmc.participant_id === p.id));
    }
    const participantIdsInCategory = participantMeetingCategories
      .filter(pmc => pmc.meeting_category_id === selectedCategoryId)
      .map(pmc => pmc.participant_id);
    
    return filteredParticipantsGlobal.filter(p => participantIdsInCategory.includes(p.id));
  }, [selectedCategoryId, filteredParticipantsGlobal, participantMeetingCategories]);

  const getMeetingDurationMinutes = (meeting: Meeting): number => {
    if (!meeting.startTime || !meeting.endTime) return 0;
    try {
      const startDate = new Date(`${meeting.date}T${meeting.startTime}`);
      const endDate = new Date(`${meeting.date}T${meeting.endTime}`);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) return 0;
      return (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    } catch (e) { return 0; }
  };

  const getParticipantStats = (participantId: string) => {
    let presentialCount = 0;
    let onlineCount = 0;
    let accumulatedMinutes = 0;

    meetingAttendees.forEach(ma => {
      if (ma.participant_id === participantId) {
        const meeting = meetings.find(m => m.id === ma.meeting_id);
        if (meeting) {
          if (ma.attendance_type === 'in_person') presentialCount++;
          else if (ma.attendance_type === 'online') onlineCount++;
          accumulatedMinutes += getMeetingDurationMinutes(meeting);
        }
      }
    });
    return { presentialCount, onlineCount, totalAttendances: presentialCount + onlineCount, accumulatedHours: parseFloat((accumulatedMinutes / 60).toFixed(1)) };
  };

  const renderViewParticipantContent = () => {
    if (!participantToViewOrEdit) return <p>No hay detalles de participante para mostrar.</p>;
    const p = participantToViewOrEdit;
    const stats = getParticipantStats(p.id);
    const pCategories = getCategoryNamesForParticipant(p.id);

    return (
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{p.name}</h4>
        <p><strong>Afiliación:</strong> {getParticipantAffiliationDetails(p)}</p>
        <p><strong>Rol/Cargo:</strong> {p.role}</p>
        <p><strong>Correo Electrónico:</strong> {p.email || 'No Especificado'}</p>
        {p.phone && <p><strong>Teléfono:</strong> {p.phone}</p>}
        {pCategories && <p><strong>Categorías de Reuniones:</strong> {pCategories}</p>}
        <div className="pt-3 mt-3 border-t dark:border-gray-600">
          <h5 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Estadísticas de Participación:</h5>
          <p className="text-sm"><strong>Total Asistencias Presenciales:</strong> {stats.presentialCount}</p>
          <p className="text-sm"><strong>Total Asistencias En Línea:</strong> {stats.onlineCount}</p>
          <p className="text-sm"><strong>Total Asistencias (Suma):</strong> {stats.totalAttendances}</p>
          <p className="text-sm"><strong>Horas Acumuladas en Reuniones:</strong> {stats.accumulatedHours} hrs</p>
        </div>
      </div>
    );
  };

  const affiliationOptions = [
    { value: 'company', label: 'Empresa Afiliada' },
    { value: 'external', label: 'Empresa Externa' },
    { value: 'independent', label: 'Independiente' },
  ];

  const renderFormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-4" id="participant-form">
      <div className="relative">
        <Input label="Nombre Completo" name="name" value={formData.name} onChange={handleInputChange} onFocus={() => handleInputFocus('name')} onBlur={handleInputBlur} required autoComplete="off" autoFocus={modalMode === 'add'} />
        {activeSuggestionInput === 'name' && nameSuggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
            {nameSuggestions.map(s => (<li key={s.id} className="px-3 py-2 hover:bg-primary-100 dark:hover:bg-primary-700 cursor-pointer text-sm" onMouseDown={() => handleSuggestionClick(s)}>{s.name} <span className="text-xs text-gray-500 dark:text-gray-400">({s.email || 'Sin correo'})</span></li>))}
          </ul>
        )}
      </div>
      <Select label="Tipo de Afiliación" name="affiliationType" value={formData.affiliationType} onChange={handleInputChange} options={affiliationOptions} required />
      {formData.affiliationType === 'company' && (<Select label="Empresa Afiliada" name="companyId" value={formData.companyId || ''} onChange={handleInputChange} options={[{value: '', label: 'Seleccione una empresa'}, ...companies.map(c => ({ value: c.id, label: c.name }))]} required={formData.affiliationType === 'company'} />)}
      {formData.affiliationType === 'external' && (<Input label="Nombre Empresa Externa" name="externalCompanyName" value={formData.externalCompanyName || ''} onChange={handleInputChange} required={formData.affiliationType === 'external'} />)}
      <Input label="Rol/Cargo" name="role" value={formData.role || ''} onChange={handleInputChange} required />
      <div className="relative">
        <Input label="Correo Electrónico (Opcional, pero recomendado para evitar duplicados)" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} onFocus={() => handleInputFocus('email')} onBlur={handleInputBlur} autoComplete="off" />
        {activeSuggestionInput === 'email' && emailSuggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
            {emailSuggestions.map(s => (<li key={s.id} className="px-3 py-2 hover:bg-primary-100 dark:hover:bg-primary-700 cursor-pointer text-sm" onMouseDown={() => handleSuggestionClick(s)}>{s.email} <span className="text-xs text-gray-500 dark:text-gray-400">({s.name})</span></li>))}
          </ul>
        )}
      </div>
      <Input label="Teléfono (Opcional)" name="phone" type="tel" value={formData.phone || ''} onChange={handleInputChange} />
      <Select label="Categorías de Reuniones (Opcional)" name="categoryIdsModal" multiple value={selectedCategoryIdsInModal} onChange={handleMultiSelectChange} options={meetingCategories.map(c => ({ value: c.id, label: c.name }))} className="h-32" />
    </form>
  );

  const getModalTitle = () => {
    if (modalMode === 'add') return 'Añadir Nuevo Participante';
    if (modalMode === 'edit') return `Editar Participante: ${participantToViewOrEdit?.name || ''}`;
    if (modalMode === 'view') return `Detalles de: ${participantToViewOrEdit?.name || ''}`;
    return 'Participante';
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Participantes</h1>
        <div className="flex space-x-2"><Button onClick={openAddModal} variant="primary"><PlusIcon className="w-5 h-5 mr-2" /> Añadir Participante</Button>{onNavigateBack && (<Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>)}</div>
      </div>
      <Input placeholder="Buscar participantes por nombre, correo o teléfono..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mb-4" />
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="md:w-64 flex-shrink-0">
            <div className="sticky top-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Categorías</h3>
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
                                   <span className={`text-xs px-1.5 py-0.5 rounded-full ${ selectedCategoryId === cat.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>{cat.count}</span>
                               </button>
                           </li>
                        ))}
                         {sidebarCategories.length === 0 && <li className='text-sm text-gray-500'>No hay categorías.</li>}
                    </ul>
                </nav>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-grow">
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Afiliación</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredParticipants.length > 0 ? (
                    filteredParticipants.map(participant => (
                    <tr key={participant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => openViewModal(participant)} role="button" tabIndex={0} aria-label={`Ver detalles de ${participant.name}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{participant.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getParticipantAffiliationDetails(participant)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{participant.role}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <div>{participant.email || '-'}</div>
                        <div>{participant.phone || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button onClick={(e) => {e.stopPropagation(); setParticipantToViewOrEdit(participant); setModalMode('edit'); setIsModalOpen(true);}} size="sm" className="!px-2 !py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50" aria-label={`Editar ${participant.name}`}><EditIcon className="w-4 h-4" /></Button>
                        <Button onClick={(e) => {e.stopPropagation(); handleDelete(participant);}} size="sm" className="!px-2 !py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50" aria-label={`Eliminar ${participant.name}`}><TrashIcon className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500 dark:text-gray-400">
                      No se encontraron participantes para la categoría seleccionada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        { modalMode === 'view' ? renderViewParticipantContent() : renderFormContent() }
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          {modalMode === 'view' && participantToViewOrEdit ? (
            <><Button type="button" variant="danger" onClick={() => handleDelete(participantToViewOrEdit)} className="mr-auto"><TrashIcon className="w-4 h-4 mr-1"/> Eliminar</Button><div className="space-x-3"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cerrar</Button><Button type="button" variant="primary" onClick={switchToEditModeFromView}><EditIcon className="w-4 h-4 mr-1"/> Editar</Button></div></>
          ) : (
            <><div /><div className="space-x-3"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit" form="participant-form" variant="primary" >{modalMode === 'edit' ? 'Guardar Cambios' : 'Añadir Participante'}</Button></div></>
          )}
        </div>
      </Modal>

      {isDuplicateConfirmModalOpen && (
        <Modal isOpen={isDuplicateConfirmModalOpen} onClose={() => {setIsDuplicateConfirmModalOpen(false); setPotentialDuplicates([]); setDataForConfirmationSave(null);}} title="Confirmar Guardado - Posibles Duplicados">
          <p className="text-base text-gray-700 dark:text-gray-300">Se encontraron los siguientes participantes que podrían ser duplicados del que intenta guardar:</p>
          <div className="mt-4 max-h-60 overflow-y-auto space-y-3 p-2 bg-gray-100 dark:bg-gray-700 rounded">
            {potentialDuplicates.map(p => (<div key={p.id} className="text-sm p-2 border dark:border-gray-600 rounded"><p><strong>Nombre:</strong> {p.name}</p><p><strong>Correo:</strong> {p.email || 'N/A'}</p><p><strong>Rol:</strong> {p.role}</p><p><strong>Afiliación:</strong> {getParticipantAffiliationDetails(p)}</p></div>))}
          </div>
          <p className="mt-4 text-base text-gray-700 dark:text-gray-300">¿Está seguro de que desea guardar este participante de todas formas?</p>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => {setIsDuplicateConfirmModalOpen(false); setPotentialDuplicates([]); setDataForConfirmationSave(null);}}>Cancelar y Revisar</Button>
            <Button variant="primary" onClick={handleForceSave}>Guardar de Todas Formas</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default ParticipantsView;