// supabase/functions/notify-event-attendees/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.0.0'
import { corsHeaders } from '../_shared/cors.ts'

// Tu URL de Webhook de Make.com
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

    // 1. Obtener detalles del evento actual
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from('Events')
      .select('subject, date, startTime, location, description, flyer_url, organizerType')
      .eq('id', eventId)
      .single()
    if (eventError) throw eventError;
    console.log('Paso 1: Datos del evento obtenidos:', eventData.subject);

    let relevantEventIds: string[] = [];

    // 2. Obtener los IDs de todos los eventos pasados que comparten la misma categoría
    if (eventData.organizerType === 'meeting_category') {
        const { data: categoryLinks } = await supabaseAdmin.from('event_organizing_meeting_categories').select('meeting_category_id').eq('event_id', eventId);
        const commissionIds = categoryLinks?.map(c => c.meeting_category_id) || [];
        if (commissionIds.length > 0) {
            const { data: eventLinks } = await supabaseAdmin.from('event_organizing_meeting_categories').select('event_id').in('meeting_category_id', commissionIds);
            relevantEventIds = eventLinks?.map(e => e.event_id) || [];
        }
    } else {
        const { data: categoryLinks } = await supabaseAdmin.from('event_organizing_categories').select('category_id').eq('event_id', eventId);
        const categoryIds = categoryLinks?.map(c => c.category_id) || [];
        if (categoryIds.length > 0) {
            const { data: eventLinks } = await supabaseAdmin.from('event_organizing_categories').select('event_id').in('category_id', categoryIds);
            relevantEventIds = eventLinks?.map(e => e.event_id) || [];
        }
    }
    console.log(`Paso 2: Se encontraron ${relevantEventIds.length} eventos relacionados.`);

    if (relevantEventIds.length === 0) {
        return new Response(JSON.stringify({ message: 'No hay eventos pasados en esta categoría para encontrar participantes.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        });
    }

    // 3. Obtener los IDs de los participantes de esos eventos
    const { data: attendeeLinks, error: attendeeLinksError } = await supabaseAdmin
      .from('event_attendees')
      .select('participant_id')
      .in('event_id', relevantEventIds);
    if (attendeeLinksError) throw attendeeLinksError;
    
    const uniqueParticipantIds = [...new Set(attendeeLinks.map(a => a.participant_id))];
    console.log(`Paso 3: Se encontraron ${uniqueParticipantIds.length} IDs de participantes únicos.`);

    if (uniqueParticipantIds.length === 0) {
        return new Response(JSON.stringify({ message: 'No se encontraron participantes en eventos pasados.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        });
    }

    // 4. Obtener los detalles (nombre y email) de esos participantes
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('Participants')
      .select('name, email')
      .in('id', uniqueParticipantIds)
      .not('email', 'is', null); // Solo traer participantes que tengan un email
    if (participantsError) throw participantsError;

    const recipientsList = participants;
    console.log(`Paso 4: Se obtuvieron los detalles de ${recipientsList.length} participantes con email.`);

    if (recipientsList.length === 0) {
      return new Response(JSON.stringify({ message: 'No se encontraron participantes interesados con email.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // 5. Preparar y enviar el payload a Make.com
    const payload = {
      event: eventData,
      recipients: recipientsList,
    };

    console.log('Paso 5: Enviando payload a Make.com...');
    const makeResponse = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!makeResponse.ok) {
      const errorBody = await makeResponse.text();
      throw new Error(`Error al enviar datos a Make.com: ${makeResponse.statusText} - ${errorBody}`);
    }
    console.log('Payload enviado a Make.com con éxito.');

    return new Response(JSON.stringify({ message: `Solicitud enviada para ${recipientsList.length} participante(s).` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error) {
    console.error('Error CRÍTICO en la Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
