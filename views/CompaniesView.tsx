// views/CompaniesView.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Company, Participant } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
// Importación individual y directa de cada icono
import EyeIcon from '../components/icons/EyeIcon';
import SearchIcon from '../components/icons/SearchIcon';
import CopyIcon from '../components/icons/CopyIcon';
import CheckIcon from '../components/icons/CheckIcon';
// Importación corregida de los componentes de Card
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';

interface CompaniesViewProps {
  companies: Company[];
  participants: Participant[];
  onNavigateBack?: () => void;
}

const CompaniesView: React.FC<CompaniesViewProps> = ({
  companies,
  participants,
  onNavigateBack,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companyToView, setCompanyToView] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const handleCopyToClipboard = (text: string | null, identifier: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        setCopiedItem(identifier);
        setTimeout(() => setCopiedItem(null), 2000);
    }, (err) => {
        console.error('Error al copiar texto: ', err);
        alert('No se pudo copiar el texto.');
    });
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCopiedItem(null);
  };

  const openViewModal = (company: Company) => {
    setCompanyToView(company);
    setIsModalOpen(true);
  };

  const filteredCompanies = useMemo(() => companies
    .filter(c =>
      (c.nombre_establecimiento || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.rif_compania || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a,b) => (a.nombre_establecimiento || '').localeCompare(b.nombre_establecimiento || '')), [companies, searchTerm]);

  const companiesGroupedByMunicipality = useMemo(() => {
    const grouped: Record<string, Company[]> = {};
    filteredCompanies.forEach(company => {
        const key = company.nombre_municipio || 'Sin Municipio';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(company);
    });
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        if (a === 'Sin Municipio') return 1;
        if (b === 'Sin Municipio') return -1;
        return a.localeCompare(b);
    });
    const result: Record<string, Company[]> = {};
    sortedKeys.forEach(key => result[key] = grouped[key]);
    return result;
  }, [filteredCompanies]);

  const municipalityOrder = useMemo(() => Object.keys(companiesGroupedByMunicipality), [companiesGroupedByMunicipality]);
  
  useEffect(() => {
    if (municipalityOrder.length > 0 && (!selectedMunicipality || !municipalityOrder.includes(selectedMunicipality))) {
        setSelectedMunicipality(municipalityOrder[0]);
    } else if (municipalityOrder.length === 0) {
        setSelectedMunicipality(null);
    }
  }, [municipalityOrder, selectedMunicipality]);

  const getParticipantsCountForCompany = (establecimientoId: string): number => {
    return participants.filter(p => p.id_establecimiento === establecimientoId).length;
  };

  const CopyableField = ({ label, value, identifier }: { label: string, value: string | null, identifier: string }) => {
    if (!value) return null;

    return (
        <div className="relative group border-b pb-2 pt-1 dark:border-gray-600">
            <p><strong>{label}:</strong> {value}</p>
            <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleCopyToClipboard(value, identifier); }}
                aria-label={`Copiar ${label}`}
            >
                {copiedItem === identifier ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
            </Button>
        </div>
    );
  };
  
  const renderViewCompanyContent = () => {
    if (!companyToView) return null;
    const c = companyToView;

    return (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
            <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-4">{c.nombre_establecimiento}</h4>
            <CopyableField label="RIF" value={c.rif_compania} identifier="rif" />
            <CopyableField label="Correo Electrónico" value={c.email_principal} identifier="email" />
            <CopyableField label="Teléfono" value={c.telefono_principal_1} identifier="phone" />
            
            <div className="pt-2 border-b pb-2 dark:border-gray-600">
                {c.nombre_municipio && <p><strong>Municipio:</strong> {c.nombre_municipio}</p>}
            </div>
             <div className="pt-2">
              <p><strong>Participantes Asociados:</strong> {getParticipantsCountForCompany(c.id_establecimiento)}</p>
            </div>
        </div>
    );
  };

  const handleCopyAll = () => {
      if (!companyToView) return;
      const { nombre_establecimiento, rif_compania, email_principal, telefono_principal_1, nombre_municipio } = companyToView;
      const textToCopy = [
          `Nombre: ${nombre_establecimiento}`,
          `RIF: ${rif_compania}`,
          email_principal ? `Correo: ${email_principal}` : null,
          telefono_principal_1 ? `Teléfono: ${telefono_principal_1}` : null,
          nombre_municipio ? `Municipio: ${nombre_municipio}` : null,
      ].filter(Boolean).join('\n');
      
      handleCopyToClipboard(textToCopy, 'all');
  };

  const companiesForSelectedMunicipality = selectedMunicipality ? companiesGroupedByMunicipality[selectedMunicipality] : [];

  return (
    <div className="p-4 sm:p-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Empresas Afiliadas</h1>
        <div className="flex space-x-2">
            {onNavigateBack && (
                <Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>
            )}
        </div>
      </div>
      
      <div className="flex flex-grow gap-6">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 hidden md:block">
            <div className="sticky top-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Índice por Municipio</h3>
                <nav>
                    <ul className="space-y-1 max-h-[70vh] overflow-y-auto">
                        {municipalityOrder.length > 0 ? (
                          municipalityOrder.map(municipality => (
                            <li key={municipality}>
                              <button
                                onClick={() => setSelectedMunicipality(municipality)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex justify-between items-center ${
                                  selectedMunicipality === municipality
                                    ? 'bg-primary-600 text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                <span className="truncate">{municipality}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${ selectedMunicipality === municipality ? 'bg-white/20' : 'bg-gray-200 dark:bg-slate-600'}`}>
                                  {companiesGroupedByMunicipality[municipality].length}
                                </span>
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="px-3 py-2 text-sm text-gray-500">
                            No hay empresas para mostrar.
                          </li>
                        )}
                    </ul>
                </nav>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-grow">
            <Card>
                <CardHeader>
                  <CardTitle>Directorio de Empresas Afiliadas</CardTitle>
                  <CardDescription>
                    Consulta la información de contacto de las empresas afiliadas.
                  </CardDescription>
                  <div className="mt-4">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <SearchIcon className="h-5 w-5 text-gray-400" />
                      </span>
                      <Input
                        type="text"
                        placeholder="Buscar por nombre o RIF..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                    <div className="md:hidden flex flex-wrap gap-2 mb-4 border-b pb-4 dark:border-slate-700">
                        {municipalityOrder.length > 0 ? (
                        municipalityOrder.map(municipality => (
                            <button
                            key={municipality}
                            onClick={() => setSelectedMunicipality(municipality)}
                            className={`px-3 py-1 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${
                                selectedMunicipality === municipality
                                ? 'bg-primary-600 text-white shadow'
                                : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-primary-100 dark:hover:bg-primary-800'
                            }`}
                            >
                            {municipality}
                            </button>
                        ))
                        ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No hay empresas afiliadas para mostrar.</p>
                        )}
                    </div>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {companiesForSelectedMunicipality.length > 0 ? (
                        companiesForSelectedMunicipality.map((company) => (
                          <div 
                            key={company.id_establecimiento} 
                            className="bg-slate-50 dark:bg-slate-700/50 shadow-sm rounded-md p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
                            onClick={() => openViewModal(company)}
                          >
                            <div className="flex justify-between items-start w-full gap-3">
                              <div className="flex-grow space-y-0.5">
                                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 break-words">{company.nombre_establecimiento}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">RIF: {company.rif_compania}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-300">Participantes: {getParticipantsCountForCompany(company.id_establecimiento)}</p>
                              </div>
                              <div className="flex-shrink-0">
                                <Button
                                  onClick={(e) => { e.stopPropagation(); openViewModal(company); }}
                                  variant="ghost"
                                  size="sm"
                                  className="p-1.5"
                                  aria-label={`Ver detalles de ${company.nombre_establecimiento}`}
                                >
                                  <EyeIcon className="w-5 h-5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                          {searchTerm ? 'No hay empresas que coincidan con la búsqueda.' : 'Seleccione un municipio para ver las empresas.'}
                        </div>
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre del Establecimiento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RIF</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participantes</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                            {companiesForSelectedMunicipality.length > 0 ? (
                            companiesForSelectedMunicipality.map((company) => (
                                <tr 
                                key={company.id_establecimiento} 
                                className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                                onClick={() => openViewModal(company)}
                                >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {company.nombre_establecimiento}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {company.rif_compania}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getParticipantsCountForCompany(company.id_establecimiento)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <Button
                                    onClick={(e) => { e.stopPropagation(); openViewModal(company); }}
                                    variant="ghost"
                                    size="sm"
                                    className="py-1 px-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-700/30"
                                    aria-label={`Ver detalles de ${company.nombre_establecimiento}`}
                                    >
                                    <EyeIcon className="w-4 h-4 mr-1" />
                                    Ver
                                    </Button>
                                </td>
                                </tr>
                            ))
                            ) : (
                            <tr>
                                <td colSpan={4} className="text-center py-10 text-gray-500 dark:text-gray-400">
                                    {searchTerm ? 'No hay empresas que coincidan con la búsqueda.' : 'Seleccione un municipio para ver las empresas.'}
                                </td>
                            </tr>
                            )}
                        </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </main>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={`Detalles de: ${companyToView?.nombre_establecimiento || ''}`}>
        { renderViewCompanyContent() }
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCopyAll}
              className="flex items-center text-sm"
              aria-label="Copiar toda la información de la empresa"
            >
              {copiedItem === 'all' ? <CheckIcon className="w-5 h-5 mr-2 text-green-500"/> : <CopyIcon className="w-5 h-5 mr-2" />}
              {copiedItem === 'all' ? 'Copiado' : 'Copiar Todo'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cerrar</Button>
        </div>
      </Modal>
    </div>
  );
};

export default CompaniesView;