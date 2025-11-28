import React, {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useState,
} from 'react';

export interface DaydreamStream {
  id: string;
  output_playback_id: string;
  whip_url: string;
}

export interface StreamDiffusionParams {
  model_id?: string;
  prompt: string;
  negative_prompt?: string;
  num_inference_steps?: number;
  seed?: number;
  t_index_list?: number[];
  controlnets?: Array<{
    enabled?: boolean;
    model_id: string;
    preprocessor: string;
    preprocessor_params?: Record<string, unknown>;
    conditioning_scale: number;
  }>;
  ip_adapter?: {
    enabled?: boolean;
    type?: 'regular' | 'faceid';
    scale?: number;
    weight_type?: string;
    insightface_model_name?: 'buffalo_l';
  };
  ip_adapter_style_image_url?: string;
}

export interface DaydreamClient {
  createStream(pipeline: string, initialParams?: StreamDiffusionParams): Promise<DaydreamStream>;
  updatePrompts(streamId: string, params: StreamDiffusionParams): Promise<void>;
}

// Default stream diffusion parameters
export const DEFAULT_STREAM_DIFFUSION_PARAMS = {
  model_id: 'stabilityai/sdxl-turbo',
  prompt: "psychedelia",
  negative_prompt: 'blurry, low quality, flat, 2d, distorted',
  num_inference_steps: 50,
  seed: 42,
  t_index_list: [6, 12, 18],
  controlnets: [
    {
      enabled: true,
      model_id: 'xinsir/controlnet-depth-sdxl-1.0',
      preprocessor: 'depth_tensorrt',
      preprocessor_params: {},
      conditioning_scale: 0.6,
    },
    {
      enabled: true,
      model_id: 'xinsir/controlnet-canny-sdxl-1.0',
      preprocessor: 'canny',
      preprocessor_params: {},
      conditioning_scale: 0.3,
    },
    {
      enabled: true,
      model_id: 'xinsir/controlnet-tile-sdxl-1.0',
      preprocessor: 'feedback',
      preprocessor_params: {},
      conditioning_scale: 0.2,
    },
  ],
  ip_adapter: {
    enabled: false,
    type: 'regular' as const,
    scale: 0,
    weight_type: 'linear' as const,
    insightface_model_name: 'buffalo_l' as const,
  },
};

