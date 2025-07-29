

import React, { useState, useEffect } from 'react';
import { EventCategory, Event, EventOrganizingCategory } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { generateId } from '../constants';

interface ManageEventCategoriesViewProps {
  eventCategories: EventCategory[];
  events: Event[]; // For context if needed, but counting via eventOrganizingCategories
  eventOrganizingCategories: EventOrganizingCategory[];
  onAddEventCategory: (category: EventCategory) => void;
  onUpdateEventCategory: (category: EventCategory) => void;
  onDeleteEventCategory: (categoryId: string) => Promise<boolean>;
  onNavigateBack?: () => void;
}

type ModalMode = 'add' | 'edit' | 'view';
const initialCategoryFormState: Omit<EventCategory, 'id'> = { name: '' };

const ManageEventCategoriesView: React.FC<ManageEventCategoriesViewProps> = ({
  eventCategories, events, eventOrganizingCategories,
  onAddEventCategory, onUpdateEventCategory, onDeleteEventCategory, onNavigateBack
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [categoryToViewOrEdit, setCategoryToViewOrEdit] = useState<EventCategory | null>(null);
  const [formData, setFormData] = useState<Omit<EventCategory, 'id'>>(initialCategoryFormState);
  const [searchTerm, setSearchTerm] = useState('');

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
    if (modalMode === 'edit' && categoryToViewOrEdit) onUpdateEventCategory({ ...categoryToViewOrEdit, ...formData });
    else if (modalMode === 'add') onAddEventCategory({ id: generateId(), ...formData });
    setIsModalOpen(false); setCategoryToViewOrEdit(null);
  };

  const openAddModal = () => { setCategoryToViewOrEdit(null); setFormData(initialCategoryFormState); setModalMode('add'); setIsModalOpen(true); };
  const openViewModal = (category: EventCategory) => { setCategoryToViewOrEdit(category); setModalMode('view'); setIsModalOpen(true); };
  const switchToEditModeFromView = () => { if (categoryToViewOrEdit) setModalMode('edit'); };

  const handleDeleteConfirmed = async (category: EventCategory) => {
    if (window.confirm(`¿Está seguro de que desea eliminar la categoría: "${category.name}"? Esta acción no se puede deshacer si la categoría no está en uso.`)) {
      const success = await onDeleteEventCategory(category.id);
      // Alert logic for failure is now primarily handled in App.tsx
      if (success && categoryToViewOrEdit && categoryToViewOrEdit.id === category.id) {
        setIsModalOpen(false); setCategoryToViewOrEdit(null);
      }
    }
  };

  const filteredCategories = eventCategories
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const getEventsCountForCategory = (categoryId: string): number => eventOrganizingCategories.filter(eoc => eoc.category_id === categoryId).length;

  const renderViewCategoryContent = () => {
    if (!categoryToViewOrEdit) return <p>No hay detalles de categoría para mostrar.</p>;
    const category = categoryToViewOrEdit;
    return (
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{category.name}</h4>
        <p><strong>ID:</strong> {category.id}</p>
        <p><strong>Eventos Asociados:</strong> {getEventsCountForCategory(category.id)}</p>
      </div>
    );
  };

  const renderFormContent = () => (<form onSubmit={handleSubmit} className="space-y-4" id="eventcategory-form"><Input label="Nombre de la Categoría" name="name" value={formData.name} onChange={handleInputChange} required autoFocus={modalMode==='add'}/></form>);
  const getModalTitle = () => {
      if (modalMode === 'add') return 'Añadir Nueva Categoría de Evento';
      if (modalMode === 'edit') return `Editar Categoría: ${categoryToViewOrEdit?.name || ''}`;
      if (modalMode === 'view') return `Detalles de: ${categoryToViewOrEdit?.name || ''}`;
      return 'Categoría de Evento';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header, Search: No change */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4"><h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Gestionar Categorías de Eventos</h1><div className="flex space-x-2"><Button onClick={openAddModal} variant="primary"><PlusIcon className="w-5 h-5 mr-2" /> Añadir Categoría</Button>{onNavigateBack && <Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>}</div></div>
      <Input placeholder="Buscar categorías por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mb-6"/>

      {/* Mobile View: Cards */}
      <div className="md:hidden space-y-4">
        {filteredCategories.length === 0 && (<div className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">No se encontraron categorías.</div>)}
        {filteredCategories.map(category => (
          <div key={category.id} className="bg-gray-50 dark:bg-gray-700 shadow-sm rounded-md p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => openViewModal(category)} role="button" tabIndex={0} aria-label={`Ver detalles de ${category.name}`}>
            <div className="flex justify-between items-start w-full gap-3">
              <div className="flex-grow space-y-0.5"><h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 break-words">{category.name}</h3><p className="text-xs text-gray-500 dark:text-gray-300">Eventos: {getEventsCountForCategory(category.id)}</p><p className="text-xxs text-gray-400 dark:text-gray-500">ID: {category.id}</p></div>
              <div className="flex-shrink-0 flex flex-col space-y-1.5 items-end"><Button onClick={(e)=>{e.stopPropagation();setCategoryToViewOrEdit(category);setModalMode('edit');setIsModalOpen(true);}} variant="ghost" className="py-1 px-2 text-xs w-full max-w-[100px] flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-700/30" aria-label={`Editar ${category.name}`}><EditIcon className="w-3 h-3 mr-1"/>Editar</Button><Button onClick={(e)=>{e.stopPropagation();handleDeleteConfirmed(category);}} variant="ghost" className="py-1 px-2 text-xs w-full max-w-[100px] flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-700/30" aria-label={`Eliminar ${category.name}`}><TrashIcon className="w-3 h-3 mr-1"/>Eliminar</Button></div>
            </div>
          </div>
        ))}
      </div>
      {/* Desktop View: Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Eventos Asociados</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th></tr></thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCategories.map(category => (<tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={()=>openViewModal(category)} role="button" tabIndex={0} aria-label={`Ver detalles de ${category.name}`}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{category.name}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{category.id}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getEventsCountForCategory(category.id)}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2"><Button onClick={(e)=>{e.stopPropagation();setCategoryToViewOrEdit(category);setModalMode('edit');setIsModalOpen(true);}} variant="ghost" size="sm" className="py-1 px-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-700/30" aria-label={`Editar ${category.name}`}><EditIcon className="w-4 h-4 mr-1"/>Editar</Button><Button onClick={(e)=>{e.stopPropagation();handleDeleteConfirmed(category);}} variant="ghost" size="sm" className="py-1 px-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-700/30" aria-label={`Eliminar ${category.name}`}><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button></td></tr>))}
            {filteredCategories.length === 0 && (<tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron categorías.</td></tr>)}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        { modalMode === 'view' ? renderViewCategoryContent() : renderFormContent() }
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          {modalMode === 'view' && categoryToViewOrEdit ? (<><Button type="button" variant="danger" onClick={()=>handleDeleteConfirmed(categoryToViewOrEdit)} className="mr-auto"><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button><div className="space-x-3"><Button type="button" variant="secondary" onClick={()=>setIsModalOpen(false)}>Cerrar</Button><Button type="button" variant="primary" onClick={switchToEditModeFromView}><EditIcon className="w-4 h-4 mr-1"/>Editar</Button></div></>) : (<><div/><div className="space-x-3"><Button type="button" variant="secondary" onClick={()=>setIsModalOpen(false)}>Cancelar</Button><Button type="submit" form="eventcategory-form" variant="primary">{modalMode==='edit'?'Guardar Cambios':'Añadir Categoría'}</Button></div></>)}
        </div>
      </Modal>
    </div>
  );
};

export default ManageEventCategoriesView;
