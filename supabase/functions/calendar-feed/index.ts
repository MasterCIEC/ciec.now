// supabase/functions/calendar-feed/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// This declaration helps TypeScript understand the Deno global namespace
// when running in environments that don't have Deno types loaded by default.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Encabezados CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. OBTENER LOS DATOS - INCLUYENDO EL ID PARA UIDs ESTABLES
    const { data: meetings, error: meetingsError } = await supabaseClient
      .from('Meetings')
      .select('id, subject, date, start_time, end_time, location, description')

    const { data: events, error: eventsError } = await supabaseClient
      .from('Events')
      .select('id, subject, date, start_time, end_time, location, description')
      
    if (meetingsError) throw meetingsError
    if (eventsError) throw eventsError

    // 2. FORMATEAR A iCALENDAR (.ics)
    const formatIcsText = (text: string | null): string => {
        if (!text) return '';
        return text.replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    const formatIcsDateTime = (dateStr: string, timeStr: string | null): string => {
        if (!timeStr) {
            const date = new Date(dateStr + 'T00:00:00Z'); // Use Z para UTC
            return `;VALUE=DATE:${date.toISOString().slice(0, 10).replace(/-/g, '')}`;
        }
        // Asume que la hora está en la zona horaria del servidor (o la que se usó para guardar)
        // Y la convierte a UTC para el estándar iCal
        const localDate = new Date(`${dateStr}T${timeStr}`);
        if (isNaN(localDate.getTime())) return '';
        return `:${localDate.toISOString().replace(/-|:|\.\d+/g, '')}`;
    };
    
    let icsString = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CIEC.Now//Supabase Edge Function//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Agenda CIEC.Now',
      'X-WR-TIMEZONE:America/Caracas',
      'X-WR-CALDESC:Calendario de eventos y reuniones de CIEC.Now',
      'X-WR-RELCALID:agenda-ciec-now-calendar-v1',
      'X-PUBLISHED-TTL:PT1H', // Sugiere refrescar cada hora
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H' // Otra propiedad para el refresco
    ].join('\r\n');

    const allItems = [...(meetings || []), ...(events || [])];

    allItems.forEach((item) => {
      // Usar el ID de la base de datos para un UID estable y único
      const uid = `${item.id}@ciec.now`;
      const dtstamp = new Date().toISOString().replace(/-|:|\.\d+/g, '');
      const summary = formatIcsText(item.subject);
      const description = formatIcsText(item.description);
      const location = formatIcsText(item.location);
      
      const dtstart = formatIcsDateTime(item.date, item.start_time);
      
      let dtend = item.end_time ? formatIcsDateTime(item.date, item.end_time) : '';
      
      // Si no hay hora de fin pero sí de inicio, se asume una duración de 1 hora
      if (!dtend && item.start_time) {
        const startDate = new Date(`${item.date}T${item.start_time}`);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hora
        dtend = `:${endDate.toISOString().replace(/-|:|\.\d+/g, '')}`;
      }
      // Si no hay hora de inicio, es un evento de todo el día
      if (!item.start_time) {
          const nextDay = new Date(item.date + 'T00:00:00Z');
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          dtend = `;VALUE=DATE:${nextDay.toISOString().slice(0, 10).replace(/-/g, '')}`;
      }

      icsString += '\r\nBEGIN:VEVENT';
      icsString += `\r\nUID:${uid}`;
      icsString += `\r\nDTSTAMP:${dtstamp}Z`;
      icsString += `\r\nSUMMARY:${summary}`;
      if (description) icsString += `\r\nDESCRIPTION:${description}`;
      if (location) icsString += `\r\nLOCATION:${location}`;
      if (dtstart) icsString += `\r\nDTSTART${dtstart}`;
      if (dtend) icsString += `\r\nDTEND${dtend}`;
      icsString += '\r\nEND:VEVENT';
    });

    icsString += '\r\nEND:VCALENDAR';

    // 3. ENVIAR LA RESPUESTA CON CABECERAS DE CONTROL DE CACHÉ
    return new Response(icsString, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
