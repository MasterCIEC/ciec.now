


import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Meeting, Participant, MeetingCategory, Event, EventCategory, MeetingAttendee, EventAttendee, EventOrganizingMeetingCategory, EventOrganizingCategory } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/Modal';
import EditIcon from '../components/icons/EditIcon';
import Select from '../components/ui/Select';
import ScheduleIcon from '../components/icons/ScheduleIcon';
import EventsIcon from '../components/icons/EventsIcon';
import Input from '../components/ui/Input';
import AddToGoogleCalendar from '../components/AddToGoogleCalendar';
import SubscribeIcon from '../components/icons/SubscribeIcon';
import CopyIcon from '../components/icons/CopyIcon';
import CheckIcon from '../components/icons/CheckIcon';
import GoogleCalendarIcon from '../components/icons/GoogleCalendarIcon';
import ExternalLinkIcon from '../components/icons/ExternalLinkIcon';


type CalendarViewMode = 'month' | 'year' | 'week' | 'day';

interface AgendaItemBase {
  id: string;
  subject: string;
  date: string;
  startTime: string | null;
  endTime?: string;
  location?: string | null;
  description?: string | null;
}

interface MeetingAgendaItem extends AgendaItemBase {
  type: 'meeting';
  meetingCategoryId: string;
  externalParticipantsCount?: number;
  originalMeeting: Meeting;
}

interface EventAgendaItem extends AgendaItemBase {
  type: 'event';
  organizerType: 'meeting_category' | 'category';
  externalParticipantsCount?: number;
  cost?: number;
  investment?: number;
  revenue?: number;
  originalEvent: Event;
  startTime: string; // Events have non-nullable startTime
}

type AgendaItem = MeetingAgendaItem | EventAgendaItem;

interface AgendaViewProps {
  meetings: Meeting[];
  participants: Participant[];
  meetingCategories: MeetingCategory[];
  events: Event[];
  eventCategories: EventCategory[];
  meetingAttendees: MeetingAttendee[];
  eventAttendees: EventAttendee[];
  eventOrganizingMeetingCategories: EventOrganizingMeetingCategory[];
  eventOrganizingCategories: EventOrganizingCategory[];
  onEditMeeting: (meeting: Meeting) => void;
  onEditEvent: (event: Event) => void;
  onQuickAddMeeting: (meetingData: Omit<Meeting, 'id'>) => void;
  onQuickAddEvent: (eventData: Omit<Event, 'id'>, organizerId: string) => void;
  onNavigateBack?: () => void;
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // Sunday - 0, Monday - 1
const addMonths = (date: Date, months: number): Date => {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
};
const addYears = (date: Date, years: number): Date => {
    const newDate = new Date(date);
    newDate.setFullYear(newDate.getFullYear() + years);
    return newDate;
};
const addDays = (date: Date, days: number): Date => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
};

const getStartOfWeek = (date: Date, startDay: number = 0): Date => { // 0 for Sunday, 1 for Monday
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === startDay ? 0 : (day < startDay ? -7 + startDay : startDay) );
    return new Date(d.setDate(diff));
};

const isSameDay = (date1: Date, date2: Date) => date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
const formatDateToYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];


