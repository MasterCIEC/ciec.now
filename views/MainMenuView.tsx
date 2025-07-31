import React from 'react';
import { ViewKey } from '../types';
import { Card } from '../components/ui/Card';
import { GALLERY_MENU_ITEMS } from '../constants';
import ThemeToggleButton, { Theme } from '../components/ThemeToggleButton';

interface MainMenuViewProps {
  onNavigate: (viewKey: ViewKey) => void;
  currentTheme: Theme;
  toggleTheme: () => void;
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-6">
    <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">{title}</h2>
  </div>
);

const MainMenuView: React.FC<MainMenuViewProps> = ({ onNavigate, currentTheme, toggleTheme }) => {
  const planningItems = GALLERY_MENU_ITEMS.filter(item => ['agenda'].includes(item.id));
  const creationItems = GALLERY_MENU_ITEMS.filter(item => ['schedule', 'events'].includes(item.id));
  const managementItems = GALLERY_MENU_ITEMS.filter(item => ['meetingCategories', 'eventCategories', 'participants', 'companies'].includes(item.id));

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
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <ThemeToggleButton currentTheme={currentTheme} toggleTheme={toggleTheme} />
      </div>

      <div className="text-center mb-12 w-full max-w-6xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-primary-700 dark:text-accent mb-3">CIEC.Now</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">Administración profesional de agendas y actividades de comisiones CIEC.</p>
      </div>
      
      <div className="w-full max-w-6xl flex flex-col gap-12">
        {/* Section 1: Vista y Planificación */}
        <section>
          <SectionHeader title="Vista y Planificación" />
          <div className="grid grid-cols-1 gap-6">
            {planningItems.map(renderCard)}
          </div>
        </section>

        {/* Section 2: Creación y Programación */}
        <section>
          <SectionHeader title="Creación y Programación" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {creationItems.map(renderCard)}
          </div>
        </section>

        {/* Section 3: Administración de Datos */}
        <section>
          <SectionHeader title="Administración de Datos" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {managementItems.map(renderCard)}
          </div>
        </section>
      </div>
    </div>
  );
};

export default MainMenuView;