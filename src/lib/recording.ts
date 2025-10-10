/**
 * Recording utilities for capturing video stream to Livepeer Studio assets
 */

import { supabase } from '@/integrations/supabase/client';

interface RecordingResult {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

interface UploadResult {
  assetId: string;
  playbackId: string;
  downloadUrl?: string;
}

/**
 * Start recording from a video element using MediaRecorder
 */
export class VideoRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private startTime: number | null = null;
  private mimeType: string = '';

  constructor(private videoElement: HTMLVideoElement) {}

  /**
   * Start recording the video stream
   */
  async start(): Promise<void> {
    // Capture stream from video element
    const stream = (this.videoElement as any).captureStream?.();

    if (!stream) {
      throw new Error('captureStream is not supported on this video element');
    }

    // Try different MIME types in order of preference
    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    this.mimeType = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || '';

    if (!this.mimeType) {
      throw new Error('No supported video MIME type found');
    }

    console.log('Recording with MIME type:', this.mimeType);

    // Create MediaRecorder
    this.recorder = new MediaRecorder(stream, { mimeType: this.mimeType });
    this.chunks = [];
    this.startTime = Date.now();

    // Collect data chunks
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    // Start recording with 100ms timeslice for better chunking
    this.recorder.start(100);
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stop(): Promise<RecordingResult> {
    if (!this.recorder || !this.startTime) {
      throw new Error('Recording not started');
    }

    // Stop the recorder and wait for it to finish
    await new Promise<void>((resolve) => {
      this.recorder!.onstop = () => resolve();
      this.recorder!.stop();
    });

    const durationMs = Date.now() - this.startTime;
    const blob = new Blob(this.chunks, { type: this.mimeType || 'video/webm' });

    console.log('Recording stopped:', { durationMs, size: blob.size, type: blob.type });

    return { blob, durationMs, mimeType: this.mimeType };
  }

  /**
   * Check if captureStream is supported
   */
  static isSupported(videoElement: HTMLVideoElement): boolean {
    return typeof (videoElement as any).captureStream === 'function';
  }
}

/**
 * Upload a recorded blob to Livepeer Studio and wait for asset to be ready
 */
export async function uploadToLivepeer(
  blob: Blob,
  filename: string
): Promise<UploadResult> {
  // Step 1: Request upload URL from server
  console.log('Requesting upload URL...');
  const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
    'studio-request-upload',
    { body: {} }
  );

  if (uploadError) throw uploadError;
  if (!uploadData?.uploadUrl || !uploadData?.assetId) {
    throw new Error('Failed to get upload URL');
  }

  console.log('Got upload URL for asset:', uploadData.assetId);

  // Step 2: Upload the blob
  const file = new File([blob], filename, { type: blob.type });

  if (uploadData.tus?.url) {
    // TODO: Implement TUS upload if needed
    console.log('TUS upload available, but using direct PUT for simplicity');
  }

  console.log('Uploading blob...', { size: blob.size, type: blob.type });
  const putResponse = await fetch(uploadData.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error(`Upload failed: ${putResponse.status} ${putResponse.statusText}`);
  }

  console.log('Upload successful, waiting for asset to be ready...');

  // Step 3: Poll for asset readiness
  let attempts = 0;
  const maxAttempts = 60; // 2 minutes max
  let assetData: { status?: string; playbackId?: string; downloadUrl?: string } | null = null;

  while (attempts < maxAttempts) {
    const { data, error } = await supabase.functions.invoke('studio-asset-status', {
      body: { assetId: uploadData.assetId },
    });

    if (error) {
      console.error('Error checking asset status:', error);
      throw error;
    }

    assetData = data as { status?: string; playbackId?: string; downloadUrl?: string };
    const status = data?.status;
    console.log(`Asset status (attempt ${attempts + 1}/${maxAttempts}):`, status);

    if (status === 'ready') {
      console.log('Asset is ready!', assetData);
      break;
    }

    if (status === 'failed' || status === 'error') {
      throw new Error('Asset processing failed');
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (assetData?.status !== 'ready') {
    throw new Error('Asset processing timeout - asset not ready after 2 minutes');
  }

  return {
    assetId: uploadData.assetId,
    playbackId: assetData.playbackId,
    downloadUrl: assetData.downloadUrl,
  };
}

/**
 * Save clip metadata to database
 */
export async function saveClipToDatabase(params: {
  assetId: string;
  playbackId: string;
  downloadUrl?: string;
  durationMs: number;
  sessionId: string;
  prompt?: string;
  textureId?: string | null;
  textureWeight?: number | null;
  tIndexList?: number[] | null;
}): Promise<{ id: string; [key: string]: unknown }> {
  const { data: clip, error } = await supabase.functions.invoke('save-clip', {
    body: {
      assetId: params.assetId,
      playbackId: params.playbackId,
      downloadUrl: params.downloadUrl,
      durationMs: params.durationMs,
      session_id: params.sessionId,
      prompt: params.prompt,
      texture_id: params.textureId,
      texture_weight: params.textureWeight,
      t_index_list: params.tIndexList,
    },
  });

  if (error) throw error;
  return clip;
}
