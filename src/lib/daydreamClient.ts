import { DaydreamStream, StreamDiffusionParams, DaydreamClient } from '@/components/DaydreamCanvas';

/**
 * Direct Daydream API client that implements the DaydreamClient interface
 * Calls Daydream APIs directly without going through Supabase Edge Functions
 */
export class DaydreamApiClient implements DaydreamClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.daydream.live') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Create a new Daydream stream with the specified pipeline
   * If initialParams provided, they are sent as params to Daydream
   */
  async createStream(pipeline: string, initialParams?: StreamDiffusionParams): Promise<DaydreamStream> {
    console.log('[DAYDREAM] Creating stream with pipeline:', pipeline, 'and initialParams:', JSON.stringify(initialParams, null, 2));
    const response = await fetch(`${this.baseUrl}/v1/streams`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pipeline: pipeline,
        params: initialParams
      }),
    });

    const streamData = await response.json();

    if (!response.ok) {
      console.error('[DAYDREAM] API error:', streamData);
      throw new Error(`Daydream API error: ${response.status} ${response.statusText}`);
    }

    const { id, output_playback_id, whip_url } = streamData;
    return { id, output_playback_id, whip_url };
  }

  /**
   * Update StreamDiffusion prompts for a stream
   * Sends the full params object as required by Daydream API
   */
  async updatePrompts(streamId: string, params: StreamDiffusionParams): Promise<void> {
    console.log('[DAYDREAM] Updating stream', streamId, 'with params:', JSON.stringify(params, null, 2));

    const response = await fetch(`${this.baseUrl}/v1/streams/${streamId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[DAYDREAM] API error:', JSON.stringify(data, null, 2));
      throw new Error(`Daydream API error: ${response.status} ${response.statusText}`);
    }
  }
}
