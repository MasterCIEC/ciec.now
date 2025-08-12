/// <reference types="https://esm.sh/@supabase/functions-js@2.4.1/edge-functions.d.ts" />

// supabase/functions/calendar-feed/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey'
};

const formatIcsText = (text: string | null) => {
  if (!text) return '';
  return text.replace(/,/g, '\\,').replace(/\n/g, '\\n');
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      // Usamos la clave anónima (anon key) ya que le dimos permisos a la vista
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // 1. OBTENER DATOS PRE-FORMATEADOS DE LA VISTA
    const { data: calendarItems, error } = await supabaseClient
      .from('calendar_feed_data')
      .select('*');

    if (error) throw error;

    // 2. CONSTRUIR EL STRING iCALENDAR
    let icsString = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CIEC.Now//Agenda General//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Agenda CIEC.Now',
      'X-WR-CALDESC:Calendario de eventos y reuniones de CIEC.Now'
    ].join('\r\n');

    const dtstamp = new Date().toISOString().replace(/-|:|\.\d+/g, '') + 'Z';

    calendarItems.forEach((item) => {
      const uid = `${item.item_type}-${item.id}@ciec.now`;
      const summary = formatIcsText(item.subject);
      const description = formatIcsText(item.description);
      const location = formatIcsText(item.location);

      icsString += '\r\nBEGIN:VEVENT';
      icsString += `\r\nUID:${uid}`;
      icsString += `\r\nDTSTAMP:${dtstamp}`;
      icsString += `\r\nSUMMARY:${summary}`;
      if (description) icsString += `\r\nDESCRIPTION:${description}`;
      if (location) icsString += `\r\nLOCATION:${location}`;

      if (item.is_all_day) {
        icsString += `\r\nDTSTART;VALUE=DATE:${item.allday_dtstart}`;
        icsString += `\r\nDTEND;VALUE=DATE:${item.allday_dtend}`;
      } else {
        icsString += `\r\nDTSTART:${item.dtstart}`;
        icsString += `\r\nDTEND:${item.dtend}`;
      }

      icsString += '\r\nEND:VEVENT';
    });

    icsString += '\r\nEND:VCALENDAR';

    // 3. ENVIAR LA RESPUESTA
    return new Response(icsString, {
      headers: { ...corsHeaders, 'Content-Type': 'text/calendar; charset=utf-8' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});