import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { sessionId } = await req.json();
    console.log('Generating ticket for session:', sessionId);

    // Generate unique code (base36 of timestamp + random)
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Create ticket in database
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        session_id: sessionId,
        code,
      })
      .select()
      .single();

    if (error) throw error;

    // Generate QR code data URL (simple approach - in production use a proper QR library)
    const qrData = `DD-COFFEE-${code}`;
    
    console.log('Ticket created:', ticket);

    return new Response(JSON.stringify({
      id: ticket.id,
      code: ticket.code,
      qrData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in generate-ticket function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
