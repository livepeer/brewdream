import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DAYDREAM_API_KEY = Deno.env.get('DAYDREAM_API_KEY');
    if (!DAYDREAM_API_KEY) {
      throw new Error('DAYDREAM_API_KEY is not configured');
    }

    const { streamId, ...promptParams } = await req.json();
    console.log('Sending prompt to stream:', streamId, promptParams);

    // Send prompt to Daydream stream
    const response = await fetch(`https://api.daydream.live/beta/streams/${streamId}/prompts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAYDREAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(promptParams),
    });

    const data = await response.json();
    console.log('Daydream prompt response:', data);

    if (!response.ok) {
      console.error('Daydream API error:', data);
      return new Response(JSON.stringify({ error: data }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in daydream-prompt function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
