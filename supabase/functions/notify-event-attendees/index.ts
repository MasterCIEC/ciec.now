// supabase/functions/notify-event-attendees/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.0.0'
import { corsHeaders } from '../_shared/cors.ts'

const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/5xvals5fmiyzm4lsj69qpj128eeioo1o'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { eventId } = await req.json()
    if (!eventId) throw new Error('El ID del evento es requerido.')
    console.log(`Función invocada para el evento: ${eventId}`);

    // 1. Obtener detalles del evento
    // --- CORRECCIÓN: Se cambió 'startTime' a 'start_time' para que coincida con la base de datos ---
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from('Events')
      .select('subject, date, start_time, location, description, flyer_url, organizerType')
      .eq('id', eventId)
      .single()
    if (eventError) throw eventError;
    console.log('Paso 1: Datos del evento obtenidos:', eventData.subject);

    // 2. Obtener la lista de invitados desde la tabla 'event_invitees'
    const { data: invitees, error: inviteesError } = await supabaseAdmin
      .from('event_invitees')
      .select('participant:Participants(id, name, email)')
      .eq('event_id', eventId);

    if (inviteesError) throw inviteesError;

    const recipientsList = invitees
      .map(item => item.participant)
      .filter(p => p && p.email); // Filtrar por si algún participante no tiene email

    console.log(`Paso 2: Se encontraron ${recipientsList.length} invitados con email.`);

    if (recipientsList.length === 0) {
      return new Response(JSON.stringify({ message: 'No se encontraron invitados con email para notificar.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // 3. Enviar los datos a Make.com
    const payload = {
      event: eventData,
      recipients: recipientsList,
    };

    console.log('Paso 3: Enviando payload a Make.com...');
    const makeResponse = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!makeResponse.ok) {
      throw new Error(`Error al enviar datos a Make.com: ${await makeResponse.text()}`);
    }
    console.log('Payload enviado a Make.com con éxito.');

    return new Response(JSON.stringify({ message: `Invitaciones enviadas a la cola para ${recipientsList.length} participante(s).` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Error CRÍTICO en la Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
})