// Add retry utility function with 4xx error detection
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    onRetry?: (attempt: number, error: unknown) => void;
  }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (client errors)
      if (error instanceof Error && error.message.includes('4')) {
        const statusMatch = error.message.match(/\b([4]\d{2})\b/);
        if (statusMatch) {
          throw error; // Fail immediately on 4xx
        }
      }
      // Also check if it's a fetch error with status
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status >= 400 && status < 500) {
          throw error; // Fail immediately on 4xx
        }
      }

      if (attempt < options.maxRetries) {
        const delay = options.baseDelayMs * Math.pow(2, attempt);
        options.onRetry?.(attempt + 1, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Enhanced WHIP publish with retry support
async function startWhipPublish(
  whipUrl: string,
  stream: MediaStream,
  options: {
    maxRetries?: number;
    retryDelayBaseMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
    onRetryLimitExceeded?: () => void;
  } = {}
): Promise<{ pc: RTCPeerConnection; playbackUrl: string | null }> {
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayBaseMs = options.retryDelayBaseMs ?? 1000;
  let retryCount = 0;
  let lastRetryTime = 0;
  const RETRY_RESET_SECONDS = 10;

  const attemptConnection = async (): Promise<{ pc: RTCPeerConnection; playbackUrl: string | null }> => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 3,
    });

    // Set up connection state monitoring
    let disconnectedGraceTimeout: ReturnType<typeof setTimeout> | null = null;
    let connectionEstablished = false;

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      options.onConnectionStateChange?.(state);

      switch (state) {
        case 'connected':
          connectionEstablished = true;
          if (disconnectedGraceTimeout) {
            clearTimeout(disconnectedGraceTimeout);
            disconnectedGraceTimeout = null;
          }
          break;
        case 'disconnected':
          connectionEstablished = false;
          if (disconnectedGraceTimeout) {
            clearTimeout(disconnectedGraceTimeout);
            disconnectedGraceTimeout = null;
          }
          try {
            pc.restartIce();
          } catch {
            // ICE restart failed, will retry connection
          }
          // Grace period before considering it a failure
          disconnectedGraceTimeout = setTimeout(() => {
            if (pc.connectionState === 'disconnected') {
              const now = Date.now();
              // Reset retry count if enough time has passed since last retry
              if (now - lastRetryTime > RETRY_RESET_SECONDS * 1000) {
                retryCount = 0;
              }

              if (retryCount < maxRetries) {
                retryCount++;
                lastRetryTime = now;
                const delay = retryDelayBaseMs * Math.pow(2, retryCount - 1);
                options.onRetry?.(retryCount, new Error('Connection disconnected'));
                setTimeout(() => {
                  attemptConnection().catch(() => {
                    if (retryCount >= maxRetries) {
                      options.onRetryLimitExceeded?.();
                    }
                  });
                }, delay);
              } else {
                options.onRetryLimitExceeded?.();
              }
            }
          }, 2000);
          break;
        case 'failed': {
          connectionEstablished = false;
          if (disconnectedGraceTimeout) {
            clearTimeout(disconnectedGraceTimeout);
            disconnectedGraceTimeout = null;
          }

          const now = Date.now();
          // Reset retry count if enough time has passed since last retry
          if (now - lastRetryTime > RETRY_RESET_SECONDS * 1000) {
            retryCount = 0;
          }

          if (retryCount < maxRetries) {
            retryCount++;
            lastRetryTime = now;
            const delay = retryDelayBaseMs * Math.pow(2, retryCount - 1);
            options.onRetry?.(retryCount, new Error('Connection failed'));
            setTimeout(() => {
              attemptConnection().catch(() => {
                if (retryCount >= maxRetries) {
                  options.onRetryLimitExceeded?.();
                }
              });
            }, delay);
          } else {
            options.onRetryLimitExceeded?.();
          }
          break;
        }
        case 'closed':
          connectionEstablished = false;
          if (disconnectedGraceTimeout) {
            clearTimeout(disconnectedGraceTimeout);
            disconnectedGraceTimeout = null;
          }
          break;
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      if (
        (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') &&
        retryCount < maxRetries
      ) {
        try {
          pc.restartIce();
        } catch {
          // ICE restart failed, will retry connection
        }
      }
    };

    // Add all tracks from the stream
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Create offer
    const offer = await pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete (non-trickle ICE) with timeout
    const ICE_TIMEOUT = 2000;

    await Promise.race([
      new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
        }
      }),
      new Promise<void>((resolve) => setTimeout(resolve, ICE_TIMEOUT))
    ]);

    // Send offer to WHIP endpoint
    const offerSdp = pc.localDescription!.sdp!;
    const response = await fetch(whipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body: offerSdp,
    });

    if (!response.ok) {
      // Don't retry on 4xx errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`WHIP publish failed (non-retryable): ${response.status} ${response.statusText}`);
      }
      throw new Error(`WHIP publish failed: ${response.status} ${response.statusText}`);
    }

    // Capture low-latency WebRTC playback URL from response headers
    const playbackUrl = response.headers.get('livepeer-playback-url') || null;

    // Get answer SDP and set it
    const answerSdp = await response.text();
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
    });

    retryCount = 0; // Reset on successful initial connection
    lastRetryTime = 0; // Reset timestamp on success
    return { pc, playbackUrl };
  };

  // Initial attempt with retry wrapper for initial connection failures
  return retryWithBackoff(
    attemptConnection,
    {
      maxRetries,
      baseDelayMs: retryDelayBaseMs,
      onRetry: options.onRetry,
    }
  );
}

