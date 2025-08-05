// views/StatsView.tsx

import React, { useState, useMemo } from 'react';
import { Meeting, Participant, MeetingCategory, MeetingAttendee, ParticipantMeetingCategory, Company } from '../types';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Modal from '../components/Modal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import ExportIcon from '../components/icons/ExportIcon';

interface StatsViewProps {
  meetings: Meeting[];
  participants: Participant[];
  companies: Company[];
  meetingCategories: MeetingCategory[];
  meetingAttendees: MeetingAttendee[];
  participantMeetingCategories: ParticipantMeetingCategory[];
  onNavigateBack?: () => void;
}

const reportFieldOptions = [
  { id: 'role', label: 'Rol' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Teléfono' },
  { id: 'company', label: 'Empresa' },
];

const StatsView: React.FC<StatsViewProps> = ({
  meetings,
  participants,
  companies,
  meetingCategories,
  meetingAttendees,
  participantMeetingCategories,
  onNavigateBack,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // State for the new participant report feature
  const [isParticipantReportModalOpen, setIsParticipantReportModalOpen] = useState(false);
  const [selectedCommissionIdsForReport, setSelectedCommissionIdsForReport] = useState<string[]>([]);
  const [commissionSearchTerm, setCommissionSearchTerm] = useState('');
  const [selectedFieldsForReport, setSelectedFieldsForReport] = useState<string[]>(['role', 'email', 'phone', 'company']);


  const categoryOptions = useMemo(() => [
    { value: '', label: 'Seleccione una comisión para ver detalles' },
    ...meetingCategories.map(c => ({ value: c.id, label: c.name }))
  ], [meetingCategories]);

  const statsForSelectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;

    const meetingsForCategory = meetings.filter(m => m.meetingCategoryId === selectedCategoryId);
    const participantLinks = participantMeetingCategories.filter(pc => pc.meeting_category_id === selectedCategoryId);
    const participantIds = participantLinks.map(p => p.participant_id);
    const participantsForCategory = participants.filter(p => participantIds.includes(p.id));

    let totalAttendanceSlots = 0;
    let totalAttendees = 0;

    const participantStats = participantsForCategory.map(participant => {
      const meetingsAttended = meetingAttendees.filter(attendee => 
        attendee.participant_id === participant.id &&
        meetingsForCategory.some(m => m.id === attendee.meeting_id)
      );

      const attendedInPerson = meetingsAttended.filter(a => a.attendance_type === 'in_person').length;
      const attendedOnline = meetingsAttended.filter(a => a.attendance_type === 'online').length;
      const totalAttended = attendedInPerson + attendedOnline;
      const totalMeetings = meetingsForCategory.length;
      const missed = totalMeetings - totalAttended;
      const attendanceRate = totalMeetings > 0 ? (totalAttended / totalMeetings) * 100 : 0;

      totalAttendanceSlots += totalMeetings;
      totalAttendees += totalAttended;
      
      return {
        participantId: participant.id,
        participantName: participant.name,
        attendedInPerson,
        attendedOnline,
        totalAttended,
        missed,
        totalMeetings,
        attendanceRate: attendanceRate.toFixed(1),
      };
    }).sort((a,b) => b.totalAttended - a.totalAttended);

    const overallAttendanceRate = totalAttendanceSlots > 0 ? (totalAttendees / totalAttendanceSlots) * 100 : 0;
    
    return {
      totalMeetings: meetingsForCategory.length,
      totalParticipants: participantsForCategory.length,
      overallAttendanceRate: overallAttendanceRate.toFixed(1),
      participantStats,
    };
  }, [selectedCategoryId, meetings, participants, meetingAttendees, participantMeetingCategories]);

  // Helper function to safely wrap values in quotes if they contain the separator or quotes.
  const escapeCsvValue = (value: any): string => {
    const stringValue = String(value ?? '').trim();
    if (stringValue.includes('"') || stringValue.includes(';') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const handleExportAttendanceToCSV = () => {
    if (!statsForSelectedCategory) return;

    const { participantStats } = statsForSelectedCategory;
    const commissionName = meetingCategories.find(c => c.id === selectedCategoryId)?.name || 'Comision';
    
    const safeFilename = commissionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    const separator = ';';

    const headers = [
      'Participante',
      'Presencial',
      'En Línea',
      'Total Asistido',
      'Inasistencias',
      'Tasa de Asistencia',
    ];

    const csvRows = participantStats.map(stat => {
      const row = [
        escapeCsvValue(stat.participantName),
        escapeCsvValue(stat.attendedInPerson),
        escapeCsvValue(stat.attendedOnline),
        escapeCsvValue(`${stat.totalAttended} / ${stat.totalMeetings}`),
        escapeCsvValue(stat.missed),
        escapeCsvValue(`${stat.attendanceRate}%`),
      ];
      return row.join(separator);
    });

    const csvString = [headers.join(separator), ...csvRows].join('\n');
    
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `estadisticas_asistencia_${safeFilename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  const handleExportParticipantsByCommission = () => {
    if (selectedCommissionIdsForReport.length === 0) {
      alert('Por favor, seleccione al menos una comisión.');
      return;
    }

    const getCompanyName = (participant: Participant): string => {
      if (!participant.id_establecimiento) return 'N/A';
      const company = companies.find(c => c.id_establecimiento === participant.id_establecimiento);
      return company ? company.nombre_establecimiento : 'Desconocido';
    };

    const headers = ['Comision', 'Participante'];
    reportFieldOptions.forEach(field => {
        if (selectedFieldsForReport.includes(field.id)) {
            headers.push(field.label);
        }
    });

    const rows: string[][] = [];

    selectedCommissionIdsForReport.forEach(commissionId => {
      const commission = meetingCategories.find(c => c.id === commissionId);
      if (!commission) return;

      const participantIdsInCommission = participantMeetingCategories
        .filter(pc => pc.meeting_category_id === commissionId)
        .map(pc => pc.participant_id);
      
      const participantsInCommission = participants
        .filter(p => participantIdsInCommission.includes(p.id))
        .sort((a,b) => a.name.localeCompare(b.name));

      if (participantsInCommission.length === 0) {
          const emptyRow = [escapeCsvValue(commission.name), '(Sin participantes asignados)', ...Array(headers.length - 2).fill('')];
          rows.push(emptyRow);
      } else {
          participantsInCommission.forEach(participant => {
              const row: string[] = [escapeCsvValue(commission.name), escapeCsvValue(participant.name)];
              if (selectedFieldsForReport.includes('role')) row.push(escapeCsvValue(participant.role));
              if (selectedFieldsForReport.includes('email')) row.push(escapeCsvValue(participant.email));
              if (selectedFieldsForReport.includes('phone')) row.push(escapeCsvValue(participant.phone));
              if (selectedFieldsForReport.includes('company')) row.push(escapeCsvValue(getCompanyName(participant)));
              rows.push(row);
          });
      }
    });
    
    const csvString = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'reporte_participantes_por_comision.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    setIsParticipantReportModalOpen(false);
    setSelectedCommissionIdsForReport([]);
    setCommissionSearchTerm('');
  };

  const filteredCommissionsForModal = useMemo(() => 
    meetingCategories
      .filter(c => c.name.toLowerCase().includes(commissionSearchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [meetingCategories, commissionSearchTerm]
  );
  
  const handleToggleCommissionSelection = (commissionId: string) => {
    setSelectedCommissionIdsForReport(prev => 
      prev.includes(commissionId) 
        ? prev.filter(id => id !== commissionId) 
        : [...prev, commissionId]
    );
  };
  
  const handleSelectAllCommissions = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allVisibleIds = filteredCommissionsForModal.map(c => c.id);
      setSelectedCommissionIdsForReport(prev => [...new Set([...prev, ...allVisibleIds])]);
    } else {
      const allVisibleIds = filteredCommissionsForModal.map(c => c.id);
      setSelectedCommissionIdsForReport(prev => prev.filter(id => !allVisibleIds.includes(id)));
    }
  };

  const handleToggleFieldSelection = (fieldId: string) => {
    setSelectedFieldsForReport(prev => 
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    );
  };


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Estadísticas de Comisiones</h1>
        {onNavigateBack && <Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Análisis de Participación</CardTitle>
          <CardDescription>Seleccione una comisión para ver sus estadísticas de asistencia y participación.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select 
            options={categoryOptions}
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full max-w-md"
            aria-label="Seleccionar Comisión"
          />
        </CardContent>
      </Card>
      
      {statsForSelectedCategory && (
        <Card>
            <CardHeader>
              <CardTitle>Resumen de la Comisión: {meetingCategories.find(c => c.id === selectedCategoryId)?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{statsForSelectedCategory.totalMeetings}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Reuniones Realizadas</p>
                </div>
                <div className="p-4 bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{statsForSelectedCategory.totalParticipants}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Participantes Asignados</p>
                </div>
                <div className="p-4 bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{statsForSelectedCategory.overallAttendanceRate}%</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Asistencia General</p>
                </div>
              </div>
            </CardContent>
        </Card>
      )}

      {statsForSelectedCategory && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <CardTitle>Estadísticas por Participante</CardTitle>
                <CardDescription>Detalle de asistencia de cada miembro de la comisión.</CardDescription>
              </div>
              <Button
                onClick={handleExportAttendanceToCSV}
                variant="secondary"
                size="sm"
                className="mt-4 sm:mt-0"
                disabled={!statsForSelectedCategory}
              >
                <ExportIcon className="w-4 h-4 mr-2" />
                Exportar Asistencia
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participante</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Presencial</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">En Línea</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Asistido</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Inasistencias</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tasa de Asistencia</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                    {statsForSelectedCategory.participantStats.map(stat => (
                      <tr key={stat.participantId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{stat.participantName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-300">{stat.attendedInPerson}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-300">{stat.attendedOnline}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-700 dark:text-gray-200">{stat.totalAttended} / {stat.totalMeetings}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-500">{stat.missed}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-300">{stat.attendanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reporte de Participantes por Comisión</CardTitle>
          <CardDescription>Exporte una lista de participantes para una o más comisiones seleccionadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setIsParticipantReportModalOpen(true)}>
            <ExportIcon className="w-4 h-4 mr-2" />
            Generar Reporte de Participantes
          </Button>
        </CardContent>
      </Card>
      
      <Modal
        isOpen={isParticipantReportModalOpen}
        onClose={() => setIsParticipantReportModalOpen(false)}
        title="Generar Reporte de Participantes"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Seleccione las comisiones de las que desea generar una lista de participantes.
          </p>
          <Input
            type="search"
            placeholder="Buscar comisiones..."
            value={commissionSearchTerm}
            onChange={(e) => setCommissionSearchTerm(e.target.value)}
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto border dark:border-slate-600 rounded-md p-2 space-y-1">
            {filteredCommissionsForModal.length > 0 && (
              <div className="flex items-center p-2 border-b dark:border-slate-600">
                <input
                  type="checkbox"
                  id="select-all-commissions"
                  onChange={handleSelectAllCommissions}
                  checked={filteredCommissionsForModal.length > 0 && filteredCommissionsForModal.every(c => selectedCommissionIdsForReport.includes(c.id))}
                  ref={el => {
                      if (el) {
                          const selectedCount = filteredCommissionsForModal.filter(c => selectedCommissionIdsForReport.includes(c.id)).length;
                          el.indeterminate = selectedCount > 0 && selectedCount < filteredCommissionsForModal.length;
                      }
                  }}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="select-all-commissions" className="ml-2 text-sm font-medium">
                  Seleccionar/Deseleccionar Visibles
                </label>
              </div>
            )}
            {filteredCommissionsForModal.map(commission => (
              <div
                key={commission.id}
                className="flex items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <input
                  type="checkbox"
                  id={`commission-${commission.id}`}
                  checked={selectedCommissionIdsForReport.includes(commission.id)}
                  onChange={() => handleToggleCommissionSelection(commission.id)}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor={`commission-${commission.id}`} className="ml-2 text-sm w-full">
                  {commission.name}
                </label>
              </div>
            ))}
             {filteredCommissionsForModal.length === 0 && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No se encontraron comisiones.</p>
             )}
          </div>

          <div className="pt-4 border-t dark:border-slate-600">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Campos a Incluir en el Reporte</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {reportFieldOptions.map(field => (
                <div key={field.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`field-${field.id}`}
                    checked={selectedFieldsForReport.includes(field.id)}
                    onChange={() => handleToggleFieldSelection(field.id)}
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor={`field-${field.id}`} className="ml-2 text-sm">{field.label}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="secondary" onClick={() => setIsParticipantReportModalOpen(false)}>Cancelar</Button>
          <Button 
            variant="primary" 
            onClick={handleExportParticipantsByCommission}
            disabled={selectedCommissionIdsForReport.length === 0}
          >
            <ExportIcon className="w-4 h-4 mr-2"/>
            Exportar ({selectedCommissionIdsForReport.length})
          </Button>
        </div>
      </Modal>

    </div>
  );
};

export default StatsView;
