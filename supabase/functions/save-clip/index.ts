// Version: 2025-10-13-v2
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      assetId,
      playbackId,
      durationMs,
      downloadUrl,
      prompt,
      texture_id,
      texture_weight,
      t_index_list,
      session_id,
      raw_uploaded_file_url,
      asset_ready
    } = await req.json();

    if (!assetId || !playbackId || !session_id) {
      throw new Error('assetId, playbackId, and session_id are required');
    }

    // Generate a default name based on timestamp
    const name = `Clip ${new Date().toLocaleString()}`;

    console.log('Saving clip to database:', { assetId, playbackId, session_id });

    // Insert clip into database
    const { data: clip, error } = await supabaseClient
      .from('clips')
      .insert({
        session_id,
        asset_playback_id: playbackId,
        asset_id: assetId,
        asset_ready: asset_ready || false,
        asset_url: downloadUrl || null,
        prompt: prompt || 'Untitled',
        duration_ms: durationMs || 0,
        texture_id: texture_id || null,
        texture_weight: texture_weight || null,
        t_index_list: t_index_list || null,
        raw_uploaded_file_url: raw_uploaded_file_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Clip saved successfully:', clip);

    return new Response(JSON.stringify(clip), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in save-clip function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
