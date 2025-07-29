
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Company, Participant } from '../types'; 
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { generateId } from '../constants';

interface CompaniesViewProps {
  companies: Company[];
  participants: Participant[]; 
  onAddCompany: (company: Omit<Company, 'id'>) => void;
  onUpdateCompany: (company: Company) => void;
  onDeleteCompany: (companyId: string) => void;
  onNavigateBack?: () => void;
}

type ModalMode = 'add' | 'edit' | 'view';
const initialCompanyFormState: Omit<Company, 'id'> = {
  name: '',
  rif: '',
  email: '',
  phone: '',
  address: '',
};

const CompaniesView: React.FC<CompaniesViewProps> = ({
  companies,
  participants, 
  onAddCompany,
  onUpdateCompany,
  onDeleteCompany,
  onNavigateBack,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [companyToViewOrEdit, setCompanyToViewOrEdit] = useState<Company | null>(null);
  const [formData, setFormData] = useState<Omit<Company, 'id'>>(initialCompanyFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  useEffect(() => {
    if (companyToViewOrEdit && (modalMode === 'edit' || modalMode === 'view')) {
      setFormData({
        name: companyToViewOrEdit.name,
        rif: companyToViewOrEdit.rif,
        email: companyToViewOrEdit.email,
        phone: companyToViewOrEdit.phone,
        address: companyToViewOrEdit.address,
      });
    } else {
      setFormData(initialCompanyFormState);
    }
  }, [companyToViewOrEdit, modalMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
     if (!formData.name || !formData.rif || !formData.email) {
        alert("Por favor, complete todos los campos obligatorios: Nombre de la Empresa, RIF y Correo Electrónico.");
        return;
    }
    const dataToSave: Omit<Company, 'id'> & { id?: string } = { 
      id: modalMode === 'edit' && companyToViewOrEdit ? companyToViewOrEdit.id : generateId(),
      name: formData.name.trim(),
      rif: formData.rif.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || '', 
      address: formData.address.trim() || '', 
    };

    if (modalMode === 'edit' && companyToViewOrEdit) {
      onUpdateCompany(dataToSave as Company); 
    } else if (modalMode === 'add') {
      const { id, ...restData } = dataToSave; 
      onAddCompany(modalMode === 'add' ? restData : dataToSave);
    }
    setIsModalOpen(false);
    setCompanyToViewOrEdit(null);
  };

  const openAddModal = () => {
    setCompanyToViewOrEdit(null);
    setFormData(initialCompanyFormState);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const openViewModal = (company: Company) => {
    setCompanyToViewOrEdit(company);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const switchToEditModeFromView = () => {
    if (companyToViewOrEdit) {
        setModalMode('edit');
    }
  };

  const handleDelete = (company: Company) => {
     if (window.confirm(`¿Está seguro de que desea eliminar la empresa: "${company.name}"? Esto también podría afectar a los participantes asociados con esta empresa.`)) {
        onDeleteCompany(company.id);
        if (companyToViewOrEdit && companyToViewOrEdit.id === company.id) {
            setIsModalOpen(false);
            setCompanyToViewOrEdit(null);
        }
    }
  };

  const filteredCompanies = useMemo(() => companies
    .filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.rif || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a,b) => (a.name || '').localeCompare(b.name || '')), [companies, searchTerm]);

  const companiesGroupedByLetter = useMemo(() => {
    const grouped: Record<string, Company[]> = {};
    filteredCompanies.forEach(company => {
        const firstLetter = company.name.charAt(0).toUpperCase();
        const key = firstLetter.match(/[A-Z]/) ? firstLetter : '#';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(company);
    });
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
    });
    const result: Record<string, Company[]> = {};
    sortedKeys.forEach(key => result[key] = grouped[key]);
    return result;
  }, [filteredCompanies]);

  const letterOrder = useMemo(() => Object.keys(companiesGroupedByLetter), [companiesGroupedByLetter]);
  
  useEffect(() => {
    if (letterOrder.length > 0 && !selectedLetter) {
        setSelectedLetter(letterOrder[0]);
    } else if (letterOrder.length === 0) {
        setSelectedLetter(null);
    }
  }, [letterOrder, selectedLetter]);

  const getParticipantsCountForCompany = (companyId: string): number => {
    return participants.filter(p => p.companyId === companyId).length;
  };

  const renderViewCompanyContent = () => {
    if (!companyToViewOrEdit) return <p>No hay detalles de empresa para mostrar.</p>;
    const c = companyToViewOrEdit;
    return (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
            <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{c.name}</h4>
            <p><strong>RIF:</strong> {c.rif}</p>
            <p><strong>Correo Electrónico:</strong> {c.email}</p>
            {c.phone && <p><strong>Teléfono:</strong> {c.phone}</p>}
            {c.address && <p><strong>Dirección:</strong> {c.address}</p>}
            <p><strong>Participantes Asociados:</strong> {getParticipantsCountForCompany(c.id)}</p>
        </div>
    );
  };

  const renderFormContent = () => (
      <form onSubmit={handleSubmit} className="space-y-4" id="company-form">
          <Input label="Nombre de la Empresa" name="name" value={formData.name} onChange={handleInputChange} required autoFocus={modalMode === 'add'} />
          <Input label="RIF" name="rif" value={formData.rif} onChange={handleInputChange} required />
          <Input label="Correo Electrónico" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
          <Input label="Teléfono (Opcional)" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} />
          <Textarea label="Dirección (Opcional)" name="address" value={formData.address} onChange={handleInputChange} />
      </form>
  );

  const getModalTitle = () => {
    if (modalMode === 'add') return 'Añadir Nueva Empresa';
    if (modalMode === 'edit') return `Editar Empresa: ${companyToViewOrEdit?.name || ''}`;
    if (modalMode === 'view') return `Detalles de: ${companyToViewOrEdit?.name || ''}`;
    return 'Empresa';
  };

  const companiesForSelectedLetter = selectedLetter ? companiesGroupedByLetter[selectedLetter] : [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Empresas</h1>
        <div className="flex space-x-2">
            <Button onClick={openAddModal} variant="primary">
            <PlusIcon className="w-5 h-5 mr-2" /> Añadir Empresa
            </Button>
            {onNavigateBack && (
                <Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>
            )}
        </div>
      </div>

      <Input
        placeholder="Buscar empresas por nombre o RIF..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-6"
      />
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="md:w-56 flex-shrink-0">
          <div className="sticky top-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Índice Alfabético</h3>
            <nav>
              <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
                {letterOrder.map(letter => (
                  <li key={letter}>
                    <button
                      onClick={() => setSelectedLetter(letter)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex justify-between items-center ${
                        selectedLetter === letter
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>Letra {letter}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${ selectedLetter === letter ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'}`}>
                          {companiesGroupedByLetter[letter]?.length || 0}
                      </span>
                    </button>
                  </li>
                ))}
                {letterOrder.length === 0 && <li className='text-sm text-gray-500'>No hay empresas.</li>}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">RIF</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Correo Electrónico</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Participantes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {companiesForSelectedLetter.length > 0 ? (
                  companiesForSelectedLetter.map(company => (
                    <tr
                      key={company.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                      onClick={() => openViewModal(company)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver detalles de ${company.name}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{company.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{company.rif}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{company.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getParticipantsCountForCompany(company.id)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <Button onClick={(e) => { e.stopPropagation(); setCompanyToViewOrEdit(company); setModalMode('edit'); setIsModalOpen(true); }} variant="ghost" size="sm" className="py-1 px-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-700/30" aria-label={`Editar ${company.name}`}><EditIcon className="w-4 h-4 mr-1" />Editar</Button>
                      <Button onClick={(e) => { e.stopPropagation(); handleDelete(company); }} variant="ghost" size="sm" className="py-1 px-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-700/30" aria-label={`Eliminar ${company.name}`}><TrashIcon className="w-4 h-4 mr-1" />Eliminar</Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500 dark:text-gray-400">
                       {searchTerm ? 'No hay empresas que coincidan con la búsqueda para esta letra.' : 'Seleccione una letra para ver las empresas.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>


      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        { modalMode === 'view' ? renderViewCompanyContent() : renderFormContent() }
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
             {modalMode === 'view' && companyToViewOrEdit ? (
                <>
                    <Button type="button" variant="danger" onClick={() => handleDelete(companyToViewOrEdit)} className="mr-auto"><TrashIcon className="w-4 h-4 mr-1"/> Eliminar</Button>
                    <div className="space-x-3">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cerrar</Button>
                        <Button type="button" variant="primary" onClick={switchToEditModeFromView}><EditIcon className="w-4 h-4 mr-1"/> Editar</Button>
                    </div>
                </>
            ) : (
                 <>
                    <div></div> 
                    <div className="space-x-3">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" form="company-form" variant="primary" >{modalMode === 'edit' ? 'Guardar Cambios' : 'Añadir Empresa'}</Button>
                    </div>
                 </>
            )}
        </div>
      </Modal>
    </div>
  );
};

export default CompaniesView;
