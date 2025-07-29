import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Asegúrate que la ruta es correcta
import { Modal } from './Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { CloseIcon } from './icons/CloseIcon';

interface SyncCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Pequeño hook para manejar la copia al portapapeles
const useCopyToClipboard = () => {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = async (text: string) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      return true;
    } catch (error) {
      console.warn('Copy failed', error);
      setCopiedText(null);
      return false;
    }
  };

  return { copiedText, copy };
};

export const SyncCalendarModal: React.FC<SyncCalendarModalProps> = ({ isOpen, onClose }) => {
  const [functionUrl, setFunctionUrl] = useState('');
  const { copiedText, copy } = useCopyToClipboard();
  const [buttonText, setButtonText] = useState('Copiar URL');

  useEffect(() => {
    if (isOpen) {
      const projectUrl = supabase.functions.getURL('');
      // Asumimos que la función se llama 'calendar-feed'
      setFunctionUrl(`${projectUrl.origin}functions/v1/calendar-feed`);
      
      // Reseteamos el estado del botón al abrir
      setButtonText('Copiar URL');
      if (copiedText) {
        setCopiedText(null);
      }
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (copiedText) {
      setButtonText('¡Copiado!');
      const timer = setTimeout(() => {
        setButtonText('Copiar URL');
      }, 2000); // El texto vuelve a la normalidad después de 2 segundos
      return () => clearTimeout(timer);
    }
  }, [copiedText]);

  const handleCopy = () => {
    if (functionUrl) {
      copy(functionUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sincronizar con tu Calendario</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
            <CloseIcon />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Copia esta URL y agrégala en tu aplicación de calendario preferida (Google, Outlook, Apple) en la opción "Añadir desde URL" o "Suscribirse".
        </p>
        <div className="flex items-center space-x-2">
          <Input 
            type="text" 
            value={functionUrl} 
            readOnly 
            className="flex-grow bg-gray-100 dark:bg-gray-700"
          />
          <Button onClick={handleCopy} className="whitespace-nowrap">
            {buttonText}
          </Button>
        </div>
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Tu calendario se actualizará automáticamente con los nuevos eventos y reuniones.
        </div>
      </div>
    </Modal>
  );
};