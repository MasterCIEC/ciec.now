

import React, { useState, useEffect } from 'react';
import { MeetingCategory, Meeting, Participant, Event, ParticipantMeetingCategory, EventOrganizingMeetingCategory } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { generateId } from '../constants';

interface ManageMeetingCategoriesViewProps {
  meetingCategories: MeetingCategory[];
  meetings: Meeting[];
  participants: Participant[]; 
  events: Event[]; 
  participantMeetingCategories: ParticipantMeetingCategory[];
  eventOrganizingMeetingCategories: EventOrganizingMeetingCategory[];
  onAddMeetingCategory: (category: MeetingCategory) => void;
  onUpdateMeetingCategory: (category: MeetingCategory) => void;
  onDeleteMeetingCategory: (categoryId: string) => Promise<boolean>;
  onNavigateBack: () => void;
}

type ModalMode = 'add' | 'edit' | 'view';
const initialCategoryFormState: Omit<MeetingCategory, 'id'> = { name: '' };

const ManageMeetingCategoriesView: React.FC<ManageMeetingCategoriesViewProps> = ({
  meetingCategories, meetings, participants, events, 
  participantMeetingCategories, eventOrganizingMeetingCategories,
  onAddMeetingCategory, onUpdateMeetingCategory, onDeleteMeetingCategory, onNavigateBack
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [categoryToViewOrEdit, setCategoryToViewOrEdit] = useState<MeetingCategory | null>(null);
  const [formData, setFormData] = useState<Omit<MeetingCategory, 'id'>>(initialCategoryFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletionInfo, setDeletionInfo] = useState<{
    category: MeetingCategory;
    relatedItems: {
      meetings: string[];
      participants: string[];
      events: string[];
    };
  } | null>(null);

  useEffect(() => {
    if (categoryToViewOrEdit && (modalMode === 'edit' || modalMode === 'view')) {
      setFormData({ name: categoryToViewOrEdit.name });
    } else {
      setFormData(initialCategoryFormState);
    }
  }, [categoryToViewOrEdit, modalMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert("El nombre de la categoría no puede estar vacío."); return; }
    const dataToSave : MeetingCategory = {
      id: modalMode === 'edit' && categoryToViewOrEdit ? categoryToViewOrEdit.id : generateId(),
      name: formData.name.trim(),
    };
    if (modalMode === 'edit' && categoryToViewOrEdit) onUpdateMeetingCategory(dataToSave);
    else if (modalMode === 'add') onAddMeetingCategory(dataToSave);
    setIsModalOpen(false); setCategoryToViewOrEdit(null);
  };

  const openAddModal = () => { setCategoryToViewOrEdit(null); setFormData(initialCategoryFormState); setModalMode('add'); setIsModalOpen(true); };
  const openViewModal = (category: MeetingCategory) => { setCategoryToViewOrEdit(category); setModalMode('view'); setIsModalOpen(true); };
  const switchToEditModeFromView = () => { if (categoryToViewOrEdit) setModalMode('edit'); };

  const handleDeleteRequest = (category: MeetingCategory) => {
    const relatedMeetings = meetings.filter(m => m.meetingCategoryId === category.id);
    const relatedParticipantsLinks = participantMeetingCategories.filter(pc => pc.meeting_category_id === category.id);
    const relatedEventsLinks = eventOrganizingMeetingCategories.filter(eoc => eoc.meeting_category_id === category.id);

    const relatedParticipantNames = relatedParticipantsLinks.map(link => 
        participants.find(p => p.id === link.participant_id)?.name || `ID: ${link.participant_id}`
    );
    const relatedEventNames = relatedEventsLinks.map(link => 
        events.find(e => e.id === link.event_id)?.subject || `ID: ${link.event_id}`
    );
    
    setDeletionInfo({
        category,
        relatedItems: {
            meetings: relatedMeetings.map(m => m.subject),
            participants: relatedParticipantNames,
            events: relatedEventNames,
        }
    });
    // Close main modal if open
    if (isModalOpen) {
        setIsModalOpen(false);
    }
  };
  
  const handleConfirmDeletion = async (categoryId: string) => {
    const success = await onDeleteMeetingCategory(categoryId);
    if (success) {
      setDeletionInfo(null);
    }
  };


  const filteredCategories = meetingCategories
    .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const getMeetingsCountForCategory = (categoryId: string): number => meetings.filter(m => m.meetingCategoryId === categoryId).length;
  const getParticipantsCountForCategory = (categoryId: string): number => participantMeetingCategories.filter(pc => pc.meeting_category_id === categoryId).length;
  const getEventsCountForCategory = (categoryId: string): number => eventOrganizingMeetingCategories.filter(eoc => eoc.meeting_category_id === categoryId).length;

  const renderViewCategoryContent = () => {
    if (!categoryToViewOrEdit) return <p>No hay detalles de categoría para mostrar.</p>;
    const c = categoryToViewOrEdit;
    return (
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{c.name}</h4>
        <p><strong>ID:</strong> {c.id}</p>
        <p><strong>Reuniones Asociadas:</strong> {getMeetingsCountForCategory(c.id)}</p>
        <p><strong>Participantes Asociados:</strong> {getParticipantsCountForCategory(c.id)}</p>
        <p><strong>Eventos Organizados:</strong> {getEventsCountForCategory(c.id)}</p>
      </div>
    );
  };

  const renderFormContent = () => (<form onSubmit={handleSubmit} className="space-y-4" id="category-form"><Input label="Nombre de la Categoría de Reunión" name="name" value={formData.name} onChange={handleInputChange} required autoFocus={modalMode==='add'}/></form>);
  const getModalTitle = () => {
      if (modalMode === 'add') return 'Añadir Nueva Categoría de Reunión';
      if (modalMode === 'edit') return `Editar Categoría: ${categoryToViewOrEdit?.name || ''}`;
      if (modalMode === 'view') return `Detalles de: ${categoryToViewOrEdit?.name || ''}`;
      return 'Categoría de Reunión';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4"><h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Gestionar Categorías de Reuniones</h1><div className="flex space-x-2"><Button onClick={openAddModal} variant="primary"><PlusIcon className="w-5 h-5 mr-2" /> Añadir Categoría</Button><Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button></div></div>
      <Input placeholder="Buscar categorías por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mb-6"/>

      <div className="md:hidden space-y-4">
        {filteredCategories.length === 0 && (<div className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">No se encontraron categorías.</div>)}
        {filteredCategories.map(category => (
          <div key={category.id} className="bg-gray-50 dark:bg-gray-700 shadow-sm rounded-md p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => openViewModal(category)} role="button" tabIndex={0} aria-label={`Ver detalles de ${category.name}`}>
            <div className="flex justify-between items-start w-full gap-3">
              <div className="flex-grow space-y-0.5">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 break-words">{category.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-300">Reuniones: {getMeetingsCountForCategory(category.id)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-300">Participantes: {getParticipantsCountForCategory(category.id)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-300">Eventos: {getEventsCountForCategory(category.id)}</p>
              </div>
              <div className="flex-shrink-0 flex space-x-2">
                <Button onClick={(e)=>{e.stopPropagation();setCategoryToViewOrEdit(category);setModalMode('edit');setIsModalOpen(true);}} variant="accent" size="sm" aria-label={`Editar ${category.name}`}><EditIcon className="w-4 h-4 mr-1"/>Editar</Button>
                <Button onClick={(e)=>{e.stopPropagation();handleDeleteRequest(category);}} variant="danger" size="sm" aria-label={`Eliminar ${category.name}`}><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reuniones</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Participantes</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Eventos</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th></tr></thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCategories.map(category => (
              <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => openViewModal(category)} role="button" tabIndex={0} aria-label={`Ver detalles de ${category.name}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{category.name}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getMeetingsCountForCategory(category.id)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getParticipantsCountForCategory(category.id)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getEventsCountForCategory(category.id)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <Button onClick={(e)=>{e.stopPropagation();setCategoryToViewOrEdit(category);setModalMode('edit');setIsModalOpen(true);}} variant="accent" size="sm" aria-label={`Editar ${category.name}`}><EditIcon className="w-4 h-4 mr-1"/>Editar</Button>
                    <Button onClick={(e)=>{e.stopPropagation();handleDeleteRequest(category);}} variant="danger" size="sm" aria-label={`Eliminar ${category.name}`}><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCategories.length === 0 && (<tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron categorías de reunión.</td></tr>)}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        { modalMode === 'view' ? renderViewCategoryContent() : renderFormContent() }
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          {modalMode === 'view' && categoryToViewOrEdit ? (<><Button type="button" variant="danger" onClick={()=>handleDeleteRequest(categoryToViewOrEdit)} className="mr-auto"><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button><div className="space-x-3"><Button type="button" variant="secondary" onClick={()=>setIsModalOpen(false)}>Cerrar</Button><Button type="button" variant="accent" onClick={switchToEditModeFromView}><EditIcon className="w-4 h-4 mr-1"/>Editar</Button></div></>) : (<><div/><div className="space-x-3"><Button type="button" variant="secondary" onClick={()=>setIsModalOpen(false)}>Cancelar</Button><Button type="submit" form="category-form" variant="primary">{modalMode==='edit'?'Guardar Cambios':'Añadir Categoría'}</Button></div></>)}
        </div>
      </Modal>

      <Modal isOpen={!!deletionInfo} onClose={() => setDeletionInfo(null)} title="Confirmar Eliminación">
        {deletionInfo && (() => {
            const { category, relatedItems } = deletionInfo;
            const hasHardDependencies = relatedItems.meetings.length > 0;
            const hasSoftDependencies = relatedItems.participants.length > 0 || relatedItems.events.length > 0;

            return (
                <div className="text-sm">
                    {hasHardDependencies ? (
                        <>
                            <p className="mb-4">No se puede eliminar la categoría <strong>"{category.name}"</strong> porque está directamente asignada a las siguientes reuniones. Por favor, reasigne o elimine estas reuniones primero:</p>
                            <ul className="list-disc list-inside bg-red-50 dark:bg-red-900/30 p-3 rounded-md max-h-40 overflow-y-auto">
                                {relatedItems.meetings.map((name, i) => <li key={i}>{name}</li>)}
                            </ul>
                        </>
                    ) : (
                        <>
                            <p className="mb-4">¿Está seguro de que desea eliminar la categoría <strong>"{category.name}"</strong>?</p>
                            {hasSoftDependencies && (
                                <div className="mb-4">
                                  <p className="font-semibold">Esta acción desvinculará los siguientes elementos (no serán eliminados):</p>
                                  <div className="max-h-40 overflow-y-auto text-xs space-y-2 mt-2">
                                      {relatedItems.participants.length > 0 && <div><strong>Participantes:</strong> {relatedItems.participants.join(', ')}</div>}
                                      {relatedItems.events.length > 0 && <div><strong>Eventos:</strong> {relatedItems.events.join(', ')}</div>}
                                  </div>
                                </div>
                            )}
                            <p>Esta acción no se puede deshacer.</p>
                        </>
                    )}

                    <div className="flex justify-end mt-6 space-x-2">
                        <Button variant="secondary" onClick={() => setDeletionInfo(null)}>
                            {hasHardDependencies ? 'Entendido' : 'Cancelar'}
                        </Button>
                        {!hasHardDependencies && (
                            <Button variant="danger" onClick={() => handleConfirmDeletion(category.id)}>
                                Sí, Eliminar
                            </Button>
                        )}
                    </div>
                </div>
            );
        })()}
      </Modal>
    </div>
  );
};

export default ManageMeetingCategoriesView;