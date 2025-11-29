import { DaydreamStream, StreamDiffusionParams, DaydreamClient } from '@/components/DaydreamCanvas';
import { supabase } from '@/integrations/supabase/client';

/**
 * Create a new Daydream stream with the specified pipeline
 * If initialParams provided, the edge function handles parameter initialization with retry logic
 */
const createDaydreamStream = async (pipeline: string, initialParams?: StreamDiffusionParams): Promise<DaydreamStream> => {
  console.log('[DAYDREAM] Creating stream with initialParams:', JSON.stringify(initialParams, null, 2));

  const { data, error } = await supabase.functions.invoke('daydream-stream', {
    body: {
      pipeline,
      initialParams, // Will be sent as params to Daydream
      isStaging: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('staging'),
    }
  });

  if (error) {
    console.error('[DAYDREAM] Error creating stream:', error);
    throw error;
  }
  if (!data) {
    console.error('[DAYDREAM] No stream data returned from edge function');
    throw new Error('No stream data returned');
  }

  console.log('[DAYDREAM] Stream created:', data);
  return data as DaydreamStream;
}

/**
 * Update StreamDiffusion prompts for a stream
 * Sends the full params object as required by Daydream API
 */
const updateDaydreamPrompts = async (
  streamId: string,
  params: StreamDiffusionParams,
  pipeline: string = 'streamdiffusion'
): Promise<void> => {
  console.log('[DAYDREAM] Updating stream', streamId, 'with params:', JSON.stringify(params, null, 2));

  const { data, error } = await supabase.functions.invoke('daydream-prompt', {
    body: {
      streamId,
      pipeline,
      params,
      isStaging: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('staging')
    }
  });

  if (error) {
    console.error('[DAYDREAM] Error updating prompts:', error);
    throw error;
  }
}

export const supabaseDaydreamClient: DaydreamClient = {
  createStream: createDaydreamStream,
  updatePrompts: updateDaydreamPrompts,
};

