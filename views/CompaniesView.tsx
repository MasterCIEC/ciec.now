// views/CompaniesView.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Company, Participant } from '../types';
import Modal from '../components/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
// Importación individual y directa de cada icono
import EyeIcon from '../components/icons/EyeIcon';
import SearchIcon from '../components/icons/SearchIcon';
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
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

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

  const companiesGroupedByLetter = useMemo(() => {
    const grouped: Record<string, Company[]> = {};
    filteredCompanies.forEach(company => {
        const firstLetter = company.nombre_establecimiento.charAt(0).toUpperCase();
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
    if (letterOrder.length > 0 && (!selectedLetter || !letterOrder.includes(selectedLetter))) {
        setSelectedLetter(letterOrder[0]);
    } else if (letterOrder.length === 0) {
        setSelectedLetter(null);
    }
  }, [letterOrder, selectedLetter]);

  const getParticipantsCountForCompany = (establecimientoId: string): number => {
    return participants.filter(p => p.id_establecimiento === establecimientoId).length;
  };

  const renderViewCompanyContent = () => {
    if (!companyToView) return <p>No hay detalles de empresa para mostrar.</p>;
    const c = companyToView;
    return (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
            <h4 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{c.nombre_establecimiento}</h4>
            <p><strong>RIF:</strong> {c.rif_compania}</p>
            {c.email_principal && <p><strong>Correo Electrónico:</strong> {c.email_principal}</p>}
            {c.telefono_principal_1 && <p><strong>Teléfono:</strong> {c.telefono_principal_1}</p>}
            <p><strong>Participantes Asociados:</strong> {getParticipantsCountForCompany(c.id_establecimiento)}</p>
        </div>
    );
  };

  const companiesForSelectedLetter = selectedLetter ? companiesGroupedByLetter[selectedLetter] : [];

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
            <div className="sticky top-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Índice Alfabético</h3>
                <nav>
                    <ul className="space-y-1 max-h-[70vh] overflow-y-auto">
                        {letterOrder.length > 0 ? (
                          letterOrder.map(letter => (
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
                                  {companiesGroupedByLetter[letter].length}
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
                    <div className="md:hidden flex flex-wrap gap-2 mb-4 border-b pb-4 dark:border-gray-700">
                        {letterOrder.length > 0 ? (
                        letterOrder.map(letter => (
                            <button
                            key={letter}
                            onClick={() => setSelectedLetter(letter)}
                            className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${
                                selectedLetter === letter
                                ? 'bg-primary-600 text-white shadow'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-primary-100 dark:hover:bg-primary-800'
                            }`}
                            >
                            {letter}
                            </button>
                        ))
                        ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No hay empresas afiliadas para mostrar.</p>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre del Establecimiento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RIF</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participantes</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {companiesForSelectedLetter.length > 0 ? (
                            companiesForSelectedLetter.map((company) => (
                                <tr 
                                key={company.id_establecimiento} 
                                className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
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
                                    {searchTerm ? 'No hay empresas que coincidan con la búsqueda.' : 'Seleccione una letra para ver las empresas.'}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Detalles de: ${companyToView?.nombre_establecimiento || ''}`}>
        { renderViewCompanyContent() }
        <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cerrar</Button>
        </div>
      </Modal>
    </div>
  );
};

export default CompaniesView;