
import { MenuItem, ViewKey, MeetingCategory, Company, Participant, Meeting, Event, EventCategory } from './types';
import ScheduleIcon from './components/icons/ScheduleIcon';
import AgendaIcon from './components/icons/AgendaIcon';
import ParticipantsIcon from './components/icons/ParticipantsIcon';
import CompaniesIcon from './components/icons/CompaniesIcon';
import MeetingCategoriesIcon from './components/icons/CommitteesIcon';
import EventsIcon from './components/icons/EventsIcon'; 
import EventCategoriesIcon from './components/icons/EventCategoriesIcon';

export const GALLERY_MENU_ITEMS: MenuItem[] = [
  {
    id: 'agenda',
    name: 'Agenda General',
    icon: AgendaIcon,
    viewKey: ViewKey.Agenda,
    description: 'Ver y gestionar las próximas reuniones y eventos en formato de calendario.'
  },
  {
    id: 'schedule',
    name: 'Programar Reunión',
    icon: ScheduleIcon,
    viewKey: ViewKey.ScheduleMeeting,
    description: 'Organizar nuevas reuniones para las diferentes categorías y gestionar las existentes.'
  },
  {
    id: 'events',
    name: 'Gestionar Eventos',
    icon: EventsIcon,
    viewKey: ViewKey.ManageEvents,
    description: 'Administrar eventos, ya sean por categoría de reunión o categorías generales, incluyendo detalles financieros.'
  },
  {
    id: 'meetingCategories',
    name: 'Categorías de Reuniones',
    icon: MeetingCategoriesIcon,
    viewKey: ViewKey.ManageMeetingCategories,
    description: 'Administrar las diferentes categorías para las reuniones (ej. Junta Directiva, Comité Operativo).'
  },
  {
    id: 'eventCategories',
    name: 'Categorías de Eventos',
    icon: EventCategoriesIcon,
    viewKey: ViewKey.ManageEventCategories,
    description: 'Administrar categorías para eventos que no pertenecen a una categoría de reunión específica.'
  },
  {
    id: 'participants',
    name: 'Participantes',
    icon: ParticipantsIcon,
    viewKey: ViewKey.Participants,
    description: 'Gestionar la información de los participantes y su asignación a categorías de reuniones.'
  },
  {
    id: 'companies',
    name: 'Gestionar Empresas',
    icon: CompaniesIcon,
    viewKey: ViewKey.Companies,
    description: 'Administrar la información de las empresas asociadas y sus datos de contacto.'
  },
];

export const INITIAL_MEETING_CATEGORIES: MeetingCategory[] = [
  { id: 'board', name: 'Junta Directiva' },
  { id: 'op', name: 'Comité Operativo' },
  { id: 'strategic', name: 'Planificación Estratégica' },
  { id: 'tech', name: 'Tecnología' },
  { id: 'mkt', name: 'Marketing' },
];

export const INITIAL_EVENT_CATEGORIES: EventCategory[] = [ 
  { id: 'conf', name: 'Conferencia' },
  { id: 'taller', name: 'Taller' },
  { id: 'social', name: 'Actividad Social' },
  { id: 'otro', name: 'Otro Tipo de Evento' },
];

export const INITIAL_COMPANIES: Company[] = [
  { id: 'comp1', name: 'Innovatech Solutions', rif: 'J-12345678-1', email: 'contact@innovatech.com', phone: '555-0101', address: '123 Tech Park' },
  { id: 'comp2', name: 'Eco Builders Inc.', rif: 'J-87654321-2', email: 'info@ecobuilders.com', phone: '555-0202', address: '456 Green Avenue' },
  { id: 'comp3', name: 'HealthWell Group', rif: 'J-11223344-3', email: 'support@healthwell.com', phone: '555-0303', address: '789 Wellness Rd' },
];

export const INITIAL_PARTICIPANTS: Participant[] = [
  { id: 'part1', name: 'Alice Johnson', affiliationType: 'company', companyId: 'comp1', role: 'CEO', email: 'alice@innovatech.com', phone: '555-1111' },
  { id: 'part2', name: 'Bob Williams', affiliationType: 'company', companyId: 'comp1', role: 'CTO', email: 'bob@innovatech.com', phone: '555-2222' },
  { id: 'part3', name: 'Carol Davis (Independiente)', affiliationType: 'independent', companyId: null, role: 'Consultora', email: 'carol.davis@example.com', phone: '555-3333' },
  { id: 'part4', name: 'David Brown (Empresa Externa)', affiliationType: 'external', companyId: null, externalCompanyName: 'Soluciones Globales XYZ', role: 'Arquitecto Líder', email: 'david.brown@externalxyz.com', phone: '555-4444' },
  { id: 'part5', name: 'Eve Miller', affiliationType: 'company', companyId: 'comp3', role: 'Directora de RRHH', email: 'eve@healthwell.com', phone: '555-5555' },
];

export const INITIAL_MEETINGS: Meeting[] = [
  {
    id: 'meet1',
    subject: 'Revisión Financiera Q3',
    meetingCategoryId: 'board',
    date: '2025-07-15', 
    startTime: '10:00',
    endTime: '12:00',
    location: 'Sala de Juntas A',
    description: 'Revisión del desempeño financiero del Q3 y perspectivas para el Q4.',
  },
  {
    id: 'meet2',
    subject: 'Nuevos Protocolos de Seguridad',
    meetingCategoryId: 'op',
    date: '2025-07-20', 
    startTime: '14:00',
    endTime: '15:30',
    location: 'En línea',
    externalParticipantsCount: 2,
    description: 'Discusión y plan de implementación para nuevas medidas de seguridad en toda la empresa.'
  },
  {
    id: 'meet3',
    subject: 'Planificación del Roadmap Tecnológico',
    meetingCategoryId: 'tech',
    date: '2025-08-01', 
    startTime: '09:00',
    endTime: '11:00',
    location: 'Centro de Innovación',
    description: 'Planificación estratégica para el roadmap tecnológico de los próximos 12 meses.'
  },
    {
    id: 'meet4',
    subject: 'Taller de Actualización de Políticas de RRHH',
    meetingCategoryId: 'strategic',
    date: '2025-08-05', 
    startTime: '13:00',
    endTime: '16:00',
    location: 'Sala de Conferencias B',
    externalParticipantsCount: 5,
    description: 'Taller para discutir y finalizar actualizaciones de las políticas de RRHH.',
  },
];

export const INITIAL_EVENTS: Event[] = [ 
  {
    id: 'event1',
    subject: 'Conferencia Anual de Tecnología',
    organizerType: 'category',
    date: '2025-09-10', 
    startTime: '09:00',
    endTime: '17:00',
    location: 'Centro de Convenciones Principal, Salón A',
    externalParticipantsCount: 50,
    description: 'Presentación de las últimas tendencias tecnológicas y networking.',
    cost: 5000,
    investment: 2000,
    revenue: 10000,
  },
  {
    id: 'event2',
    subject: 'Lanzamiento de Campaña de Marketing Q4',
    organizerType: 'meeting_category',
    date: '2025-08-20', 
    startTime: '10:00',
    endTime: '11:30',
    location: 'Oficina Central, Sala de Marketing',
    externalParticipantsCount: 3,
    description: 'Presentación final y lanzamiento de la campaña de marketing para el último trimestre.',
    cost: 200,
    investment: 100,
    revenue: 0,
  }
];

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};