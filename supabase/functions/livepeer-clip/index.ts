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

    const { playbackId, durationMs } = await req.json();
    console.log('Creating clip for playbackId:', playbackId, 'duration:', durationMs);

    // Calculate timestamps (approximation for WebRTC)
    const now = Date.now();
    const endTime = now - 2000; // 2s buffer to ensure clip is available
    const startTime = endTime - durationMs;

    // Create clip via Livepeer Studio API
    const response = await fetch('https://livepeer.studio/api/clip', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playbackId,
        startTime,
        endTime,
        name: `Clip ${new Date().toISOString()}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Livepeer API error:', response.status, errorText);
      
      // If timestamp-based clipping fails, try fallback approach
      console.log('Attempting fallback clip creation...');
      const fallbackResponse = await fetch('https://livepeer.studio/api/clip', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playbackId,
          // Use session-based approach if available
          sessionId: playbackId,
          name: `Clip ${new Date().toISOString()}`,
        }),
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Livepeer API error: ${response.status} ${errorText}`);
      }

      const fallbackData = await fallbackResponse.json();
      console.log('Fallback clip created:', fallbackData);
      return new Response(JSON.stringify(fallbackData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('Clip created:', data);

    // Poll for asset readiness
    if (data.asset?.id) {
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const assetResponse = await fetch(`https://livepeer.studio/api/asset/${data.asset.id}`, {
          headers: {
            'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
          },
        });

        const assetData = await assetResponse.json();
        console.log(`Asset status (attempt ${attempts + 1}):`, assetData.status);

        if (assetData.status.phase === 'ready') {
          console.log('Asset ready:', assetData);
          return new Response(JSON.stringify({
            assetId: assetData.id,
            playbackId: assetData.playbackId,
            downloadUrl: assetData.downloadUrl,
            status: 'ready',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (assetData.status.phase === 'failed') {
          throw new Error('Asset processing failed');
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      throw new Error('Asset processing timeout');
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in livepeer-clip function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      hint: 'Clip creation may be unavailable for WebRTC streams. Try again or check Livepeer dashboard.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
