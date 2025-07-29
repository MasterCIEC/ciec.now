import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Event, Meeting } from '../types';
import { CalendarSyncIcon } from '../components/icons/CalendarSyncIcon';
import { SyncCalendarModal } from '../components/SyncCalendarModal';

type CalendarItem = (Event & { type: 'event' }) | (Meeting & { type: 'meeting' });

export const AgendaView: React.FC = () => {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      const { data: events, error: eventsError } = await supabase
        .from('Events')
        .select('*')
        .order('date', { ascending: true });

      const { data: meetings, error: meetingsError } = await supabase
        .from('Meetings')
        .select(`
          *,
          commission:Commissions(name)
        `)
        .order('date', { ascending: true });

      if (eventsError) {
        setError(eventsError.message);
        console.error('Error fetching events:', eventsError);
      } else if (meetingsError) {
        setError(meetingsError.message);
        console.error('Error fetching meetings:', meetingsError);
      } else {
        const combinedItems: CalendarItem[] = [
          ...events.map(e => ({ ...e, type: 'event' as const })),
          ...meetings.map(m => ({ ...m, type: 'meeting' as const }))
        ];
        
        combinedItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setItems(combinedItems);
      }
      setLoading(false);
    };

    fetchItems();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return 'Todo el día';
    // Asumimos que la hora viene en formato HH:mm:ss
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Agenda General</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <CalendarSyncIcon className="w-5 h-5 mr-2" />
          Sincronizar con calendario
        </Button>
      </div>

      {loading && <p className="text-center text-gray-500 dark:text-gray-400">Cargando agenda...</p>}
      {error && <p className="text-center text-red-500">Error: {error}</p>}
      
      {!loading && !error && (
        <div className="space-y-6">
          {items.map((item, index) => (
            <Card key={`${item.type}-${item.id}-${index}`} className="overflow-hidden">
              <div className={`p-5 ${item.type === 'event' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">{item.subject}</h2>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 space-y-2">
                  <p>
                    <span className="font-medium">Fecha:</span> {formatDate(item.date)}
                  </p>
                  <p>
                    <span className="font-medium">Hora:</span> {formatTime(item.start_time)}
                    {item.end_time && ` - ${formatTime(item.end_time)}`}
                  </p>
                  {item.location && (
                    <p>
                      <span className="font-medium">Lugar:</span> {item.location}
                    </p>
                  )}
                  {item.type === 'meeting' && item.commission && (
                     <p>
                       <span className="font-medium">Comisión:</span> {(item.commission as any).name}
                     </p>
                  )}
                  {item.description && (
                    <p className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SyncCalendarModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default AgendaView;
