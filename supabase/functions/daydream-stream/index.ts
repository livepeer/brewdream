import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to wait for stream to be ready and update params
async function initializeStreamParams(streamId: string, params: any, apiKey: string, maxRetries = 20) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wait 2 seconds before each attempt to give stream more time to initialize
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`[EDGE] Attempt ${attempt + 1}: Sending params to Daydream:`, JSON.stringify(params, null, 2));
      
      // PATCH /v1/streams/:id is the correct, new API
      // Body format: { params: { ... } }
      const response = await fetch(`https://api.daydream.live/v1/streams/${streamId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ params }),
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('✓ Stream params initialized successfully:', JSON.stringify(data, null, 2));
        return;
      }

      // Check if it's a "not ready" error
      const errorStr = JSON.stringify(data);
      if (errorStr.includes('not ready') || errorStr.includes('Stream not ready')) {
        console.log(`Stream not ready yet (attempt ${attempt + 1}/${maxRetries})`);
        continue; // Retry
      }

      // Other error - log and continue
      console.warn('Could not initialize stream params:', data);
      return;

    } catch (error) {
      console.error('Error initializing stream params:', error);
      return;
    }
  }
  
  console.warn('⚠ Stream params initialization timed out after retries');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[EDGE] daydream-stream function called (version: 2025-10-12-fixed-endpoint)');

  try {
    const DAYDREAM_API_KEY = Deno.env.get('DAYDREAM_API_KEY');
    if (!DAYDREAM_API_KEY) {
      throw new Error('DAYDREAM_API_KEY is not configured');
    }

    const body = await req.json();
    const pipeline_id = body.pipeline_id || 'pip_SDXL-turbo';
    const initialParams = body.initialParams; // Optional initial parameters

    console.log('[EDGE] Creating Daydream stream with pipeline:', pipeline_id);

    // Step 1: Create stream (only accepts pipeline_id)
    const createResponse = await fetch('https://api.daydream.live/v1/streams', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAYDREAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pipeline_id }),
    });

    const streamData = await createResponse.json();
    console.log('Daydream stream created:', streamData);

    if (!createResponse.ok) {
      console.error('Daydream API error:', streamData);
      return new Response(JSON.stringify({ error: streamData }), {
        status: createResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { id, output_playback_id, whip_url } = streamData;

    // Step 2: Initialize params if provided (with retry logic, non-blocking)
    if (initialParams) {
      console.log('[EDGE] Received initialParams for stream', id, ':', JSON.stringify(initialParams, null, 2));
      // Fire and forget - don't block the response
      initializeStreamParams(id, initialParams, DAYDREAM_API_KEY).catch(err => {
        console.error('Background param initialization failed:', err);
      });
    } else {
      console.warn('[EDGE] No initialParams provided - stream will start with defaults');
    }

    // Return immediately with stream info
    return new Response(JSON.stringify({ id, output_playback_id, whip_url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in daydream-stream function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