export interface StreamInfo {
  streamId: string;
  playbackId: string;
  playbackUrl: string | null;
}

export interface DaydreamCanvasProps {
  client: DaydreamClient;
  className?: string;
  style?: React.CSSProperties;
  canvasRef?: React.Ref<HTMLCanvasElement>; // optional ref to the canvas element

  // Stream diffusion params, defaults to an SDXL turbo model with a depth, canny, and tile controlnet
  params?: StreamDiffusionParams;
  // Pipeline type, defaults to streamdiffusion
  pipeline?: string;
  // Video frame source, defaults to blank if not provided
  videoSource?:
    | {
        type: 'stream';
        stream: MediaStream;
      }
    | {
        type: 'canvas';
        canvas: HTMLCanvasElement;
      }
    | {
        type: 'camera';
        facingMode: 'user' | 'environment';
        mirrorFront?: boolean; // mirror draw for front camera (user mode), default true
      }
    | {
        type: 'blank';
      };
  // Audio source, defaults to silent if not provided
  audioSource?:
    | {
        type: 'stream';
        stream: MediaStream | MediaStreamTrack;
      }
    | {
        type: 'microphone';
        constraints?: MediaTrackConstraints;
      }
    | {
        type: 'silent';
      };
  // Canvas/display
  size?: number; // square target, default 512
  cover?: boolean; // crop-to-fill when copying from non-square source (default true)
  enforceSquare?: boolean; // set canvas to size x size (default true)
  // Lifecycle & behavior
  alwaysOn?: boolean; // keep alive in background on mobile (default false)
  // Events
  onReady?: (info: StreamInfo) => void;
  onError?: (error: unknown) => void;
  onWhipRetry?: (attempt: number, error: unknown) => void;
  onWhipRetryLimitExceeded?: () => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

// Utility: detect mobile-ish environments (for background auto-stop defaults)
const isLikelyMobile = (): boolean => {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return hasTouch || mobileUA;
};

// Compute draw rect for cover/crop
function computeCoverDrawRect(
  srcWidth: number,
  srcHeight: number,
  destSize: number
) {
  const srcAspect = srcWidth / srcHeight;
  const destAspect = 1; // square
  let drawWidth: number;
  let drawHeight: number;
  if (srcAspect > destAspect) {
    // source wider than square -> height matches, crop width
    drawHeight = destSize;
    drawWidth = (srcWidth / srcHeight) * destSize;
  } else {
    // source taller or equal -> width matches, crop height
    drawWidth = destSize;
    drawHeight = (srcHeight / srcWidth) * destSize;
  }
  const dx = (destSize - drawWidth) / 2;
  const dy = (destSize - drawHeight) / 2;
  return { dx, dy, drawWidth, drawHeight };
}

export const DaydreamCanvas: React.FC<DaydreamCanvasProps> = ({
  client,
  params,
  pipeline = 'streamdiffusion',
  videoSource = { type: 'blank' },
  audioSource = { type: 'silent' },
  size = 512,
  cover = true,
  enforceSquare = true,
  className,
  style,
  canvasRef: externalCanvasRef,
  alwaysOn = false,
  onReady,
  onError,
  onWhipRetry,
  onWhipRetryLimitExceeded,
  onConnectionStateChange,
}) => {
    // Derive video source settings for stable dependencies
    const sourceVideoStream = videoSource.type === 'stream' ? videoSource.stream : null;
    const sourceCanvas = videoSource.type === 'canvas' ? videoSource.canvas : null;
    const cameraFacingMode = videoSource.type === 'camera' ? videoSource.facingMode : 'user';
    const mirrorFront = videoSource.type === 'camera' ? (videoSource.mirrorFront ?? true) : true;

    // Derive audio source settings for stable dependencies
    const sourceAudioStream = audioSource.type === 'stream' ? audioSource.stream : null;
    const microphoneConstraints = useMemo(() => {
      return audioSource.type === 'microphone' ? audioSource.constraints : null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(audioSource)]);

    // Derive FPS from video source (try to match source, default to 24)
    const fps = useMemo(() => {
      if (videoSource.type === 'stream' && sourceVideoStream) {
        const videoTrack = sourceVideoStream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        return settings?.frameRate || 24;
      }
      return 24; // Default for camera, canvas sources, and blank frames
    }, [videoSource.type, sourceVideoStream]);

    // Canvas and optional hidden video element for MediaStream sources
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
    const [ownedCameraStream, setOwnedCameraStream] = useState<MediaStream | null>(null);
    const [ownedAudioTrack, setOwnedAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [isStarted, setIsStarted] = useState(false);

    // Publishing state
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const publishStreamRef = useRef<MediaStream | null>(null);
    const currentAudioTrackRef = useRef<MediaStreamTrack | null>(null);
    const builtInMicTrackRef = useRef<MediaStreamTrack | null>(null);
    const silentAudioTrackRef = useRef<MediaStreamTrack | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const streamIdRef = useRef<string | null>(null);
    const playbackIdRef = useRef<string | null>(null);
    const playbackUrlRef = useRef<string | null>(null);
    const readyForParamUpdatesRef = useRef<boolean>(false);

    // Flags for background auto-restart
    const wasRunningRef = useRef<boolean>(false);

    // Params update queue (serial, eventually consistent)
    const latestParamsRef = useRef<StreamDiffusionParams>(params);
    const pendingParamsRef = useRef<StreamDiffusionParams | null>(null);
    const paramsInFlightRef = useRef<boolean>(false);

    // Keep refs in sync with props
    useEffect(() => {
      latestParamsRef.current = params;
      // Enqueue an update attempt (serial; respects init gate and in-flight)
      enqueueParamsUpdate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params]);

    // Ensure canvas size
    useEffect(() => {
      if (canvasRef.current && enforceSquare) {
        if (canvasRef.current.width !== size) canvasRef.current.width = size;
        if (canvasRef.current.height !== size) canvasRef.current.height = size;
      }
    }, [size, enforceSquare]);

    // Create video element once on mount (hidden in DOM for drawImage to work)
    useEffect(() => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      // Must be in DOM for drawImage to work reliably
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      document.body.appendChild(video);

      hiddenVideoRef.current = video;

      return () => {
        if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = null;
          if (hiddenVideoRef.current.parentNode) {
            hiddenVideoRef.current.parentNode.removeChild(hiddenVideoRef.current);
          }
          hiddenVideoRef.current = null;
        }
      };
    }, []);

