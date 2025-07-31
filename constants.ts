// constants.ts

import { MenuItem, ViewKey } from './types';
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
  { // MODIFICADO PARA REFLEJAR EL NUEVO PROPÓSITO
    id: 'companies',
    name: 'Empresas Afiliadas',
    icon: CompaniesIcon,
    viewKey: ViewKey.Companies,
    description: 'Consultar el directorio de empresas que forman parte de nuestro gremio.'
  },
];

// NOTA: Se eliminan las constantes INITIAL_* ya que los datos ahora provendrán de Supabase.
// Mantener estos datos de prueba podría causar conflictos o confusiones durante el desarrollo.
// Si los necesitas para pruebas unitarias o de otro tipo, se recomienda moverlos a un archivo de mocks separado.

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};