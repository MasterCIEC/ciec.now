import React from 'react';
import { ViewKey, UserProfile, MenuItem } from '../types';
import { Card } from '../components/ui/Card';
import { GALLERY_MENU_ITEMS, ADMIN_MENU_ITEMS, USER_MENU_ITEMS } from '../constants';
import ThemeToggleButton, { Theme } from '../components/ThemeToggleButton';
import { useAuth } from '../contexts/AuthContext';
import AppLogo from '../components/AppLogo';

interface MainMenuViewProps {
  onNavigate: (viewKey: ViewKey) => void;
  currentTheme: Theme;
  toggleTheme: () => void;
  profile: UserProfile;
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-6">
    <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">{title}</h2>
  </div>
);

const MainMenuView: React.FC<MainMenuViewProps> = ({ onNavigate, currentTheme, toggleTheme, profile }) => {
  const { signOut, can } = useAuth();
  
  const isSuperAdmin = profile?.roles?.name === 'SuperAdmin';
  const isAdmin = isSuperAdmin || profile?.roles?.name === 'Admin';
  
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items.filter(item => {
      switch(item.viewKey) {
        case ViewKey.StatsView:
        case ViewKey.ReportsView:
          return isSuperAdmin;
        case ViewKey.AdminUsersView:
          return isAdmin;
        case ViewKey.ScheduleMeeting:
          return can('read', 'Meeting');
        case ViewKey.ManageEvents:
          return can('read', 'Event');
        case ViewKey.ManageMeetingCategories:
          return can('read', 'Commission');
        case ViewKey.ManageEventCategories:
          return can('read', 'EventCategory');
        case ViewKey.Participants:
          return can('read', 'Participant');
        default:
          return true; // Items like Agenda, Companies, Account are generally accessible
      }
    });
  };

  const accessibleGalleryItems = filterMenuItems(GALLERY_MENU_ITEMS);
  const accessibleAdminItems = filterMenuItems(ADMIN_MENU_ITEMS);
  const accessibleUserItems = filterMenuItems(USER_MENU_ITEMS);
  
  const planningItems = accessibleGalleryItems.filter(item => ['agenda'].includes(item.id));
  const creationItems = accessibleGalleryItems.filter(item => ['schedule', 'events'].includes(item.id));
  const managementItems = accessibleGalleryItems.filter(item => ['meetingCategories', 'eventCategories', 'participants', 'companies'].includes(item.id));
  const analysisItems = accessibleGalleryItems.filter(item => ['stats', 'reports'].includes(item.id));
  
  const renderCard = (item: typeof GALLERY_MENU_ITEMS[0]) => (
      <Card 
        key={item.id} 
        className="group relative bg-white dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-slate-700 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center p-4 sm:p-6"
        onClick={() => onNavigate(item.viewKey)}
        role="button"
        tabIndex={0}
        aria-label={`Navegar a ${item.name}`}
      >
        <item.icon className="w-12 h-12 sm:w-16 sm:h-16 text-primary-700 dark:text-accent mb-4" />
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">{item.name}</h2>
        
        {item.description && (
            <p className="sm:hidden text-xs text-gray-500 dark:text-gray-400 px-2">{item.description}</p>
        )}

        {item.description && (
          <div className="hidden sm:flex absolute inset-0 bg-black/75 dark:bg-black/85 flex-col items-center justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg">
            <p className="text-sm text-white text-center">{item.description}</p>
          </div>
        )}
      </Card>
  );

  return (
    <div className="p-4 sm:p-8 min-h-screen flex flex-col items-center justify-start relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 flex items-center gap-4">
        <ThemeToggleButton currentTheme={currentTheme} toggleTheme={toggleTheme} />
        <button onClick={() => signOut()} className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
          Cerrar Sesión
        </button>
      </div>

      <div className="text-center mb-12 w-full max-w-6xl">
        <AppLogo className="w-48 h-24 mx-auto mb-4" />
        <h1 className="text-4xl sm:text-5xl font-bold text-primary-700 dark:text-accent mb-3">CIEC.Now</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">Bienvenido, {profile.full_name || 'Usuario'}.</p>
      </div>
      
      <div className="w-full max-w-6xl flex flex-col gap-12">
        
        {planningItems.length > 0 && <section>
          <SectionHeader title="Vista y Planificación" />
          <div className="grid grid-cols-1 gap-6">
            {planningItems.map(renderCard)}
          </div>
        </section>}

        {creationItems.length > 0 && <section>
          <SectionHeader title="Creación y Programación" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {creationItems.map(renderCard)}
          </div>
        </section>}

        {managementItems.length > 0 && <section>
          <SectionHeader title="Administración de Datos" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {managementItems.map(renderCard)}
          </div>
        </section>}

        {analysisItems.length > 0 && <section>
          <SectionHeader title="Análisis y Reportes" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {analysisItems.map(renderCard)}
          </div>
        </section>}

        <section>
            <SectionHeader title="Configuración" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {accessibleUserItems.map(renderCard)}
                {accessibleAdminItems.map(renderCard)}
            </div>
        </section>
      </div>
    </div>
  );
};

export default MainMenuView;