    // Optionally obtain camera stream internally
    useEffect(() => {
      // Clean up previous camera stream before starting new one
      // This is crucial when switching between front/back cameras
      setOwnedCameraStream(currStream => {
        if (currStream) {
          currStream.getTracks().forEach(t => t.stop());
        }
        return null;
      });

      if (videoSource.type !== 'camera' || !isStarted) {
        return;
      }

      let cancelled = false;
      let localStream: MediaStream | null = null;

      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: cameraFacingMode ?? 'user', width: size, height: size },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          localStream = stream;
          setOwnedCameraStream(stream);
        } catch (e) {
          console.error('[DaydreamCanvas] Failed to get camera:', e);
          onError?.(e);
        }
      })();

      return () => {
        cancelled = true;
        // Clean up in the effect cleanup function
        if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
        }
        // Also clean up the owned stream state
        setOwnedCameraStream(prev => {
          if (prev && prev !== localStream) {
            prev.getTracks().forEach(t => t.stop());
          }
          return null;
        });
      };
    }, [videoSource.type, cameraFacingMode, onError, size, isStarted]);

    // Update video source when stream changes
    useEffect(() => {
      const video = hiddenVideoRef.current;
      if (!video) return;

      // Determine the effective video stream
      let effectiveStream: MediaStream | null = null;
      if (videoSource.type === 'stream') {
        effectiveStream = sourceVideoStream;
      } else if (videoSource.type === 'camera') {
        effectiveStream = ownedCameraStream;
      }
      // canvas and blank types don't need to use the hidden video element

      if (!effectiveStream) {
        video.srcObject = null;
        return;
      }

      video.srcObject = effectiveStream;
      video.play().catch((e) => {
        // Silent fail - autoplay handles this
        console.error('Error playing video source', e);
      });
    }, [videoSource.type, sourceVideoStream, ownedCameraStream]);

    // Function to draw the video source to the canvas

    const draw = useCallback(() => {
      // Draw one frame from the active source, if available
      if (!canvasRef.current) {
        return;
      }
      const ctx = canvasRef.current.getContext('2d', { alpha: false });
      if (!ctx) {
        return;
      }
      const sizePx = enforceSquare ? size : Math.min(size, Math.max(canvasRef.current.width, canvasRef.current.height));

      // Draw black frame (type: 'blank')
      if (videoSource.type === 'blank') {
        // Clear canvas and fill with black
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      // Draw from source canvas (type: 'canvas')
      else if (videoSource.type === 'canvas' && sourceCanvas) {
        const srcW = sourceCanvas.width;
        const srcH = sourceCanvas.height;
        if (srcW <= 0 || srcH <= 0) {
          return;
        }
        // Clear before drawing
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (cover) {
          const { dx, dy, drawWidth, drawHeight } = computeCoverDrawRect(srcW, srcH, sizePx);
          ctx.drawImage(sourceCanvas, dx, dy, drawWidth, drawHeight);
        } else {
          ctx.drawImage(sourceCanvas, 0, 0, sizePx, sizePx);
        }
      }
      // Draw from hidden video element (types: 'stream' or 'camera')
      else if (videoSource.type === 'stream' || videoSource.type === 'camera') {
        if (!hiddenVideoRef.current || hiddenVideoRef.current.readyState < hiddenVideoRef.current.HAVE_CURRENT_DATA) {
          // Video element exists but not ready - skip draw
          return;
        }

        const v = hiddenVideoRef.current;
        const srcW = v.videoWidth;
        const srcH = v.videoHeight;
        if (srcW <= 0 || srcH <= 0) {
          return;
        }

        // Clear before drawing
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Mirror for front camera (user-facing)
        const needMirror = mirrorFront && cameraFacingMode === 'user' && videoSource.type === 'camera';
        if (needMirror) {
          ctx.setTransform(-1, 0, 0, 1, sizePx, 0);
        }

        if (cover) {
          const { dx, dy, drawWidth, drawHeight } = computeCoverDrawRect(srcW, srcH, sizePx);
          ctx.drawImage(v, dx, dy, drawWidth, drawHeight);
        } else {
          // Scale to fit (no distortion)
          ctx.drawImage(v, 0, 0, sizePx, sizePx);
        }

        if (needMirror) {
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        }
      } else {
        onError?.(new Error(`Unknown video source type: ${videoSource.type}`));
        return;
      }
    }, [cameraFacingMode, cover, enforceSquare, mirrorFront, size, videoSource.type, sourceCanvas, onError]);

    // Effect for render-copy loop based on sources
    const rafIdRef = useRef<number | null>(null);
    const lastTickRef = useRef<number>(0);
    useEffect(() => {
      if (!isStarted) return;

      let cancelled = false;
      const intervalMs = 1000 / Math.max(1, fps);
      lastTickRef.current = performance.now();

      const tick = () => {
        if (cancelled) return;

        try {
          const now = performance.now();
          const elapsed = now - lastTickRef.current;

          if (elapsed < intervalMs) {
            return;
          }
          lastTickRef.current = now - (elapsed % intervalMs);
          draw();
        } finally {
          rafIdRef.current = requestAnimationFrame(tick);
        }
      };
      rafIdRef.current = requestAnimationFrame(tick);

      return () => {
        cancelled = true;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }, [isStarted, fps, draw]);

    // Attempt to create a silent audio track
    const createSilentAudioTrack = useCallback((): MediaStreamTrack | null => {
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        gain.gain.value = 0; // silent
        oscillator.connect(gain);
        const dest = audioContext.createMediaStreamDestination();
        gain.connect(dest);
        oscillator.start();
        const track = dest.stream.getAudioTracks()[0] || null;
        return track;
      } catch (e) {
        // Likely blocked by autoplay policy; continue without audio
        return null;
      }
    }, []);

    // Acquire audio track based on audioSource type (setup/teardown)
    useEffect(() => {
      if (!isStarted) {
        // Clean up when stopped
        setOwnedAudioTrack(null);
        return;
      }

      let cancelled = false;
      let ownedTrack: MediaStreamTrack | null = null;

      (async () => {
        if (audioSource.type === 'stream') {
          // External audio stream - extract track but don't own it
          if (sourceAudioStream instanceof MediaStream) {
            const track = sourceAudioStream.getAudioTracks()[0] || null;
            if (!cancelled) setOwnedAudioTrack(track);
          } else if ('kind' in sourceAudioStream && sourceAudioStream.kind === 'audio') {
            if (!cancelled) setOwnedAudioTrack(sourceAudioStream);
          }
        } else if (audioSource.type === 'microphone') {
          // Request microphone - we own this track
          try {
            const constraints: MediaStreamConstraints = {
              audio: microphoneConstraints || { echoCancellation: true, noiseSuppression: true },
              video: false,
            };
            const micStream = await navigator.mediaDevices.getUserMedia(constraints);
            const micTrack = micStream.getAudioTracks()[0];
            if (micTrack && !cancelled) {
              ownedTrack = micTrack;
              builtInMicTrackRef.current = micTrack;
              setOwnedAudioTrack(micTrack);
            }
          } catch (e) {
            onError?.(e);
            if (!cancelled) setOwnedAudioTrack(null);
          }
        } else if (audioSource.type === 'silent') {
          // Silent audio - we own this track
          const silent = createSilentAudioTrack();
          if (silent && !cancelled) {
            ownedTrack = silent;
            silentAudioTrackRef.current = silent;
            setOwnedAudioTrack(silent);
          } else if (!cancelled) {
            setOwnedAudioTrack(null);
          }
        }
      })();

      return () => {
        cancelled = true;
        // Only stop tracks we own (microphone and silent)
        if (ownedTrack) {
          try {
            ownedTrack.stop();
          } catch (e) {
            /* Track may already be stopped */
          }
        }
        setOwnedAudioTrack(null);
      };
    }, [audioSource.type, sourceAudioStream, microphoneConstraints, createSilentAudioTrack, onError, isStarted]);

    // Replace audio track when ownedAudioTrack changes
    useEffect(() => {
      // Only react if streaming has started
      if (!pcRef.current || !publishStreamRef.current || !ownedAudioTrack) return;

      (async () => {
        const publishStream = publishStreamRef.current;
        const pc = pcRef.current;
        if (!publishStream || !pc) return;

        // Remove old audio tracks
        publishStream.getAudioTracks().forEach((t) => publishStream.removeTrack(t));
        // Add new audio track
        publishStream.addTrack(ownedAudioTrack);

        // Replace on RTCPeerConnection
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(ownedAudioTrack);
        }

        currentAudioTrackRef.current = ownedAudioTrack;
      })().catch((e) => {
        console.error('[DaydreamCanvas] Error replacing audio track:', e);
        onError?.(e);
      });
    }, [ownedAudioTrack, onError]);

    // Build the publishing MediaStream (canvas video + audio)
    const buildPublishStream = useCallback(async (): Promise<MediaStream> => {
      if (!canvasRef.current) throw new Error('Canvas not ready');
      // Ensure canvas dimensions
      if (enforceSquare) {
        if (canvasRef.current.width !== size) canvasRef.current.width = size;
        if (canvasRef.current.height !== size) canvasRef.current.height = size;
      }
      const canvasStream = canvasRef.current.captureStream(Math.max(1, fps));

      // Handle audio
      let audioTrack: MediaStreamTrack | null = null;

      // Check for external audio stream
      if (sourceAudioStream) {
        if (sourceAudioStream instanceof MediaStream) {
          audioTrack = sourceAudioStream.getAudioTracks()[0] || null;
        } else if ('kind' in sourceAudioStream) {
          audioTrack = sourceAudioStream.kind === 'audio' ? sourceAudioStream : null;
        }
      }

      // Fall back to built-in microphone
      if (!audioTrack && builtInMicTrackRef.current) {
        audioTrack = builtInMicTrackRef.current;
      }

      // Fall back to silent audio track
      if (!audioTrack) {
        const silent = createSilentAudioTrack();
        if (silent) {
          silentAudioTrackRef.current = silent;
          audioTrack = silent;
        }
      }

      // Combine into a single stream
      const publishStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((t) => publishStream.addTrack(t));
      if (audioTrack) publishStream.addTrack(audioTrack);

      publishStreamRef.current = publishStream;
      currentAudioTrackRef.current = audioTrack;
      return publishStream;
    }, [sourceAudioStream, createSilentAudioTrack, enforceSquare, fps, size]);

    // Serial params update queue
    const sendParamsUpdate = useCallback(async () => {
      if (paramsInFlightRef.current) return;
      if (!readyForParamUpdatesRef.current) return; // gate until init window passes
      const streamId = streamIdRef.current;
      if (!streamId) return;

      const next = pendingParamsRef.current;
      if (!next) return;

      // Clear pending immediately to detect new updates during send
      pendingParamsRef.current = null;
      paramsInFlightRef.current = true;
      // Snapshot latest for eventual consistency; always include required defaults
      const latest = latestParamsRef.current || next;

      try {
        // Param updates with retry logic (3 retries, exponential backoff starting at 1s)
        await retryWithBackoff(
          () => client.updatePrompts(streamId, {
            ...DEFAULT_STREAM_DIFFUSION_PARAMS,
            ...latest,
          }),
          {
            maxRetries: 3,
            baseDelayMs: 1000,
            onRetry: (attempt, error) => {
              console.warn(`[DaydreamCanvas] Params update retry ${attempt}/3:`, error);
            },
          }
        );
      } catch (e) {
        console.error('[DaydreamCanvas] Params update failed after retries:', e);
        onError?.(e);
      } finally {
        paramsInFlightRef.current = false;
        // If new params arrived while in flight, send again
        if (pendingParamsRef.current) {
          // Collapse to latest snapshot for eventual consistency
          pendingParamsRef.current = latestParamsRef.current;
          // Schedule microtask to avoid deep recursion
          queueMicrotask(() => {
            sendParamsUpdate();
          });
        }
      }
    }, [client, onError]);

    const enqueueParamsUpdate = useCallback(() => {
      pendingParamsRef.current = latestParamsRef.current;
      // Try to send if conditions allow
      queueMicrotask(() => sendParamsUpdate());
    }, [sendParamsUpdate]);

    // Start publishing
    const start = useCallback(async () => {
      if (pcRef.current) return; // already running
      try {
        setIsStarted(true);

        // Create stream with initial params FIRST (with retry)
        const initialParams: StreamDiffusionParams = {
          ...DEFAULT_STREAM_DIFFUSION_PARAMS,
          ...(params || {}),
        };

        // Stream creation with retry logic (3 retries, exponential backoff starting at 1s)
        const streamData = await retryWithBackoff(
          () => client.createStream(pipeline, initialParams),
          {
            maxRetries: 3,
            baseDelayMs: 1000,
            onRetry: (attempt, error) => {
              console.warn(`[DaydreamCanvas] Stream creation retry ${attempt}/3:`, error);
            },
          }
        );

        streamIdRef.current = streamData.id;
        playbackIdRef.current = streamData.output_playback_id;

        // WHIP publish with retry logic (2 retries, exponential backoff starting at 1s)
        const publishStream = await buildPublishStream();
        const { pc, playbackUrl } = await startWhipPublish(
          streamData.whip_url,
          publishStream,
          {
            maxRetries: 2,
            retryDelayBaseMs: 1000,
            onRetry: (attempt, error) => {
              console.warn(`[DaydreamCanvas] WHIP connection retry ${attempt}/2:`, error);
              onWhipRetry?.(attempt, error);
            },
            onRetryLimitExceeded: () => {
              console.error('[DaydreamCanvas] WHIP retry limit exceeded');
              onWhipRetryLimitExceeded?.();
              onError?.(new Error('WHIP connection failed after retries'));
            },
            onConnectionStateChange: (state) => {
              onConnectionStateChange?.(state);
            },
          }
        );

        pcRef.current = pc;
        playbackUrlRef.current = playbackUrl;

        // Notify caller once we have both IDs and playback URL
        onReady?.({ streamId: streamData.id, playbackId: streamData.output_playback_id, playbackUrl: playbackUrlRef.current });

        // Open the init window for params updates (3s gate)
        readyForParamUpdatesRef.current = false;
        window.setTimeout(() => {
          readyForParamUpdatesRef.current = true;
          enqueueParamsUpdate();
        }, 3000);
      } catch (e) {
        onError?.(e);
        throw e;
      }
    }, [client, buildPublishStream, enqueueParamsUpdate, onError, onReady, params, pipeline, onWhipRetry, onWhipRetryLimitExceeded, onConnectionStateChange]);

    // Stop publishing and cleanup
    const stop = useCallback(async () => {
      setIsStarted(false);
      readyForParamUpdatesRef.current = false;

      // Close RTCPeerConnection
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch (e) {
          // RTCPeerConnection already closed or error
        }
        pcRef.current = null;
      }

      // Stop publish stream tracks
      if (publishStreamRef.current) {
        publishStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {
            // Track already stopped or error
          }
        });
        publishStreamRef.current = null;
      }

      // Stop internal silent audio
      if (silentAudioTrackRef.current) {
        try {
          silentAudioTrackRef.current.stop();
        } catch (e) {
          // Silent audio track already stopped or error
        }
        silentAudioTrackRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          // Audio context already closed or error
        }
        audioContextRef.current = null;
      }

      // Do not stop external audio tracks; they are owned by the caller
      currentAudioTrackRef.current = null;

      // Clear stream identifiers
      streamIdRef.current = null;
      playbackIdRef.current = null;
      playbackUrlRef.current = null;
    }, []);

    // Background auto-stop/start (mobile default)
    useEffect(() => {
      if (alwaysOn) return; // caller opted out
      const mobile = isLikelyMobile();
      if (!mobile) return;

      const handleVisibility = () => {
        if (document.hidden) {
          if (pcRef.current) {
            wasRunningRef.current = true;
            void stop();
          } else {
            wasRunningRef.current = false;
          }
        } else {
          if (wasRunningRef.current) {
            wasRunningRef.current = false;
            void start();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibility);
      return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [alwaysOn, start, stop]);

    // Auto-start on mount
    // TODO: Allow explicitly starting/stopping if needed.
    useEffect(() => {
      void start();
      return () => {
        void stop();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Merge internal and external refs
    const setCanvasRef = useCallback((element: HTMLCanvasElement | null) => {
      canvasRef.current = element;
      if (externalCanvasRef) {
        if (typeof externalCanvasRef === 'function') {
          externalCanvasRef(element);
        } else {
          (externalCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = element;
        }
      }
    }, [externalCanvasRef]);

  return (
    <canvas
      ref={setCanvasRef}
      className={className}
      style={style}
      width={enforceSquare ? size : undefined}
      height={enforceSquare ? size : undefined}
    />
  );
};

DaydreamCanvas.displayName = 'DaydreamCanvas';
