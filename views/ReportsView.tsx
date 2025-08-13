// views/ReportsView.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { Meeting, Event, Participant, MeetingCategory, EventCategory, MeetingAttendee, EventAttendee, EventOrganizingMeetingCategory, EventOrganizingCategory, Company } from '../types';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import Input from '../components/ui/Input';
import AppLogoIcon from '../components/icons/AppLogoIcon';
import ExportIcon from '../components/icons/ExportIcon';

declare global {
  interface Window {
    jspdf: any;
    html2canvas: any;
  }
}

interface ReportsViewProps {
    meetings: Meeting[];
    events: Event[];
    participants: Participant[];
    companies: Company[];
    meetingCategories: MeetingCategory[];
    eventCategories: EventCategory[];
    meetingAttendees: MeetingAttendee[];
    eventAttendees: EventAttendee[];
    eventOrganizingMeetingCategories: EventOrganizingMeetingCategory[];
    eventOrganizingCategories: EventOrganizingCategory[];
    onNavigateBack?: () => void;
}

type ActivityItem = (Meeting & { type: 'meeting' }) | (Event & { type: 'event' });

interface ReportData {
  startDate: string;
  endDate: string;
  activities: (ActivityItem & { 
    durationMinutes: number | null; 
    totalParticipants: number; 
    participantNames: string[];
    inPersonCount: number;
    onlineCount: number;
    externalCount: number;
  })[];
  summary: {
    totalMeetings: number;
    totalEvents: number;
    totalHours: number;
    totalParticipants: number;
  };
}

type ReportType = 'weekly' | 'monthly' | 'custom';

