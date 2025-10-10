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
    const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_STUDIO_API_KEY');
    if (!LIVEPEER_API_KEY) {
      throw new Error('LIVEPEER_STUDIO_API_KEY is not configured');
    }

    // Create a unique name for the asset
    const name = `Brewdream Clip ${new Date().toISOString()}`;
    
    console.log('Requesting upload URL for:', name);

    // Request upload from Livepeer Studio
    const response = await fetch('https://livepeer.studio/api/asset/request-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Livepeer API error:', response.status, errorText);
      throw new Error(`Livepeer API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Upload URL response:', data);

    // Normalize response structure for client
    const uploadUrl = data?.url || data?.asset?.url;
    const assetId = data?.asset?.id || data?.assetId || data?.id;
    const tus = data?.tus ? { url: data.tus.endpoint } : undefined;

    return new Response(JSON.stringify({ 
      uploadUrl, 
      assetId, 
      tus 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in studio-request-upload function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
