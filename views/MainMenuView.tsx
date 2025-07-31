// views/MainMenuView.tsx

import React from 'react';
import { MenuItem, ViewKey } from '../types';
import { GALLERY_MENU_ITEMS } from '../constants';
// Importación corregida para usar la exportación nombrada de Card
import { Card } from '../components/ui/Card';
import ThemeToggleButton, { Theme } from '../components/ThemeToggleButton';
import AppLogoIcon from '../components/icons/AppLogoIcon';

interface MainMenuViewProps {
  onNavigate: (view: ViewKey) => void;
  currentTheme: Theme;
  toggleTheme: () => void;
}

const MainMenuView: React.FC<MainMenuViewProps> = ({ onNavigate, currentTheme, toggleTheme }) => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-gray-800 dark:text-gray-200 p-4 sm:p-6 lg:p-8">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          <AppLogoIcon className="h-12 w-12 text-primary-600 dark:text-primary-400" />
          <div>
            <h1 className="text-3xl font-bold">CIEC NOW</h1>
            <p className="text-gray-500 dark:text-gray-400">Panel de Gestión de Eventos y Reuniones</p>
          </div>
        </div>
        <ThemeToggleButton theme={currentTheme} toggleTheme={toggleTheme} />
      </header>

      <main>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {GALLERY_MENU_ITEMS.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col justify-between p-6 transition-transform transform hover:scale-105 hover:shadow-xl cursor-pointer"
              onClick={() => onNavigate(item.viewKey)}
              role="button"
              tabIndex={0}
              aria-label={`Navegar a ${item.name}`}
            >
              <div>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="bg-primary-100 dark:bg-primary-900/50 p-3 rounded-full">
                    <item.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h2 className="text-xl font-semibold">{item.name}</h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {item.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default MainMenuView;
