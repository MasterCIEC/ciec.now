// supabase/functions/notify-event-attendees/index.ts

// We declare Deno here to satisfy TypeScript in environments that don't resolve remote types for Edge Functions.
// The Supabase Edge Function runtime will provide the actual Deno global.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// IMPORTANTE: Esta es una URL de marcador de posición.
// Deberá ser reemplazada por la URL real del webhook de Make.com en el Paso 4.
const MAKE_WEBHOOK_URL = 'https://hook.us1.make.com/REEMPLAZAR_ESTO'

serve(async (req) => {
  // Manejo de la solicitud pre-vuelo para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. INICIALIZAR EL CLIENTE ADMIN DE SUPABASE
    // Se utiliza la 'service_role_key' para realizar consultas con privilegios de administrador,
    // saltando las políticas de RLS, lo cual es seguro desde el backend.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. RECIBIR Y VALIDAR EL ID DEL EVENTO
    const { eventId } = await req.json()
    if (!eventId) {
      throw new Error('El ID del evento es requerido.')
    }

    // 3. OBTENER DATOS DEL EVENTO Y SUS RELACIONES
    // Se consulta el evento y se traen los IDs de las comisiones y categorías asociadas.
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from('Events')
      .select(`
        subject, date, start_time, location, description, flyer_url,
        organizing_commissions:event_organizing_commissions(commission_id),
        organizing_categories:event_organizing_categories(category_id)
      `)
      .eq('id', eventId)
      .single()

    if (eventError) throw eventError;

    const commissionIds = eventData.organizing_commissions.map(c => c.commission_id)
    const categoryIds = eventData.organizing_categories.map(c => c.category_id)

    // 4. ALGORITMO PARA ENCONTRAR PARTICIPANTES INTERESADOS
    // Se utiliza un Map para garantizar una lista de destinatarios sin duplicados.
    const interestedParticipants = new Map<string, { name: string; email: string }>()

    // A. Buscar asistentes a reuniones de las mismas comisiones
    if (commissionIds.length > 0) {
      const { data: meetingAttendees } = await supabaseAdmin
        .from('meeting_attendees')
        .select('participant:Participants(id, name, email), meeting:Meetings!inner(commission_id)')
        .in('meeting.commission_id', commissionIds)
      
      meetingAttendees?.forEach(att => {
        if (att.participant?.email) {
          interestedParticipants.set(att.participant.id, { name: att.participant.name, email: att.participant.email })
        }
      })
    }

    // B. Buscar asistentes a eventos de las mismas categorías
    if (categoryIds.length > 0) {
      const { data: eventAttendees } = await supabaseAdmin
        .from('event_attendees')
        .select('participant:Participants(id, name, email), event:Events!inner(organizing_categories:event_organizing_categories!inner(category_id))')
        .in('event.organizing_categories.category_id', categoryIds)

      eventAttendees?.forEach(att => {
        if (att.participant?.email) {
          interestedParticipants.set(att.participant.id, { name: att.participant.name, email: att.participant.email })
        }
      })
    }
    
    const recipientsList = Array.from(interestedParticipants.values())

    if (recipientsList.length === 0) {
      return new Response(JSON.stringify({ message: 'No se encontraron participantes interesados.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    // 5. PREPARAR Y ENVIAR EL PAYLOAD A MAKE.COM
    const payload = {
      event: { ...eventData },
      recipients: recipientsList,
    }
    delete payload.event.organizing_commissions; // Limpiar datos innecesarios
    delete payload.event.organizing_categories; // Limpiar datos innecesarios

    const makeResponse = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!makeResponse.ok) {
      throw new Error(`Error en la comunicación con Make.com: ${makeResponse.statusText}`)
    }

    // 6. DEVOLVER RESPUESTA DE ÉXITO
    return new Response(JSON.stringify({ message: `Solicitud enviada para ${recipientsList.length} participante(s).` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (error) {
    // Manejo centralizado de errores
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
