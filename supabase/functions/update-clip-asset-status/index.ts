// Update clip asset status when processing is complete
// Version: 2025-10-18-v3
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Create client with service role to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const {
      clipId,
      assetReady,
      assetUrl,
    } = await req.json();

    if (!clipId) {
      throw new Error('clipId is required');
    }

    console.log('Updating clip asset status:', { clipId, assetReady, assetUrl });

    // Update clip in database
    const { data: clip, error } = await supabaseClient
      .from('clips')
      .update({
        asset_ready: assetReady ?? false,
        asset_url: assetUrl || null,
      })
      .eq('id', clipId)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Clip updated successfully:', clip);

    return new Response(JSON.stringify(clip), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in update-clip-asset-status function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

