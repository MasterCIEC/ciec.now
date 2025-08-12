import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Participant, MeetingCategory, Company, ParticipantMeetingCategory } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

interface ParticipantsViewProps {
  participants: Participant[];
  meetingCategories: MeetingCategory[];
  participantMeetingCategories: ParticipantMeetingCategory[];
  onAddParticipant: (participantData: Omit<Participant, 'id'>, selectedCategoryIds: string[]) => void;
  onUpdateParticipant: (participantId: string, participantData: Omit<Participant, 'id'>, selectedCategoryIds: string[]) => void;
  onDeleteParticipant: (participantId: string) => void;
  onNavigateBack?: () => void;
}

const initialParticipantFormState: Omit<Participant, 'id'> = {
  name: '',
  id_establecimiento: null,
  role: '',
  email: null,
  phone: null,
};

type ModalMode = 'add' | 'edit' | 'view';

const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
};

const ParticipantsView: React.FC<ParticipantsViewProps> = ({
  participants,
  meetingCategories,
  participantMeetingCategories,
  onAddParticipant,
  onUpdateParticipant,
  onDeleteParticipant,
  onNavigateBack,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [participantToViewOrEdit, setParticipantToViewOrEdit] = useState<Participant | null>(null);
  const [participantToDelete, setParticipantToDelete] = useState<Participant | null>(null);
  const [formData, setFormData] = useState<Omit<Participant, 'id'>>(initialParticipantFormState);
  const [selectedCategoryIdsInModal, setSelectedCategoryIdsInModal] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTermEst, setSearchTermEst] = useState('');
  const [establecimientoSugeridos, setEstablecimientoSugeridos] = useState<Company[]>([]);
  const [isLoadingSugerencias, setIsLoadingSugerencias] = useState(false);
  const [affiliationDetailsCache, setAffiliationDetailsCache] = useState(new Map<string, string>());
  const RIF_GREMIO = "J075109112";

  useEffect(() => {
    if (participantToViewOrEdit && (modalMode === 'edit' || modalMode === 'view')) {
      setFormData({
        name: participantToViewOrEdit.name,
        id_establecimiento: participantToViewOrEdit.id_establecimiento,
        role: participantToViewOrEdit.role,
        email: participantToViewOrEdit.email || null,
        phone: participantToViewOrEdit.phone || null,
      });

      if (participantToViewOrEdit.id_establecimiento) {
        const fetchEstName = async () => {
          if (!supabase) return;
          const { data } = await supabase.from('establecimientos_completos_remotos').select('nombre_establecimiento').eq('id_establecimiento', participantToViewOrEdit.id_establecimiento!).single();
          if (data) setSearchTermEst(data.nombre_establecimiento);
        };
        fetchEstName();
      } else {
        setSearchTermEst('');
      }

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
      setSearchTermEst('');
    }
  }, [participantToViewOrEdit, modalMode, participantMeetingCategories]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
    setSelectedCategoryIdsInModal(selectedOptions);
  };

  const handleSearchEstablecimiento = useCallback(async (term: string) => {
    setSearchTermEst(term);
    if (term.length < 3 || !supabase) {
      setEstablecimientoSugeridos([]);
      return;
    }
    setIsLoadingSugerencias(true);
    const { data, error } = await supabase
      .from('establecimientos_completos_remotos')
      .select('id_establecimiento, nombre_establecimiento, rif_compania, email_principal, telefono_principal_1, nombre_municipio')
      .ilike('nombre_establecimiento', `%${term}%`)
      .limit(5);

    if (error) {
      console.error("Error buscando establecimientos:", error);
      setEstablecimientoSugeridos([]);
    } else {
      setEstablecimientoSugeridos(data as Company[]);
    }
    setIsLoadingSugerencias(false);
  }, []);

  const handleSelectEstablecimiento = (est: Company) => {
    setFormData(prev => ({ ...prev, id_establecimiento: est.id_establecimiento }));
    setSearchTermEst(est.nombre_establecimiento);
    setEstablecimientoSugeridos([]);
  };

  const handleClearEstablecimiento = () => {
    setFormData(prev => ({ ...prev, id_establecimiento: null }));
    setSearchTermEst('');
    setEstablecimientoSugeridos([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role) {
      alert("Por favor, complete todos los campos obligatorios: Nombre y Rol.");
      return;
    }
    const participantDataToSave: Omit<Participant, 'id'> = {
      name: formData.name.trim(),
      id_establecimiento: formData.id_establecimiento || null,
      role: formData.role.trim(),
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
    };
    if (modalMode === 'edit' && participantToViewOrEdit) {
      onUpdateParticipant(participantToViewOrEdit.id, participantDataToSave, selectedCategoryIdsInModal);
    } else if (modalMode === 'add') {
      onAddParticipant(participantDataToSave, selectedCategoryIdsInModal);
    }
    setIsModalOpen(false);
  };

  const openAddModal = () => {
    setParticipantToViewOrEdit(null);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const openViewModal = (participant: Participant) => {
    setParticipantToViewOrEdit(participant);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const switchToEditModeFromView = () => {
    if (participantToViewOrEdit) setModalMode('edit');
  };

  const getParticipantAffiliationDetails = useCallback(async (participant: Participant): Promise<string> => {
    if (!supabase) return 'Error de conexión';
    const cacheKey = participant.id_establecimiento || 'independent';
    if (affiliationDetailsCache.has(cacheKey)) {
      return affiliationDetailsCache.get(cacheKey)!;
    }
    if (!participant.id_establecimiento) return 'Independiente';

    const { data: estData } = await supabase
      .from('establecimientos_completos_remotos')
      .select('nombre_establecimiento')
      .eq('id_establecimiento', participant.id_establecimiento)
      .single();
    if (!estData) return 'Establecimiento Desconocido';

    const { data: affData } = await supabase
      .from('afiliaciones_remotos')
      .select('id_establecimiento')
      .eq('id_establecimiento', participant.id_establecimiento)
      .eq('rif_institucion', RIF_GREMIO)
      .single();

    const detailString = affData ? `Afiliado: ${estData.nombre_establecimiento}` : `Externo: ${estData.nombre_establecimiento}`;
    setAffiliationDetailsCache(prev => new Map(prev).set(cacheKey, detailString));
    return detailString;
  }, [affiliationDetailsCache, RIF_GREMIO]);

  const AffiliationDetail: React.FC<{ participant: Participant }> = ({ participant }) => {
    const cacheKey = participant.id_establecimiento || 'independent';
    const cachedValue = affiliationDetailsCache.get(cacheKey);
  
    const [details, setDetails] = useState<string>(cachedValue || 'Cargando...');
  
    useEffect(() => {
      if (!cachedValue) {
        getParticipantAffiliationDetails(participant).then(setDetails);
      } else if (details !== cachedValue) {
        setDetails(cachedValue);
      }
    }, [participant, getParticipantAffiliationDetails, cachedValue, details]);
  
    return <>{details}</>;
  };

  const getCommissionsForParticipant = useCallback((participantId: string): string => {
    return participantMeetingCategories
      .filter(pc => pc.participant_id === participantId)
      .map(pc => meetingCategories.find(mc => mc.id === pc.meeting_category_id)?.name)
      .filter((name): name is string => !!name)
      .join(', ');
  }, [participantMeetingCategories, meetingCategories]);

  const filteredParticipants = useMemo(() => {
    const normalizedSearch = normalizeString(searchTerm);
    return participants
      .filter(p => 
        normalizedSearch === '' ||
        normalizeString(p.name || '').includes(normalizedSearch) ||
        normalizeString(p.email || '').includes(normalizedSearch)
      )
      .sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }, [participants, searchTerm]);

  const getModalTitle = () => {
    if (modalMode === 'add') return 'Añadir Nuevo Participante';
    if (modalMode === 'edit') return `Editar: ${participantToViewOrEdit?.name || ''}`;
    if (modalMode === 'view') return `Detalles de: ${participantToViewOrEdit?.name || ''}`;
    return 'Participante';
  };

  const renderFormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-4" id="participant-form">
      <Input label="Nombre Completo" name="name" value={formData.name} onChange={handleInputChange} required autoFocus={modalMode === 'add'} />
      <Input label="Rol/Cargo" name="role" value={formData.role || ''} onChange={handleInputChange} required />
      <div className="relative">
        <Input label="Empresa (Opcional)" name="establecimiento" value={searchTermEst} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchEstablecimiento(e.target.value)} placeholder="Escriba para buscar..."/>
        {formData.id_establecimiento && (<button type="button" onClick={handleClearEstablecimiento} className="absolute right-2 top-9 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>)}
        {isLoadingSugerencias && <div className="p-2 text-sm text-gray-500">Buscando...</div>}
        {establecimientoSugeridos.length > 0 && (
          <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
            {establecimientoSugeridos.map(est => (<li key={est.id_establecimiento} className="px-3 py-2 hover:bg-primary-100 cursor-pointer" onMouseDown={() => handleSelectEstablecimiento(est)}>{est.nombre_establecimiento}</li>))}
          </ul>
        )}
      </div>
      <Input label="Correo (Opcional)" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} />
      <Input label="Teléfono (Opcional)" name="phone" type="tel" value={formData.phone || ''} onChange={handleInputChange} />
      <Select label="Comisiones (Opcional)" name="categoryIdsModal" multiple value={selectedCategoryIdsInModal} onChange={handleMultiSelectChange} options={meetingCategories.map(c => ({ value: c.id, label: c.name }))} className="h-32" />
    </form>
  );

  const renderViewParticipantContent = () => {
    if (!participantToViewOrEdit) return null;
    const commissions = getCommissionsForParticipant(participantToViewOrEdit.id);
    return (<div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{participantToViewOrEdit.name}</h4>
        <p><strong>Afiliación:</strong> <AffiliationDetail participant={participantToViewOrEdit} /></p>
        <p><strong>Rol/Cargo:</strong> {participantToViewOrEdit.role}</p>
        <p><strong>Correo:</strong> {participantToViewOrEdit.email || 'N/A'}</p>
        {participantToViewOrEdit.phone && <p><strong>Teléfono:</strong> {participantToViewOrEdit.phone}</p>}
        <p><strong>Comisiones Asignadas:</strong> {commissions || 'Ninguna'}</p>
    </div>);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Participantes</h1>
        <div className="flex space-x-2">
          <Button onClick={openAddModal} variant="primary"><PlusIcon className="w-5 h-5 mr-2" /> Añadir</Button>
          {onNavigateBack && (<Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>)}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Directorio de Participantes</CardTitle>
          <div className="mt-4">
            <Input placeholder="Buscar por nombre o correo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 p-4">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map(participant => (
                <div key={participant.id} className="bg-gray-50 dark:bg-slate-700 shadow-sm rounded-md p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600" onClick={() => openViewModal(participant)} role="button" tabIndex={0} aria-label={`Ver detalles de ${participant.name}`}>
                  <div className="flex justify-between items-start w-full gap-3">
                    <div className="flex-grow space-y-0.5">
                      <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 break-words">{participant.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{participant.role}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-300 truncate">
                        <strong>Comisiones:</strong> {getCommissionsForParticipant(participant.id) || 'Ninguna'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center space-x-2">
                      <Button onClick={(e) => { e.stopPropagation(); setParticipantToViewOrEdit(participant); setModalMode('edit'); setIsModalOpen(true); }} variant="accent" size="sm" className="p-1.5" aria-label={`Editar ${participant.name}`}><EditIcon className="w-4 h-4"/></Button>
                      <Button onClick={(e) => { e.stopPropagation(); setParticipantToDelete(participant) }} variant="danger" size="sm" className="p-1.5" aria-label={`Eliminar ${participant.name}`}><TrashIcon className="w-4 h-4"/></Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron participantes.</div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Afiliación</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisiones</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                {filteredParticipants.length > 0 ? (
                  filteredParticipants.map(participant => (
                    <tr key={participant.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => openViewModal(participant)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{participant.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{participant.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"><AffiliationDetail participant={participant} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{participant.role}</td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">{getCommissionsForParticipant(participant.id) || 'Ninguna'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <Button onClick={(e) => { e.stopPropagation(); setParticipantToViewOrEdit(participant); setModalMode('edit'); setIsModalOpen(true); }} variant="accent" size="sm" aria-label={`Editar ${participant.name}`}><EditIcon className="w-4 h-4 mr-1"/>Editar</Button>
                          <Button onClick={(e) => { e.stopPropagation(); setParticipantToDelete(participant) }} variant="danger" size="sm" aria-label={`Eliminar ${participant.name}`}><TrashIcon className="w-4 h-4 mr-1"/>Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500 dark:text-gray-400">
                      No se encontraron participantes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>


      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        { modalMode === 'view' ? renderViewParticipantContent() : renderFormContent() }
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          {modalMode === 'view' && participantToViewOrEdit ? (
            <><Button type="button" variant="danger" onClick={() => setParticipantToDelete(participantToViewOrEdit)} className="mr-auto"><TrashIcon className="w-4 h-4 mr-1"/> Eliminar</Button>
            <div className="space-x-3"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cerrar</Button><Button type="button" variant="accent" onClick={switchToEditModeFromView}><EditIcon className="w-4 h-4 mr-1"/> Editar</Button></div></>
          ) : (
            <><div /><div className="space-x-3"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit" form="participant-form" variant="primary">{modalMode === 'edit' ? 'Guardar Cambios' : 'Añadir'}</Button></div></>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!participantToDelete} onClose={() => setParticipantToDelete(null)} title="Confirmar Eliminación">
        {participantToDelete && (
          <div className="text-sm">
            <p className="mb-4">
              ¿Está seguro de que desea eliminar al participante: <strong>"{participantToDelete.name}"</strong>?
            </p>
            <p className="mb-4">
              Esta acción también eliminará todos sus registros de asistencia asociados.
            </p>
            <p>Esta acción no se puede deshacer.</p>
            <div className="flex justify-end mt-6 space-x-2">
              <Button variant="secondary" onClick={() => setParticipantToDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => {
                onDeleteParticipant(participantToDelete.id);
                setParticipantToDelete(null);
                if (isModalOpen && participantToViewOrEdit?.id === participantToDelete.id) {
                    setIsModalOpen(false);
                }
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

export default ParticipantsView;