const ReportsView: React.FC<ReportsViewProps> = ({
  meetings, events, participants, companies, meetingCategories, eventCategories,
  meetingAttendees, eventAttendees, eventOrganizingMeetingCategories, eventOrganizingCategories,
  onNavigateBack
}) => {
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getMeetingCategoryName = useCallback((id: string) => meetingCategories.find(c => c.id === id)?.name || 'Desconocida', [meetingCategories]);
  const getEventCategoryName = useCallback((id: string) => eventCategories.find(c => c.id === id)?.name || 'Desconocida', [eventCategories]);

  const getDisplayOrganizerName = useCallback((item: ActivityItem): string => {
    if (item.type === 'meeting') {
      return getMeetingCategoryName(item.meetingCategoryId);
    } else { // Event
      if (item.organizerType === 'meeting_category') {
        const orgLinks = eventOrganizingMeetingCategories.filter(eoc => eoc.event_id === item.id);
        const names = orgLinks.map(eoc => getMeetingCategoryName(eoc.meeting_category_id));
        return names.join(', ') || 'N/A';
      } else {
        const orgLinks = eventOrganizingCategories.filter(eoc => eoc.event_id === item.id);
        const names = orgLinks.map(eoc => getEventCategoryName(eoc.category_id));
        return names.join(', ') || 'N/A';
      }
    }
  }, [getMeetingCategoryName, getEventCategoryName, eventOrganizingMeetingCategories, eventOrganizingCategories]);

  const getParticipantName = useCallback((id: string) => participants.find(p => p.id === id)?.name || 'Desconocido', [participants]);
  
  const calculateDuration = (startTime: string | null, endTime?: string): number | null => {
    if (!startTime || !endTime) return null;
    try {
      const start = new Date(`1970-01-01T${startTime}`);
      const end = new Date(`1970-01-01T${endTime}`);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
      return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
    } catch (e) {
      return null;
    }
  };

  const handleGenerateReport = () => {
    let startDate: Date, endDate: Date;
    
    try {
        switch (reportType) {
            case 'weekly': {
                if (!selectedWeek) { alert('Por favor, seleccione una semana.'); return; }
                const [year, weekNum] = selectedWeek.split('-W').map(Number);
                const firstDayOfYear = new Date(year, 0, 1);
                const daysOffset = (weekNum - 1) * 7 - firstDayOfYear.getDay() + 1;
                startDate = new Date(year, 0, daysOffset);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            }
            case 'monthly': {
                if (!selectedMonth) { alert('Por favor, seleccione un mes.'); return; }
                const [year, month] = selectedMonth.split('-').map(Number);
                startDate = new Date(year, month - 1, 1);
                endDate = new Date(year, month, 0);
                break;
            }
            case 'custom': {
                if (!customStartDate || !customEndDate) { alert('Por favor, seleccione un rango de fechas.'); return; }
                startDate = new Date(customStartDate + 'T00:00:00');
                endDate = new Date(customEndDate + 'T23:59:59');
                if (startDate > endDate) { alert('La fecha de inicio debe ser anterior a la fecha de fin.'); return; }
                break;
            }
        }
    } catch (e) {
        alert('Fecha inválida. Por favor, verifique su selección.');
        return;
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const allActivities: ActivityItem[] = [
      ...meetings.map(m => ({ ...m, type: 'meeting' as 'meeting' })),
      ...events.map(e => ({ ...e, type: 'event' as 'event' })),
    ];
    
    const filteredActivities = allActivities.filter(item => {
        const itemDate = new Date(item.date + 'T00:00:00');
        return itemDate >= startDate && itemDate <= endDate;
    }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime() || (a.startTime || '').localeCompare(b.startTime || ''));
    
    const processedActivities = filteredActivities.map(item => {
        const attendees = item.type === 'meeting' 
            ? meetingAttendees.filter(a => a.meeting_id === item.id) 
            : eventAttendees.filter(a => a.event_id === item.id);
        
        const participantIds = attendees.map(a => a.participant_id);
        const inPersonCount = attendees.filter(a => a.attendance_type === 'in_person').length;
        const onlineCount = attendees.filter(a => a.attendance_type === 'online').length;
        const externalCount = item.externalParticipantsCount || 0;

        return {
            ...item,
            durationMinutes: calculateDuration(item.startTime, item.endTime),
            totalParticipants: externalCount + inPersonCount + onlineCount,
            participantNames: participantIds.map(getParticipantName),
            inPersonCount,
            onlineCount,
            externalCount,
        };
    });

    const totalMeetings = processedActivities.filter(a => a.type === 'meeting').length;
    const totalEvents = processedActivities.filter(a => a.type === 'event').length;
    const totalMinutes = processedActivities.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
    const totalParticipation = processedActivities.reduce((sum, item) => sum + item.totalParticipants, 0);

    setReportData({
        startDate: startStr,
        endDate: endStr,
        activities: processedActivities,
        summary: {
            totalMeetings,
            totalEvents,
            totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
            totalParticipants: totalParticipation,
        }
    });
  };

  const handleDownloadPdf = async () => {
    if (!reportData) return;
    setIsLoading(true);

    const reportPages = document.querySelectorAll<HTMLElement>('.report-page');
    if (reportPages.length === 0) {
      setIsLoading(false);
      alert('No se encontró contenido para exportar.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [1080, 1920]
    });

    for (let i = 0; i < reportPages.length; i++) {
      const pageElement = reportPages[i];
      try {
        const canvas = await window.html2canvas(pageElement, {
          scale: 2, // Higher scale for better quality
          useCORS: true,
          logging: false,
          width: 1080, // Force canvas width
          height: 1920, // Force canvas height
          windowWidth: 1080,
          windowHeight: 1920,
        });

        const imgData = canvas.toDataURL('image/png');

        if (i > 0) {
          pdf.addPage([1080, 1920], 'p');
        }

        pdf.addImage(imgData, 'PNG', 0, 0, 1080, 1920, undefined, 'FAST');

      } catch (error) {
        console.error(`Error al procesar la página ${i + 1}:`, error);
        alert(`Ocurrió un error al generar la página ${i + 1} del PDF.`);
      }
    }

    pdf.save(`Reporte_CIECNow_${reportData.startDate}_${reportData.endDate}.pdf`);
    setIsLoading(false);
  };

  const renderDateControls = () => {
    switch(reportType) {
        case 'weekly': return <Input label="Seleccione la Semana" type="week" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className="dark:[color-scheme:dark]" />;
        case 'monthly': return <Input label="Seleccione el Mes" type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="dark:[color-scheme:dark]" />;
        case 'custom': return (<div className="flex flex-col sm:flex-row gap-4">
            <Input label="Fecha de Inicio" type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="dark:[color-scheme:dark]" />
            <Input label="Fecha de Fin" type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="dark:[color-scheme:dark]" />
        </div>);
    }
  };

  const renderReportPreview = () => {
    if (!reportData) return null;

    const formatTo12HourTime = (timeString: string | null | undefined): string => {
        if (!timeString) return '';
        try {
            const [hours, minutes] = timeString.split(':');
            const h = parseInt(hours, 10);
            if (isNaN(h) || !minutes) return timeString;
            const ampm = h >= 12 ? 'pm' : 'am';
            let h12 = h % 12;
            if (h12 === 0) h12 = 12;
            return `${h12}:${minutes.padStart(2, '0')} ${ampm}`;
        } catch {
            return timeString;
        }
      };
      
    const formatTimeRange = (startTime: string | null, endTime?: string): string => {
        if (!startTime) return 'Hora no especificada';
        const startFormatted = formatTo12HourTime(startTime);
        if (!endTime) return startFormatted;
        const endFormatted = formatTo12HourTime(endTime);
        return `${startFormatted} - ${endFormatted}`;
    };

    const formatFullDate = (dateStr: string) => {
        if (!dateStr) return 'Fecha no especificada';
        const date = new Date(dateStr + 'T00:00:00');
        const formatted = date.toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'UTC'
        });
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    const formatDuration = (minutes: number | null): string => {
        if (minutes === null || isNaN(minutes) || minutes < 0) return 'N/A';
        if (minutes === 0) return '0h';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        let result = '';
        if (h > 0) result += `${h}h`;
        if (m > 0) result += ` ${m}m`;
        return result.trim() || '0m';
    };

    const formatDateForHeader = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Chunk activities for pagination
    const pages = [];
    const activitiesPerPage = 5; // Adjust this based on average item height

    // Page 1: Summary
    pages.push(
      <div key="page-summary" className="report-page mx-auto mb-4 w-[210mm] h-[297mm] bg-white text-black p-8 border border-gray-300 flex flex-col">
        <header className="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
          <div>
              <h1 className="text-3xl font-bold text-gray-800">Reporte de Actividades</h1>
              <p className="text-gray-600">Período: {formatDateForHeader(reportData.startDate)} - {formatDateForHeader(reportData.endDate)}</p>
          </div>
          <AppLogoIcon className="w-20 h-20 text-primary-700" />
        </header>
        <section className="mb-8">
            <h2 className="text-xl font-semibold border-b border-gray-400 pb-2 mb-4">Resumen General</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center justify-center p-4 bg-sky-100 rounded-xl shadow-md space-y-2 text-sky-800">
                    <span className="text-4xl" role="img" aria-label="Reuniones">🤝</span>
                    <p className="text-4xl font-extrabold">{reportData.summary.totalMeetings}</p>
                    <p className="font-semibold text-sky-700">Reuniones</p>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-emerald-100 rounded-xl shadow-md space-y-2 text-emerald-800">
                    <span className="text-4xl" role="img" aria-label="Eventos">🏢</span>
                    <p className="text-4xl font-extrabold">{reportData.summary.totalEvents}</p>
                    <p className="font-semibold text-emerald-700">Eventos</p>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-amber-100 rounded-xl shadow-md space-y-2 text-amber-800">
                    <span className="text-4xl" role="img" aria-label="Horas">⏰</span>
                    <p className="text-4xl font-extrabold">{reportData.summary.totalHours}</p>
                    <p className="font-semibold text-amber-700">Horas Totales</p>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-violet-100 rounded-xl shadow-md space-y-2 text-violet-800">
                    <span className="text-4xl" role="img" aria-label="Participación">👥</span>
                    <p className="text-4xl font-extrabold">{reportData.summary.totalParticipants}</p>
                    <p className="font-semibold text-violet-700">Participación</p>
                </div>
            </div>
        </section>
        <footer className="text-center text-xs text-gray-500 pt-8 mt-auto border-t">Página 1</footer>
      </div>
    );
    
    // Subsequent pages: Activities
    const activityChunks = [];
    for (let i = 0; i < reportData.activities.length; i += activitiesPerPage) {
        activityChunks.push(reportData.activities.slice(i, i + activitiesPerPage));
    }

    activityChunks.forEach((chunk, index) => {
        pages.push(
            <div key={`page-activities-${index}`} className="report-page mx-auto mb-4 w-[210mm] h-[297mm] bg-white text-black p-8 border border-gray-300 flex flex-col">
                <header className="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Detalle de Actividades</h1>
                    <AppLogoIcon className="w-20 h-20 text-primary-700" />
                </header>
                <section className="flex-grow">
                    <div className="space-y-4">
                        {chunk.map(item => (
                            <div key={item.id} className={`border rounded-lg p-3 break-inside-avoid ${item.type === 'meeting' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                                <h3 className={`text-lg font-bold ${item.type === 'meeting' ? 'text-blue-800' : 'text-green-800'}`}>{item.subject}</h3>
                                <p className="text-sm font-semibold text-gray-600">{formatFullDate(item.date)} | {formatTimeRange(item.startTime, item.endTime)}</p>
                                <div className="mt-2 text-sm text-gray-700">
                                    <div className="grid grid-cols-2 gap-x-4">
                                        <div className="space-y-1">
                                            <p><strong className="font-semibold text-gray-800">Categoría:</strong> {getDisplayOrganizerName(item)}</p>
                                            <p><strong className="font-semibold text-gray-800">Duración:</strong> {formatDuration(item.durationMinutes)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p><strong className="font-semibold text-gray-800">Ubicación:</strong> {item.location || 'N/A'}</p>
                                            <div>
                                                <p><strong className="font-semibold text-gray-800">Part. ({item.totalParticipants}):</strong></p>
                                                <div className="pl-2 text-xs">
                                                    {item.inPersonCount > 0 && <p>Presenciales: {item.inPersonCount}</p>}
                                                    {item.onlineCount > 0 && <p>Online: {item.onlineCount}</p>}
                                                    {item.externalCount > 0 && <p>Externos: {item.externalCount}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {item.participantNames.length > 0 && <p className="text-xs mt-2 text-gray-600"><strong className="font-semibold text-gray-700">Asistentes:</strong> {item.participantNames.join(', ')}</p>}
                            </div>
                        ))}
                    </div>
                </section>
                <footer className="text-center text-xs text-gray-500 pt-8 mt-auto border-t">Página {index + 2}</footer>
            </div>
        );
    });

    return (
        <Card className="mt-6">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                    <CardTitle>Vista Previa del Reporte</CardTitle>
                    <CardDescription>Período del {formatDateForHeader(reportData.startDate)} al {formatDateForHeader(reportData.endDate)}</CardDescription>
                </div>
                <Button onClick={handleDownloadPdf} disabled={isLoading}>
                    <ExportIcon className="w-4 h-4 mr-2" />
                    {isLoading ? 'Generando PDF...' : 'Descargar PDF'}
                </Button>
            </CardHeader>
            <CardContent className="bg-gray-200 dark:bg-slate-900 p-4 sm:p-8">
                {/* This outer div is just for on-screen scrolling, it's not part of the PDF itself */}
                <div id="report-preview-container" className="max-h-[80vh] overflow-y-auto">
                    {pages}
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Generador de Reportes</h1>
        {onNavigateBack && <Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración del Reporte</CardTitle>
          <CardDescription>Seleccione el período y tipo de reporte que desea generar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Reporte</label>
            <div className="flex flex-wrap gap-2">
                {(['weekly', 'monthly', 'custom'] as ReportType[]).map(type => (
                    <Button key={type} variant={reportType === type ? 'primary' : 'secondary'} onClick={() => setReportType(type)}>
                        {type === 'weekly' ? 'Semanal' : type === 'monthly' ? 'Mensual' : 'Personalizado'}
                    </Button>
                ))}
            </div>
          </div>
          {renderDateControls()}
          <div className="pt-4">
            <Button onClick={handleGenerateReport} variant="accent" size="lg">Generar Vista Previa</Button>
          </div>
        </CardContent>
      </Card>

      {renderReportPreview()}
    </div>
  );
};

export default ReportsView;