const AgendaView: React.FC<AgendaViewProps> = ({ 
    meetings, participants, meetingCategories, events, eventCategories, 
    meetingAttendees, eventAttendees, eventOrganizingMeetingCategories, eventOrganizingCategories,
    onEditMeeting, onEditEvent, onQuickAddMeeting, onQuickAddEvent, onNavigateBack 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('month');
  const [selectedDayDetailsForModal, setSelectedDayDetailsForModal] = useState<{ date: Date; items: AgendaItem[] } | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [filterMeetingCategoryId, setFilterMeetingCategoryId] = useState<string>(''); 

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: Date } | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ type: 'meeting' | 'event'; date: Date; x: number; y: number } | null>(null);
  const quickAddFormRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const CALENDAR_FEED_URL = 'https://zsbyslmvvfzhpenfpxzm.supabase.co/functions/v1/calendar-feed';
  
  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(CALENDAR_FEED_URL).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }, (err) => {
        console.error('Could not copy text: ', err);
        alert('No se pudo copiar la URL.');
    });
  }, [CALENDAR_FEED_URL]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
      if (quickAddFormRef.current && !quickAddFormRef.current.contains(event.target as Node)) {
        setQuickAdd(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const getParticipantName = useCallback((id: string) => participants.find(p => p.id === id)?.name || 'Desconocido', [participants]);
  const getMeetingCategoryName = useCallback((id: string) => meetingCategories.find(c => c.id === id)?.name || 'Categoría Desconocida', [meetingCategories]);
  const getEventCategoryName = useCallback((id: string) => eventCategories.find(ec => ec.id === id)?.name || 'Categoría Desconocida', [eventCategories]);
  
  const getDisplayOrganizerNameForEvent = useCallback((eventItem: EventAgendaItem): string => {
    const { originalEvent } = eventItem;

    if (originalEvent.organizerType === 'meeting_category') {
      const orgLinks = eventOrganizingMeetingCategories.filter(eoc => eoc.event_id === originalEvent.id);
      const meetingCategoryNames = orgLinks.map(eoc => getMeetingCategoryName(eoc.meeting_category_id));
      
      if (meetingCategoryNames.length === 0) return 'Categoría de Reunión No Especificada';
      return `Cat. Reunión: ${meetingCategoryNames.join(', ')}`;
    } else { // category
      const orgLinks = eventOrganizingCategories.filter(eoc => eoc.event_id === originalEvent.id);
      const categoryNames = orgLinks.map(eoc => getEventCategoryName(eoc.category_id));

      if (categoryNames.length === 0) return 'Categoría de Evento No Especificada';
      return categoryNames.join(', ');
    }
  }, [eventOrganizingMeetingCategories, eventOrganizingCategories, getMeetingCategoryName, getEventCategoryName]);


  const allAgendaItems = useMemo(() => {
    const mappedMeetings: MeetingAgendaItem[] = meetings.map(m => ({
      id: m.id, subject: m.subject, date: m.date, startTime: m.startTime, endTime: m.endTime,
      location: m.location, description: m.description, type: 'meeting', meetingCategoryId: m.meetingCategoryId,
      externalParticipantsCount: m.externalParticipantsCount, originalMeeting: m,
    }));
    const mappedEvents: EventAgendaItem[] = events.map(e => ({
      id: e.id, subject: e.subject, date: e.date, startTime: e.startTime, endTime: e.endTime,
      location: e.location, description: e.description, type: 'event', organizerType: e.organizerType,
      externalParticipantsCount: e.externalParticipantsCount,
      cost: e.cost, investment: e.investment, revenue: e.revenue, originalEvent: e,
    }));
    return [...mappedMeetings, ...mappedEvents];
  }, [meetings, events]);
  
  const filteredAgendaItemsGlobal = useMemo(() => {
    return allAgendaItems.filter(item => {
      if (filterMeetingCategoryId) {
        if (item.type === 'meeting') {
          return item.meetingCategoryId === filterMeetingCategoryId;
        }
        if (item.type === 'event' && item.originalEvent.organizerType === 'meeting_category') {
          return eventOrganizingMeetingCategories.some(eoc => eoc.event_id === item.originalEvent.id && eoc.meeting_category_id === filterMeetingCategoryId);
        }
        return false; 
      }
      return true; 
    });
  }, [allAgendaItems, filterMeetingCategoryId, eventOrganizingMeetingCategories]);
  
  const agendaItemsByDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    filteredAgendaItemsGlobal.forEach(item => {
      const dateKey = item.date; // Assumes item.date is YYYY-MM-DD
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(item);
    });
    map.forEach((dayItems) => dayItems.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));
    return map;
  }, [filteredAgendaItemsGlobal]);

  const handleNavigation = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }
    const increment = direction === 'prev' ? -1 : 1;
    switch (calendarViewMode) {
      case 'month': setCurrentDate(prev => addMonths(prev, increment)); break;
      case 'year': setCurrentDate(prev => addYears(prev, increment)); break;
      case 'week': setCurrentDate(prev => addDays(prev, increment * 7)); break;
      case 'day': setCurrentDate(prev => addDays(prev, increment)); break;
    }
  };

  const handleDayCellClick = (date: Date) => { setCurrentDate(date); setCalendarViewMode('day'); };
  const handleMonthInYearClick = (year: number, monthIndex: number) => { setCurrentDate(new Date(year, monthIndex, 1)); setCalendarViewMode('month'); };
  
  const handleDayContextMenu = (event: React.MouseEvent, date: Date) => {
    event.preventDefault();
    setContextMenu({ x: event.pageX, y: event.pageY, date });
    setQuickAdd(null);
  };
  
  const handleOpenDayDetailsModal = (date: Date) => {
    const dateKey = formatDateToYYYYMMDD(date);
    const itemsOnDay = agendaItemsByDate.get(dateKey) || [];
    setSelectedDayDetailsForModal({ date, items: itemsOnDay });
    setIsDayModalOpen(true);
  };

  const getCalendarTitle = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();
    const monthNameLong = currentDate.toLocaleDateString('es-ES', { month: 'long' });

    switch (calendarViewMode) {
        case 'month': return `${monthNameLong.charAt(0).toUpperCase() + monthNameLong.slice(1)} ${year}`;
        case 'year': return `${year}`;
        case 'week':
            const startOfWeek = getStartOfWeek(currentDate, 0); // Sunday as start
            const endOfWeek = addDays(startOfWeek, 6);
            const startMonthName = startOfWeek.toLocaleDateString('es-ES', { month: 'long' });
            const endMonthName = endOfWeek.toLocaleDateString('es-ES', { month: 'long' });
            if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
                return `Semana del ${startOfWeek.getDate()} al ${endOfWeek.getDate()} de ${startMonthName}, ${year}`;
            }
            return `Semana del ${startOfWeek.getDate()} de ${startMonthName} al ${endOfWeek.getDate()} de ${endMonthName}, ${year}`;
        case 'day': return `${day} de ${monthNameLong}, ${year}`;
        default: return '';
    }
  };
    
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const renderMonthGrid = () => {
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long' });
    const firstDayOffset = getFirstDayOfMonth(year, month); const daysInThisMonth = getDaysInMonth(year, month);
    const today = new Date(); const cells = [];

    for (let i = 0; i < firstDayOffset; i++) cells.push(<div key={`empty-start-${i}`} className="border dark:border-gray-700 p-1 sm:p-2 h-24 sm:h-32 bg-gray-50 dark:bg-gray-800/30"></div>);

    for (let day = 1; day <= daysInThisMonth; day++) {
      const cellDate = new Date(year, month, day); const dateKey = formatDateToYYYYMMDD(cellDate);
      const itemsOnDay = agendaItemsByDate.get(dateKey) || []; const isToday = isSameDay(cellDate, today);
      const maxVisibleItems = 2;

      cells.push(
        <div key={`day-${day}`} 
          className={`border dark:border-gray-700 p-1 sm:p-2 h-24 sm:h-32 cursor-pointer transition-colors duration-150 flex flex-col justify-start items-start overflow-hidden ${isToday ? 'bg-primary-100 dark:bg-primary-800/30' : 'bg-white dark:bg-gray-800'} hover:bg-primary-50 dark:hover:bg-gray-700`}
          onClick={() => handleDayCellClick(new Date(year, month, day))} 
          onContextMenu={(e) => handleDayContextMenu(e, new Date(year, month, day))}
          role="button" tabIndex={0} aria-label={`Ver actividades para ${day} de ${monthName}`}>
          <span className={`font-medium text-xs sm:text-sm ${isToday ? 'text-primary-700 dark:text-primary-300 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>{day}</span>
          {itemsOnDay.length > 0 && (
            <div className="mt-0.5 space-y-0.5 w-full">
              {itemsOnDay.slice(0, maxVisibleItems).map(item => {
                const bgColor = item.type === 'meeting' ? 'bg-primary-500 dark:bg-primary-600' : 'bg-green-500 dark:bg-green-600';
                const organizerName = item.type === 'meeting' ? getMeetingCategoryName(item.meetingCategoryId) : getDisplayOrganizerNameForEvent(item as EventAgendaItem);
                const title = `${item.subject} (${organizerName}) a las ${item.startTime || 'N/A'}`;
                 return (<div key={item.id} className={`text-xxs sm:text-xs p-0.5 rounded ${bgColor} text-white truncate`} title={title}><p className="font-semibold truncate leading-tight">{item.type === 'meeting' ? 'R:' : 'E:'} {organizerName}</p><p className="text-xxs truncate leading-tight">{item.startTime || 'N/A'}</p></div>)
              })}
              {itemsOnDay.length > maxVisibleItems && (<span className="text-xs text-gray-600 dark:text-gray-400 font-medium mt-0.5 block">+{itemsOnDay.length - maxVisibleItems} más</span>)}
            </div>
          )}
        </div>
      );
    }
    return cells;
  };
  
  const renderYearGrid = () => {
    const year = currentDate.getFullYear();
    const monthsGrid = [];
    for (let i = 0; i < 12; i++) {
        const monthDate = new Date(year, i, 1);
        const monthKeyPrefix = formatDateToYYYYMMDD(monthDate).substring(0, 7); // YYYY-MM
        let itemsInMonthCount = 0;
        agendaItemsByDate.forEach((items, dateKey) => {
            if (dateKey.startsWith(monthKeyPrefix)) {
                itemsInMonthCount += items.length;
            }
        });

        monthsGrid.push(
            <div key={i}
                className="border dark:border-gray-700 p-2 sm:p-4 h-28 sm:h-32 flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => handleMonthInYearClick(year, i)}
                role="button" tabIndex={0} aria-label={`Ver ${monthNames[i]} ${year}`}>
                <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{monthNames[i]}</span>
                {itemsInMonthCount > 0 && (
                    <span className="text-xs text-primary-600 dark:text-primary-400 mt-1">{itemsInMonthCount} {itemsInMonthCount === 1 ? 'actividad' : 'actividades'}</span>
                )}
            </div>
        );
    }
    return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-700 border dark:border-gray-700">{monthsGrid}</div>;
  };

  const renderWeekGrid = () => {
    const startOfWeek = getStartOfWeek(currentDate, 0); // Sunday start
    const weekDays = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
        const dayDate = addDays(startOfWeek, i);
        const dateKey = formatDateToYYYYMMDD(dayDate);
        const itemsOnDay = agendaItemsByDate.get(dateKey) || [];
        const isToday = isSameDay(dayDate, today);
        const maxVisibleItems = 4;

        weekDays.push(
            <div key={dateKey} className={`border dark:border-gray-600 p-2 ${isToday ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-white dark:bg-gray-800'} flex-1 min-h-[150px] overflow-y-auto`}
              onContextMenu={(e) => handleDayContextMenu(e, dayDate)}
            >
                <div className="flex justify-between items-center mb-1">
                     <span className={`text-sm font-semibold cursor-pointer hover:underline ${isToday ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`} onClick={() => handleDayCellClick(dayDate)} role="button">
                        {daysOfWeek[dayDate.getDay()]} {dayDate.getDate()}
                    </span>
                </div>
                <div className="space-y-1">
                    {itemsOnDay.slice(0, maxVisibleItems).map(item => {
                        const bgColor = item.type === 'meeting' ? 'bg-primary-500 dark:bg-primary-600' : 'bg-green-500 dark:bg-green-600';
                        const organizerName = item.type === 'meeting' ? getMeetingCategoryName(item.meetingCategoryId) : getDisplayOrganizerNameForEvent(item as EventAgendaItem);
                        const title = `${item.subject} (${organizerName}) a las ${item.startTime || 'N/A'}`;
                        return (
                            <div key={item.id} className={`text-xs p-1 rounded ${bgColor} text-white truncate cursor-pointer hover:opacity-80`} title={title} onClick={() => handleOpenDayDetailsModal(dayDate)}>
                                <p className="font-semibold truncate leading-tight">{item.type === 'meeting' ? 'R:' : 'E:'} {organizerName}</p>
                                <p className="text-xxs truncate leading-tight">{item.startTime || 'N/A'}: {item.subject}</p>
                            </div>
                        );
                    })}
                    {itemsOnDay.length > maxVisibleItems && (
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium mt-0.5 block cursor-pointer hover:underline" onClick={() => handleOpenDayDetailsModal(dayDate)}>
                            +{itemsOnDay.length - maxVisibleItems} más
                        </span>
                    )}
                     {itemsOnDay.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin actividades</p>}
                </div>
            </div>
        );
    }
    return <div className="flex flex-col md:flex-row gap-px bg-gray-200 dark:bg-gray-700 border dark:border-gray-700">{weekDays}</div>;
  };

  const renderDayLayout = () => {
    const dateKey = formatDateToYYYYMMDD(currentDate);
    const itemsOnDay = agendaItemsByDate.get(dateKey) || [];

    if (itemsOnDay.length === 0) {
        return <div className="text-center py-10 text-gray-500 dark:text-gray-400">No hay reuniones ni eventos programados para este día.</div>;
    }

    return (
        <div className="space-y-4 p-1 md:p-4 max-h-[70vh] overflow-y-auto">
            {itemsOnDay.map(item => {
                const ItemIcon = item.type === 'meeting' ? ScheduleIcon : EventsIcon;
                const itemTypeLabel = item.type === 'meeting' ? 'Reunión' : 'Evento';
                const titleColor = item.type === 'meeting' ? 'text-primary-700 dark:text-primary-400' : 'text-green-700 dark:text-green-400';
                
                const organizerLabel = item.type === 'meeting' ? 'Categoría de Reunión' : 'Organizador';
                const organizerNameDisplay = item.type === 'meeting' 
                    ? getMeetingCategoryName((item as MeetingAgendaItem).meetingCategoryId) 
                    : getDisplayOrganizerNameForEvent(item as EventAgendaItem);
                
                const attendeesForThisItem = item.type === 'meeting' 
                    ? meetingAttendees.filter(ma => ma.meeting_id === item.id)
                    : eventAttendees.filter(ea => ea.event_id === item.id);
                const inPersonNames = attendeesForThisItem.filter(a => a.attendance_type === 'in_person').map(a => getParticipantName(a.participant_id)).join(', ');
                const onlineNames = attendeesForThisItem.filter(a => a.attendance_type === 'online').map(a => getParticipantName(a.participant_id)).join(', ');

                const editHandler = () => { if (item.type === 'meeting') onEditMeeting(item.originalMeeting); else onEditEvent(item.originalEvent); };

                 const eventDetailsForCalendar = {
                    title: item.subject,
                    startDate: item.date,
                    startTime: item.startTime!,
                    endTime: item.endTime,
                    description: `Organizador: ${organizerNameDisplay}\n\n${item.description || ''}`,
                    location: item.location || '',
                };

                return (
                <Card key={item.id} className="bg-white dark:bg-gray-700/80 hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-2"><ItemIcon className={`w-5 h-5 mr-2 ${item.type === 'meeting' ? 'text-primary-500' : 'text-green-500'}`} /><h3 className={`text-lg font-semibold ${titleColor}`}>{`${item.subject} (${itemTypeLabel})`}</h3></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Hora: {item.startTime || 'N/A'} {item.endTime ? `- ${item.endTime}` : '(Hora de fin no definida)'}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300"><strong>{organizerLabel}:</strong> {organizerNameDisplay}</p>
                  {item.location && <p className="text-sm text-gray-600 dark:text-gray-300">Lugar: {item.location}</p>}
                  
                  {(inPersonNames || onlineNames) && (
                    <div className="mt-2 pt-2 border-t dark:border-gray-600">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Participantes Registrados</h4>
                      {inPersonNames && <p className="text-xs text-gray-600 dark:text-gray-300">Presencial: {inPersonNames}</p>}
                      {onlineNames && <p className="text-xs text-gray-600 dark:text-gray-300">En línea: {onlineNames}</p>}
                    </div>
                  )}
                  {item.type === 'meeting' && typeof item.externalParticipantsCount === 'number' && item.externalParticipantsCount > 0 && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Externos: {item.externalParticipantsCount}</p>}
                  {item.type === 'event' && typeof (item as EventAgendaItem).externalParticipantsCount === 'number' && (item as EventAgendaItem).externalParticipantsCount! > 0 && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Externos: {(item as EventAgendaItem).externalParticipantsCount}</p>}

                  {item.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{`"${item.description}"`}</p>}

                  {item.type === 'event' && (typeof (item as EventAgendaItem).cost === 'number' || typeof (item as EventAgendaItem).investment === 'number' || typeof (item as EventAgendaItem).revenue === 'number') && (
                    <div className="mt-2 pt-2 border-t dark:border-gray-600">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Detalles Financieros</h4>
                        {typeof (item as EventAgendaItem).cost === 'number' && <p className="text-xs text-gray-600 dark:text-gray-300">Costo: $ {(item as EventAgendaItem).cost!.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                        {typeof (item as EventAgendaItem).investment === 'number' && <p className="text-xs text-gray-600 dark:text-gray-300">Inversión: $ {(item as EventAgendaItem).investment!.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                        {typeof (item as EventAgendaItem).revenue === 'number' && <p className="text-xs text-gray-600 dark:text-gray-300">Ingresos: $ {(item as EventAgendaItem).revenue!.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                    </div>
                  )}
                  {item.startTime && <AddToGoogleCalendar eventDetails={eventDetailsForCalendar} />}
                  <div className="mt-3 flex justify-end"><Button onClick={editHandler} variant="ghost" size="sm" aria-label={`Editar ${itemTypeLabel.toLowerCase()}: ${item.subject}`}><EditIcon className="w-4 h-4 mr-1"/> Ver/Editar</Button></div>
                </Card>
              );
            })}
        </div>
    );
  };
  
  const meetingCategoryOptionsForFilter = [{ value: '', label: 'Todas las Categorías de Reunión' }, ...meetingCategories.map(c => ({ value: c.id, label: c.name }))];
  const viewModeOptions: { label: string; value: CalendarViewMode }[] = [{ label: 'Año', value: 'year' },{ label: 'Mes', value: 'month' },{ label: 'Semana', value: 'week' },{ label: 'Día', value: 'day' }];

  const QuickAddForm = () => {
    const [formData, setFormData] = useState({
        subject: '',
        date: quickAdd ? formatDateToYYYYMMDD(quickAdd.date) : '',
        startTime: '',
        organizerType: 'meeting_category',
        organizerId: ''
    });

    if (!quickAdd) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.subject || !formData.startTime || !formData.organizerId) {
            alert('Por favor, complete todos los campos.');
            return;
        }

        if (quickAdd.type === 'meeting') {
            const newMeeting: Omit<Meeting, 'id'> = {
                subject: formData.subject,
                meetingCategoryId: formData.organizerId,
                date: formData.date,
                startTime: formData.startTime,
            };
            onQuickAddMeeting(newMeeting);
        } else { // event
            const newEvent: Omit<Event, 'id'> = {
                subject: formData.subject,
                organizerType: formData.organizerType as 'meeting_category' | 'category',
                date: formData.date,
                startTime: formData.startTime,
            };
            onQuickAddEvent(newEvent, formData.organizerId);
        }
        setQuickAdd(null);
    };
    
    const organizerLabel = quickAdd.type === 'event' ? (formData.organizerType === 'meeting_category' ? 'Categoría de Reunión' : 'Categoría de Evento') : 'Categoría de Reunión';
    const organizerOptions = quickAdd.type === 'event' 
        ? (formData.organizerType === 'meeting_category' ? meetingCategories : eventCategories)
        : meetingCategories;

    return (
        <div
            ref={quickAddFormRef}
            className="absolute z-20 bg-white dark:bg-gray-800 shadow-2xl rounded-lg p-4 w-72 border dark:border-gray-600"
            style={{ top: quickAdd.y, left: quickAdd.x }}
        >
            <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">
                Añadir {quickAdd.type === 'meeting' ? 'Reunión' : 'Evento'} Rápido
            </h4>
            <form onSubmit={handleSubmit} className="space-y-3">
                <Input label="Asunto" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} required autoFocus />
                <Input label="Fecha" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required className="dark:[color-scheme:dark]" />
                <Input label="Hora de Inicio" type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} required className="dark:[color-scheme:dark]" />
                
                {quickAdd.type === 'event' && (
                    <Select
                        label="Tipo de Organizador"
                        value={formData.organizerType}
                        onChange={e => setFormData({ ...formData, organizerType: e.target.value, organizerId: '' })}
                        options={[{value: 'meeting_category', label: 'Categoría de Reunión'}, {value: 'category', label: 'Categoría de Evento'}]}
                    />
                )}

                <Select
                    label={organizerLabel}
                    value={formData.organizerId}
                    onChange={e => setFormData({ ...formData, organizerId: e.target.value })}
                    options={[{value: '', label: 'Seleccione...'}, ...organizerOptions.map(o => ({ value: o.id, label: o.name }))]}
                    required
                />
                <div className="flex justify-end space-x-2 pt-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setQuickAdd(null)}>Cancelar</Button>
                    <Button type="submit" variant="primary" size="sm">Guardar</Button>
                </div>
            </form>
        </div>
    );
};


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Agenda General</h1>
        {onNavigateBack && (<Button onClick={onNavigateBack} variant="secondary" size="sm">Volver al Menú</Button>)}
      </div>
      
       <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-3 bg-white dark:bg-gray-800/50 rounded-lg shadow-md mb-4">
          {/* Left group: Navigation */}
          <div className="flex items-center gap-2">
              <Button onClick={() => handleNavigation('today')} variant="primary" size="md" className="!px-5 !py-2.5 font-bold shadow-lg" aria-label="Ir a hoy">Hoy</Button>
              <Button onClick={() => handleNavigation('prev')} variant="secondary" size="md" className="!p-2.5" aria-label="Anterior">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </Button>
              <Button onClick={() => handleNavigation('next')} variant="secondary" size="md" className="!p-2.5" aria-label="Siguiente">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </Button>
              <Button onClick={() => setIsSubscriptionModalOpen(true)} variant="secondary" size="md" className="!p-2.5" aria-label="Suscribirse al calendario">
                  <SubscribeIcon className="h-5 w-5" />
              </Button>
          </div>

          {/* Center group: Title */}
          <div className="flex-grow flex justify-center order-first md:order-none">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">{getCalendarTitle()}</h2>
          </div>

          {/* Right group: Toggles & Filter */}
          <div className="flex items-center gap-4">
              <div className="hidden lg:block w-56">
                  <Select aria-label="Filtrar por Categoría de Reunión" options={meetingCategoryOptionsForFilter} value={filterMeetingCategoryId} onChange={(e) => setFilterMeetingCategoryId(e.target.value)} className="w-full" />
              </div>
              <div className="bg-gray-200 dark:bg-gray-700 p-1 rounded-lg flex items-center space-x-1">
                  {viewModeOptions.map(opt => (
                      <Button 
                      key={opt.value} 
                      onClick={() => setCalendarViewMode(opt.value)} 
                      variant={calendarViewMode === opt.value ? 'primary' : 'ghost'} 
                      size="sm"
                      className="!px-3 !py-1"
                      >
                      {opt.label}
                      </Button>
                  ))}
              </div>
          </div>
      </div>
      
      <div className="block lg:hidden">
            <Select aria-label="Filtrar por Categoría de Reunión" options={meetingCategoryOptionsForFilter} value={filterMeetingCategoryId} onChange={(e) => setFilterMeetingCategoryId(e.target.value)} className="w-full" />
      </div>


      <Card className="overflow-hidden dark:bg-gray-800 p-0">
        {calendarViewMode === 'month' && (<div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border-l border-r border-b border-gray-200 dark:border-gray-700"><div className="grid grid-cols-7 col-span-7">{daysOfWeek.map(day => (<div key={day} className="p-2 text-center font-medium text-xs sm:text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700">{day}</div>))}</div>{renderMonthGrid()}</div>)}
        {calendarViewMode === 'year' && renderYearGrid()}
        {calendarViewMode === 'week' && renderWeekGrid()}
        {calendarViewMode === 'day' && renderDayLayout()}
      </Card>
      
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute z-10 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-600 py-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={(e) => {
              e.preventDefault();
              setQuickAdd({ type: 'meeting', date: contextMenu.date, x: contextMenu.x + 10, y: contextMenu.y + 10 });
              setContextMenu(null);
            }}>
            Añadir Reunión
          </a>
          <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={(e) => {
              e.preventDefault();
              setQuickAdd({ type: 'event', date: contextMenu.date, x: contextMenu.x + 10, y: contextMenu.y + 10 });
              setContextMenu(null);
            }}>
            Añadir Evento
          </a>
        </div>
      )}
      
      <QuickAddForm />


      {selectedDayDetailsForModal && isDayModalOpen && (
        <Modal isOpen={isDayModalOpen} onClose={() => setIsDayModalOpen(false)} title={`Detalles para ${selectedDayDetailsForModal.date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}>
          {selectedDayDetailsForModal.items.length === 0 ? ( <p className="text-center text-gray-500 dark:text-gray-400">No hay reuniones ni eventos programados para este día.</p> ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {selectedDayDetailsForModal.items.map(item => {
                const ItemIcon = item.type === 'meeting' ? ScheduleIcon : EventsIcon;
                const itemTypeLabel = item.type === 'meeting' ? 'Reunión' : 'Evento';
                const titleColor = item.type === 'meeting' ? 'text-primary-700 dark:text-primary-400' : 'text-green-700 dark:text-green-400';
                
                const organizerLabel = item.type === 'meeting' ? 'Categoría de Reunión' : 'Organizador';
                const organizerNameDisplay = item.type === 'meeting' 
                    ? getMeetingCategoryName((item as MeetingAgendaItem).meetingCategoryId) 
                    : getDisplayOrganizerNameForEvent(item as EventAgendaItem);
                
                const attendeesForThisItem = item.type === 'meeting' 
                    ? meetingAttendees.filter(ma => ma.meeting_id === item.id)
                    : eventAttendees.filter(ea => ea.event_id === item.id);
                const inPersonNames = attendeesForThisItem.filter(a => a.attendance_type === 'in_person').map(a => getParticipantName(a.participant_id)).join(', ');
                const onlineNames = attendeesForThisItem.filter(a => a.attendance_type === 'online').map(a => getParticipantName(a.participant_id)).join(', ');

                const editHandler = () => { if (item.type === 'meeting') onEditMeeting(item.originalMeeting); else onEditEvent(item.originalEvent); setIsDayModalOpen(false); };
                
                 const eventDetailsForCalendar = {
                    title: item.subject,
                    startDate: item.date,
                    startTime: item.startTime!,
                    endTime: item.endTime,
                    description: `Organizador: ${organizerNameDisplay}\n\n${item.description || ''}`,
                    location: item.location || '',
                };


                return (
                <Card key={item.id} className="bg-gray-50 dark:bg-gray-700 hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-2"><ItemIcon className={`w-5 h-5 mr-2 ${item.type === 'meeting' ? 'text-primary-500' : 'text-green-500'}`} /><h3 className={`text-lg font-semibold ${titleColor}`}>{`${item.subject} (${itemTypeLabel})`}</h3></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Hora: {item.startTime || 'N/A'} {item.endTime ? `- ${item.endTime}`: '(Hora de fin no definida)'}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300"><strong>{organizerLabel}:</strong> {organizerNameDisplay}</p>
                  {item.location && <p className="text-sm text-gray-600 dark:text-gray-300">Lugar: {item.location}</p>}
                  
                  {(inPersonNames || onlineNames) && (
                    <div className="mt-2 pt-2 border-t dark:border-gray-600">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Participantes Registrados</h4>
                      {inPersonNames && <p className="text-xs text-gray-600 dark:text-gray-300">Presencial: {inPersonNames}</p>}
                      {onlineNames && <p className="text-xs text-gray-600 dark:text-gray-300">En línea: {onlineNames}</p>}
                    </div>
                  )}
                  {item.type === 'meeting' && typeof item.externalParticipantsCount === 'number' && item.externalParticipantsCount > 0 && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Externos: {item.externalParticipantsCount}</p>}
                  {item.type === 'event' && typeof (item as EventAgendaItem).externalParticipantsCount === 'number' && (item as EventAgendaItem).externalParticipantsCount! > 0 && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Externos: {(item as EventAgendaItem).externalParticipantsCount}</p>}

                  {item.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{`"${item.description}"`}</p>}

                  {item.type === 'event' && (typeof (item as EventAgendaItem).cost === 'number' || typeof (item as EventAgendaItem).investment === 'number' || typeof (item as EventAgendaItem).revenue === 'number') && (
                    <div className="mt-2 pt-2 border-t dark:border-gray-600">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Detalles Financieros</h4>
                        {typeof (item as EventAgendaItem).cost === 'number' && <p className="text-xs text-gray-600 dark:text-gray-300">Costo: $ {(item as EventAgendaItem).cost!.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                        {typeof (item as EventAgendaItem).investment === 'number' && <p className="text-xs text-gray-600 dark:text-gray-300">Inversión: $ {(item as EventAgendaItem).investment!.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                        {typeof (item as EventAgendaItem).revenue === 'number' && <p className="text-xs text-gray-600 dark:text-gray-300">Ingresos: $ {(item as EventAgendaItem).revenue!.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
                    </div>
                  )}
                  {item.startTime && <AddToGoogleCalendar eventDetails={eventDetailsForCalendar} />}
                  <div className="mt-3 flex justify-end"><Button onClick={editHandler} variant="ghost" size="sm" aria-label={`Editar ${itemTypeLabel.toLowerCase()}: ${item.subject}`}><EditIcon className="w-4 h-4 mr-1"/> Ver/Editar</Button></div>
                </Card>
              );
            })}
            </div>
          )}
        </Modal>
      )}

      <Modal isOpen={isSubscriptionModalOpen} onClose={() => setIsSubscriptionModalOpen(false)} title="Suscribirse al Calendario">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Para ver todas las reuniones y eventos en tu aplicación de calendario preferida (Google Calendar, Outlook, Apple Calendar), puedes suscribirte a la URL de la agenda. Los eventos se actualizarán automáticamente.
          </p>
          
          <div>
            <label htmlFor="calendar-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL de la Agenda (iCal)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="calendar-url"
                type="text"
                value={CALENDAR_FEED_URL}
                readOnly
                className="bg-gray-100 dark:bg-gray-700"
                onFocus={(e) => e.target.select()}
                aria-label="URL de la agenda para suscripción"
              />
              <Button onClick={handleCopyUrl} variant="secondary" size="sm" className="w-28 flex-shrink-0 flex items-center justify-center gap-1.5" aria-live="polite">
                {isCopied ? <CheckIcon className="w-5 h-5 text-green-500"/> : <CopyIcon className="w-5 h-5"/>}
                {isCopied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t dark:border-gray-600">
            <h4 className="text-base font-semibold mb-3">Añadir con un clic:</h4>
            <div className="flex flex-col sm:flex-row gap-3">
                <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(CALENDAR_FEED_URL)}`} target="_blank" rel="noopener noreferrer" className="w-full block">
                    <Button variant="primary" size="md" className="w-full">
                        <GoogleCalendarIcon className="w-5 h-5 mr-2" /> Google Calendar
                    </Button>
                </a>
                <a href={`webcal://${CALENDAR_FEED_URL.replace(/^https?:\/\//, '')}`} className="w-full block">
                     <Button variant="primary" size="md" className="w-full">
                        <ExternalLinkIcon className="w-5 h-5 mr-2" /> Outlook / Apple
                    </Button>
                </a>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AgendaView;