// supabase/functions/calendar-feed/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Estos son los encabezados CORS. Son VITALES para que cualquier
// navegador o servicio externo (como Google Calendar) pueda acceder a esta URL.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
}

// La función principal que se ejecuta con cada solicitud.
serve(async (req) => {
  // Maneja la solicitud 'preflight' de CORS. Es un chequeo de seguridad que
  // hacen los navegadores antes de la solicitud real.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crea un cliente de Supabase para comunicarnos con la base de datos.
    // Es importante usar las variables de entorno para las claves,
    // NUNCA las escribas directamente en el código.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. OBTENER LOS DATOS
    // Hacemos las consultas a la base de datos para obtener las reuniones y eventos.
    const { data: meetings, error: meetingsError } = await supabaseClient
      .from('Meetings')
      .select('subject, date, start_time, end_time, location, description')

    const { data: events, error: eventsError } = await supabaseClient
      .from('Events')
      .select('subject, date, start_time, end_time, location, description')
      
    if (meetingsError) throw meetingsError
    if (eventsError) throw eventsError

    // 2. FORMATEAR A iCALENDAR (.ics)
    // Esta es la parte central, donde convertimos los datos a texto .ics
    
    // Función para limpiar texto para el formato .ics
    const formatIcsText = (text: string | null): string => {
        if (!text) return '';
        return text.replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    // Función para formatear fechas y horas al formato UTC requerido por .ics
    const formatIcsDateTime = (dateStr: string, timeStr: string | null): string => {
        if (!timeStr) {
            const date = new Date(dateStr + 'T00:00:00');
            return `;VALUE=DATE:${date.toISOString().slice(0, 10).replace(/-/g, '')}`;
        }
        const localDate = new Date(`${dateStr}T${timeStr}`);
        if (isNaN(localDate.getTime())) return '';
        return `:${localDate.toISOString().replace(/-|:|\.\d+/g, '')}Z`;
    };
    
    let icsString = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CIEC.Now//Agenda General//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Agenda CIEC.Now',
      'X-WR-TIMEZONE:America/Caracas', // Puedes ajustar tu zona horaria
      'X-WR-CALDESC:Calendario de eventos y reuniones de CIEC.Now'
    ].join('\r\n');

    const allItems = [...(meetings || []), ...(events || [])];

    allItems.forEach((item, index) => {
      const uid = `${item.date}-${index}@ciec.now`;
      const dtstamp = new Date().toISOString().replace(/-|:|\.\d+/g, '') + 'Z';
      const summary = formatIcsText(item.subject);
      const description = formatIcsText(item.description);
      const location = formatIcsText(item.location);
      
      const dtstart = formatIcsDateTime(item.date, item.start_time);
      
      // Si no hay hora de fin, se asume una duración de 1 hora.
      let dtend = item.end_time ? formatIcsDateTime(item.date, item.end_time) : '';
      if (!dtend && item.start_time) {
        const startDate = new Date(`${item.date}T${item.start_time}`);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hora
        dtend = `:${endDate.toISOString().replace(/-|:|\.\d+/g, '')}Z`;
      }
      if (!item.start_time) { // Evento de todo el día
           const nextDay = new Date(item.date + 'T00:00:00');
           nextDay.setDate(nextDay.getDate() + 1);
           dtend = `;VALUE=DATE:${nextDay.toISOString().slice(0, 10).replace(/-/g, '')}`;
      }

      icsString += '\r\nBEGIN:VEVENT';
      icsString += `\r\nUID:${uid}`;
      icsString += `\r\nDTSTAMP:${dtstamp}`;
      icsString += `\r\nSUMMARY:${summary}`;
      if (description) icsString += `\r\nDESCRIPTION:${description}`;
      if (location) icsString += `\r\nLOCATION:${location}`;
      if (dtstart) icsString += `\r\nDTSTART${dtstart}`;
      if (dtend) icsString += `\r\nDTEND${dtend}`;
      icsString += '\r\nEND:VEVENT';
    });

    icsString += '\r\nEND:VCALENDAR';

    // 3. ENVIAR LA RESPUESTA
    // Devolvemos el texto .ics con los encabezados correctos.
    return new Response(icsString, {
      headers: { ...corsHeaders, 'Content-Type': 'text/calendar; charset=utf-8' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
