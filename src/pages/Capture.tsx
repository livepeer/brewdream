import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { ArrowLeft, Camera, ImageOff, Loader2, Sparkles, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import * as Player from '@livepeer/react/player';
import { getSrc } from '@livepeer/react/external';
import { createDaydreamStream, startWhipPublish, updateDaydreamPrompts } from '@/lib/daydream';
import type { StreamDiffusionParams } from '@/lib/daydream';
import { VideoRecorder, uploadToLivepeer, saveClipToDatabase } from '@/lib/recording';

const FRONT_PROMPTS = [
  "studio ghibli portrait, soft rim light",
  "cyberpunk neon portrait 90s anime",
  "watercolor ink portrait, loose brush"
];

const BACK_PROMPTS = [
  "vaporwave cityscape",
  "film noir scene, grainy",
  "isometric tech poster, bold shapes"
];

const TEXTURES = [
  {
    id: 'lava',
    url: 'https://t4.ftcdn.net/jpg/01/83/14/47/360_F_183144766_dbGaN37u6a4VCliXQ6wcarerpYmuLAto.jpg',
    name: 'Lava'
  },
  {
    id: 'galaxy_orion',
    url: 'https://science.nasa.gov/wp-content/uploads/2023/04/orion-nebula-xlarge_web-jpg.webp',
    name: 'Galaxy'
  },
  {
    id: 'dragon_scales',
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/roof_tiles/roof_tiles_diff_1k.jpg',
    name: 'Dragon Scales (Roof Tiles, PH 1K)'
  },
  {
    id: 'water_ripples',
    url: 'https://media.gettyimages.com/id/585332126/photo/rock-face.jpg?s=612x612&w=gi&k=20&c=bX6I0qs7hVDXs0ZUaqPUb1uLkLaZm-ASZxVd5TDXW-A=',
    name: 'Water Ripples (TextureLabs)'
  },
  {
    id: 'lightning',
    url: 'https://opengameart.org/sites/default/files/l1.png',
    name: 'Lightning Bolt (OGA PNG)'
  },
  {
    id: 'sand_dunes',
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_sand/aerial_sand_diff_1k.jpg',
    name: 'Sand Dunes (PH 1K)'
  },
  {
    id: 'sand_dunes_2',
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_beach_01/aerial_beach_01_diff_1k.jpg',
    name: 'Beach Ripples (PH 1K)'
  },
  {
    id: 'foam_ocean',
    url: 'https://t3.ftcdn.net/jpg/02/03/50/32/360_F_203503200_3M3ZmpW9nhU6faaF3fewlkIMtRWxlHye.jpg',
    name: 'Ocean Foam (ambientCG 1K)'
  }
];

// Detect if device likely has front/back cameras (mobile/tablet)
const hasMultipleCameras = (): boolean => {
  // Check for touch capability (mobile/tablet indicator)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Check for mobile user agent patterns
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Assume device has multiple cameras if it's touch-enabled or mobile UA
  return hasTouch || mobileUserAgent;
};

/**
 * Create a dummy black canvas stream for pre-loading
 * This allows us to start WHIP negotiation before camera access
 */
const createDummyStream = (): MediaStream => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  
  // Fill with black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Capture stream from canvas
  const stream = canvas.captureStream(24);
  
  // Add silent audio track (some WebRTC implementations require audio)
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const dst = audioContext.createMediaStreamDestination();
  oscillator.connect(dst);
  oscillator.start();
  oscillator.frequency.value = 0; // Silent
  
  stream.addTrack(dst.stream.getAudioTracks()[0]);
  
  return stream;
};

export default function Capture() {
  const [cameraType, setCameraType] = useState<'front' | 'back'>('front');
  const [streamStarted, setStreamStarted] = useState(false); // NEW: Track if user clicked "Start Stream"
  const [loading, setLoading] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [whipUrl, setWhipUrl] = useState<string | null>(null);
  const [backgroundStreamInitialized, setBackgroundStreamInitialized] = useState(false);

  const [defaultPrompt, setDefaultPrompt] = useState(''); // NEW: Store the random default prompt
  const [prompt, setPrompt] = useState('');
  const [selectedTexture, setSelectedTexture] = useState<string | null>(null);
  const [textureWeight, setTextureWeight] = useState([0.5]);
  const [creativity, setCreativity] = useState([5]);
  const [quality, setQuality] = useState([0.4]);

  const [recording, setRecording] = useState(false);
  const [recordStartTime, setRecordStartTime] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [captureSupported, setCaptureSupported] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const recorderRef = useRef<VideoRecorder | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dummyStreamRef = useRef<MediaStream | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Auto-detect camera type on mount
  useEffect(() => {
    const isMultipleCameras = hasMultipleCameras();
    setCameraType(isMultipleCameras ? 'front' : 'front'); // Default to front
    
    // Pick a random default prompt based on camera type
    const prompts = isMultipleCameras ? FRONT_PROMPTS : FRONT_PROMPTS;
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    setDefaultPrompt(randomPrompt);
  }, []);

  // Initialize stream in background on mount
  useEffect(() => {
    if (!backgroundStreamInitialized && defaultPrompt) {
      initializeBackgroundStream();
    }
  }, [defaultPrompt, backgroundStreamInitialized]);

  const initializeBackgroundStream = async () => {
    if (backgroundStreamInitialized) return;
    
    setBackgroundStreamInitialized(true);
    setLoading(true);
    
    try {
      console.log('🚀 Starting background stream initialization...');
      
      // Create Daydream stream
      const streamData = await createDaydreamStream();
      
      setStreamId(streamData.id);
      setPlaybackId(streamData.output_playback_id);
      setWhipUrl(streamData.whip_url);
      
      console.log('✅ Daydream stream created:', streamData.id);
      
      // Start WHIP with dummy black canvas stream
      const dummyStream = createDummyStream();
      dummyStreamRef.current = dummyStream;
      
      const pc = await startWhipPublish(streamData.whip_url, dummyStream);
      pcRef.current = pc;
      
      console.log('✅ WHIP publishing started with dummy stream');
      
      // Save session to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const query = user.is_anonymous
          ? supabase.from('users').select('id').eq('id', user.id)
          : supabase.from('users').select('id').eq('email', user.email);

        const { data: userData } = await query.single();

        if (userData) {
          await supabase.from('sessions').insert({
            user_id: userData.id,
            stream_id: streamData.id,
            playback_id: streamData.output_playback_id,
            camera_type: cameraType,
          });
        }
      }
      
      console.log('✅ Background stream initialization complete!');
    } catch (error: unknown) {
      console.error('Error initializing background stream:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
      setBackgroundStreamInitialized(false); // Allow retry
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mirror a video stream by rendering it through a canvas
   */
  const mirrorStream = (originalStream: MediaStream): MediaStream => {
    const video = document.createElement('video');
    video.srcObject = originalStream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    document.body.appendChild(video);

    video.play().catch(err => console.error('Error playing video for mirroring:', err));

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    const mirror = () => {
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      requestAnimationFrame(mirror);
    };

    mirror();

    const mirroredVideoStream = canvas.captureStream(24);

    originalStream.getAudioTracks().forEach(track => {
      mirroredVideoStream.addTrack(track);
    });

    return mirroredVideoStream;
  };

  /**
   * Replace the dummy stream with the actual camera feed
   */
  const replaceDummyStreamWithCamera = async () => {
    if (!pcRef.current || !whipUrl) {
      throw new Error('WebRTC connection not ready');
    }

    try {
      console.log('🎥 Requesting camera access...');
      
      // Get camera stream
      const originalStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraType === 'front' ? 'user' : 'environment',
          width: 512,
          height: 512,
        },
        audio: true,
      });

      console.log('✅ Camera access granted');

      // Mirror if front camera
      const stream = cameraType === 'front' ? mirrorStream(originalStream) : originalStream;

      // Show in PiP preview
      if (sourceVideoRef.current) {
        sourceVideoRef.current.srcObject = stream;
      }

      // Replace tracks in the existing peer connection
      const pc = pcRef.current;
      const senders = pc.getSenders();
      
      // Replace video track
      const videoTrack = stream.getVideoTracks()[0];
      const videoSender = senders.find(s => s.track?.kind === 'video');
      if (videoSender && videoTrack) {
        await videoSender.replaceTrack(videoTrack);
        console.log('✅ Video track replaced');
      }
      
      // Replace audio track
      const audioTrack = stream.getAudioTracks()[0];
      const audioSender = senders.find(s => s.track?.kind === 'audio');
      if (audioSender && audioTrack) {
        await audioSender.replaceTrack(audioTrack);
        console.log('✅ Audio track replaced');
      }

      // Stop dummy stream
      if (dummyStreamRef.current) {
        dummyStreamRef.current.getTracks().forEach(track => track.stop());
        dummyStreamRef.current = null;
      }

      console.log('✅ Stream replacement complete!');
    } catch (error) {
      console.error('Error replacing stream with camera:', error);
      throw error;
    }
  };

  /**
   * Handle "Start Stream" button click
   */
  const handleStartStream = async () => {
    setLoading(true);
    try {
      // Replace dummy stream with camera
      await replaceDummyStreamWithCamera();
      
      // Mark stream as started
      setStreamStarted(true);
      
      // If user hasn't customized the prompt, use the default
      if (!prompt.trim()) {
        setPrompt(defaultPrompt);
      }
    } catch (error: unknown) {
      console.error('Error starting stream:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePrompt = useCallback(async () => {
    if (!streamId) return;

    try {
      const tIndexList = calculateTIndexList(creativity[0], quality[0]);

      const selectedTextureObj = selectedTexture
        ? TEXTURES.find((t) => t.id === selectedTexture)
        : null;

      const params: StreamDiffusionParams = {
        model_id: 'stabilityai/sdxl-turbo',
        prompt: prompt || defaultPrompt, // Use default if empty
        negative_prompt: 'blurry, low quality, flat, 2d, distorted',
        t_index_list: tIndexList,
        seed: 42,
        num_inference_steps: 50,
      };

      if (selectedTextureObj) {
        params.ip_adapter = {
          enabled: true,
          type: 'regular',
          scale: textureWeight[0],
          weight_type: 'linear',
          insightface_model_name: 'buffalo_l',
        };
        params.ip_adapter_style_image_url = selectedTextureObj.url;

        params.controlnets = [
          {
            enabled: true,
            model_id: 'xinsir/controlnet-depth-sdxl-1.0',
            preprocessor: 'depth_tensorrt',
            preprocessor_params: {},
            conditioning_scale: 0,
          },
          {
            enabled: true,
            model_id: 'xinsir/controlnet-canny-sdxl-1.0',
            preprocessor: 'canny',
            preprocessor_params: {},
            conditioning_scale: 0,
          },
          {
            enabled: true,
            model_id: 'xinsir/controlnet-tile-sdxl-1.0',
            preprocessor: 'feedback',
            preprocessor_params: {},
            conditioning_scale: 0,
          },
        ];
      }

      await updateDaydreamPrompts(streamId, params);

    } catch (error: unknown) {
      console.error('Error updating prompt:', error);
    }
  }, [streamId, prompt, defaultPrompt, creativity, quality, selectedTexture, textureWeight]);

  const calculateTIndexList = (creativityVal: number, qualityVal: number): number[] => {
    let baseIndices: number[];

    if (qualityVal < 0.25) {
      baseIndices = [6];
    } else if (qualityVal < 0.50) {
      baseIndices = [6, 12];
    } else if (qualityVal < 0.75) {
      baseIndices = [6, 12, 18];
    } else {
      baseIndices = [6, 12, 18, 24];
    }

    const scale = 2.62 - 0.132 * creativityVal;
    return baseIndices.map(idx => Math.max(0, Math.min(50, Math.round(idx * scale))));
  };

  const startRecording = async () => {
    if (!isMobile && recording) {
      return;
    }

    const playerVideo = playerContainerRef.current?.querySelector('video') as HTMLVideoElement;

    if (!playerVideo) {
      toast({
        title: 'Error',
        description: 'Video player not ready',
        variant: 'destructive',
      });
      return;
    }

    if (!VideoRecorder.isSupported(playerVideo)) {
      setCaptureSupported(false);
      toast({
        title: 'Recording not supported',
        description: 'Your browser does not support video capture',
        variant: 'destructive',
      });
      return;
    }

    try {
      const recorder = new VideoRecorder(playerVideo);
      await recorder.start();

      recorderRef.current = recorder;
      setRecording(true);
      setRecordStartTime(Date.now());

      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, 10000);

      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start recording',
        variant: 'destructive',
      });
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !recordStartTime || !streamId) return;

    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    const recordingDuration = Date.now() - recordStartTime;

    if (recordingDuration < 3000) {
      setRecording(false);

      try {
        await recorderRef.current.stop();
      } catch (error) {
        console.error('Error stopping recorder:', error);
      }
      recorderRef.current = null;

      toast({
        title: 'Recording too short',
        description: 'Hold for at least 3 seconds to create a clip',
        variant: 'destructive',
      });
      return;
    }

    setRecording(false);
    setLoading(true);

    try {
      const { blob, durationMs } = await recorderRef.current.stop();
      recorderRef.current = null;

      console.log('Recording stopped, uploading to Livepeer...');

      toast({
        title: 'Processing...',
        description: 'Uploading your clip to Livepeer Studio',
      });

      const filename = `daydream-clip-${Date.now()}.webm`;
      const { assetId, playbackId: assetPlaybackId, downloadUrl } = await uploadToLivepeer(blob, filename);

      console.log('Upload complete, saving to database...');

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id')
        .eq('stream_id', streamId)
        .single();

      if (!sessionData) {
        throw new Error('Session not found');
      }

      const clip = await saveClipToDatabase({
        assetId,
        playbackId: assetPlaybackId,
        downloadUrl,
        durationMs,
        sessionId: sessionData.id,
        prompt: prompt || defaultPrompt,
        textureId: selectedTexture,
        textureWeight: selectedTexture ? textureWeight[0] : null,
        tIndexList: calculateTIndexList(creativity[0], quality[0]),
      });

      toast({
        title: 'Clip created!',
        description: 'Redirecting to your clip...',
      });

      navigate(`/clip/${clip.id}`);
    } catch (error: unknown) {
      console.error('Error creating clip:', error);
      toast({
        title: 'Error creating clip',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const src = useMemo(() => {
    if (!playbackId) {
      return null;
    }

    const result = getSrc(playbackId);

    if (result && Array.isArray(result) && result.length > 0) {
      return result;
    }

    const manualSrc = [
      {
        src: `https://livepeer.studio/webrtc/${playbackId}`,
        mime: 'video/h264' as const,
        type: 'webrtc' as const,
      },
      {
        src: `https://livepeer.studio/hls/${playbackId}/index.m3u8`,
        mime: 'application/vnd.apple.mpegurl' as const,
        type: 'hls' as const,
      },
    ] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return manualSrc as any;
  }, [playbackId]);

  useEffect(() => {
    if ((prompt || defaultPrompt) && streamId) {
      const debounce = setTimeout(() => {
        updatePrompt();
      }, 500);
      return () => clearTimeout(debounce);
    }
  }, [prompt, defaultPrompt, selectedTexture, textureWeight, creativity, quality, streamId, updatePrompt]);

  useEffect(() => {
    if (recording && recordStartTime) {
      const interval = setInterval(() => {
        setRecordingTime(Date.now() - recordStartTime);
      }, 100);

      return () => clearInterval(interval);
    } else {
      setRecordingTime(0);
    }
  }, [recording, recordStartTime]);

  useEffect(() => {
    if (playerContainerRef.current) {
      const video = playerContainerRef.current.querySelector('video');
      if (video) {
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleWaiting = () => setIsPlaying(false);

        video.addEventListener('playing', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('waiting', handleWaiting);

        if (!video.paused && video.readyState >= 3) {
          setIsPlaying(true);
        }

        return () => {
          video.removeEventListener('playing', handlePlay);
          video.removeEventListener('pause', handlePause);
          video.removeEventListener('waiting', handleWaiting);
        };
      }
    }
  }, [playbackId, src, streamStarted]);

  // Render params configuration UI (before stream is started)
  if (!streamStarted) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              Configure Your Stream
            </h1>
            <p className="text-neutral-400">
              Set up your AI effects before you start streaming
            </p>
          </div>

          {/* Controls */}
          <div className="bg-neutral-950 rounded-3xl p-6 border border-neutral-800 space-y-4 shadow-inner">
            <div>
              <label className="text-sm font-medium mb-2 block text-neutral-300">Prompt</label>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={defaultPrompt || "Describe your AI effect..."}
                className="bg-neutral-950 border-neutral-800 focus:border-neutral-600 focus:ring-0 text-neutral-100 placeholder:text-neutral-500"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Leave empty to use: "{defaultPrompt}"
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-neutral-300">
                Texture
              </label>

              <div className="flex items-center gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 bg-neutral-950 border-neutral-800 hover:border-neutral-600 hover:bg-neutral-850 !w-16 !h-16 rounded-full overflow-hidden px-0 py-0 w-full sm:w-auto"
                    >
                      {selectedTexture ? (
                        <>
                          <img
                            src={TEXTURES.find((t) => t.id === selectedTexture)?.url}
                            alt="Selected texture"
                            className="w-8 h-8 object-cover rounded"
                          />

                        </>
                        ) : (
                          <ImageOff className="w-5 h-5 text-neutral-400" />
                        )}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    align="start"
                    sideOffset={8}
                    className="w-[90vw] sm:w-80 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl p-4"
                  >
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      <Button
                        onClick={() => setSelectedTexture(null)}
                        variant={selectedTexture === null ? "default" : "outline"}
                        className={`aspect-square ${
                          selectedTexture === null
                            ? "bg-neutral-800 text-neutral-100"
                            : "bg-neutral-950 border-neutral-800 hover:border-neutral-600"
                        }`}
                      >
                        <ImageOff className="w-5 h-5 text-neutral-400" />
                      </Button>
                      {TEXTURES.map((texture) => (
                        <Button
                          key={texture.id}
                          onClick={() => setSelectedTexture(texture.id)}
                          variant={selectedTexture === texture.id ? "default" : "outline"}
                          className={`aspect-square p-0 overflow-hidden ${
                            selectedTexture === texture.id
                              ? "ring-2 ring-neutral-400"
                              : "border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-850"
                          }`}
                        >
                          <img
                            src={texture.url}
                            alt={texture.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {selectedTexture && (
                  <div className="flex-1">
                    <label className="text-sm font-medium block mb-1 text-neutral-300">
                      Strength: {textureWeight[0].toFixed(2)}
                    </label>
                    <Slider
                      value={textureWeight}
                      onValueChange={setTextureWeight}
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-full accent-neutral-400"
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-neutral-300">
                Creativity: {creativity[0].toFixed(1)}
              </label>
              <Slider
                value={creativity}
                onValueChange={setCreativity}
                min={1}
                max={10}
                step={0.1}
                className="w-full accent-neutral-400"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-neutral-300">
                Quality: {quality[0].toFixed(2)}
              </label>
              <Slider
                value={quality}
                onValueChange={setQuality}
                min={0}
                max={1}
                step={0.01}
                className="w-full accent-neutral-400"
              />
            </div>
          </div>

          {/* Start Stream Button */}
          <Button
            onClick={handleStartStream}
            disabled={loading || !backgroundStreamInitialized}
            className="w-full h-16 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-2xl hover:from-primary/90 hover:to-accent/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting camera...
              </span>
            ) : !backgroundStreamInitialized ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Preparing stream...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="w-6 h-6" />
                Start Stream
              </span>
            )}
          </Button>

          {backgroundStreamInitialized && !loading && (
            <p className="text-center text-sm text-neutral-500">
              ✨ Stream ready! Click to start your camera
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render main streaming UI (after stream is started)
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Main Video Output - Animated slide-down */}
        <div 
          className="relative aspect-square bg-neutral-950 rounded-3xl overflow-hidden border border-neutral-900 shadow-lg animate-in slide-in-from-top duration-500"
        >
          {playbackId && src ? (
            <div
              ref={playerContainerRef}
              className="player-container w-full h-full [&_[data-radix-aspect-ratio-wrapper]]:!h-full [&_[data-radix-aspect-ratio-wrapper]]:!pb-0"
              style={{ width: '100%', height: '100%', position: 'relative' }}
            >
              <Player.Root
                src={src}
                autoPlay
                lowLatency="force"
              >
                <Player.Container
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%', position: 'relative' }}
                >
                  <Player.Video
                    className="w-full h-full"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <Player.LoadingIndicator>
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/50">
                      <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                  </Player.LoadingIndicator>
                </Player.Container>
              </Player.Root>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-neutral-400" />
              {playbackId && !src && <p className="text-xs text-neutral-500 mt-2">Loading stream...</p>}
            </div>
          )}

          {/* PiP Source Preview - Animated */}
          <div className="absolute bottom-4 right-4 w-24 h-24 rounded-2xl overflow-hidden border-2 border-white shadow-lg animate-in fade-in zoom-in duration-300 delay-300">
            <video
              ref={sourceVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Record Button */}
        {!captureSupported && (
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-sm text-yellow-200">
            ⚠️ Video capture not supported on this browser. Recording is disabled.
          </div>
        )}
        <Button
          onClick={isMobile ? undefined : toggleRecording}
          onPointerDown={isMobile ? startRecording : undefined}
          onPointerUp={isMobile ? stopRecording : undefined}
          onPointerLeave={isMobile ? stopRecording : undefined}
          disabled={loading || !playbackId || !captureSupported || !isPlaying}
          className="w-full h-16 bg-gradient-to-r from-neutral-200 to-neutral-500 text-neutral-900 font-semibold rounded-2xl hover:from-neutral-300 hover:to-neutral-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {recording ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              Recording... ({(recordingTime / 1000).toFixed(1)}s)
            </span>
          ) : loading || !isPlaying ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting stream...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-neutral-900" />
              {isMobile ? 'Hold to Brew' : 'Click to Start Brewing'}
            </span>
          )}
        </Button>

        {/* Controls - Animated slide-down */}
        <div className="bg-neutral-950 rounded-3xl p-6 border border-neutral-800 space-y-4 shadow-inner animate-in slide-in-from-top duration-500 delay-150">
          <div>
            <label className="text-sm font-medium mb-2 block text-neutral-300">Prompt</label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your AI effect..."
              className="bg-neutral-950 border-neutral-800 focus:border-neutral-600 focus:ring-0 text-neutral-100 placeholder:text-neutral-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-neutral-300">
              Texture
            </label>

            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 bg-neutral-950 border-neutral-800 hover:border-neutral-600 hover:bg-neutral-850 !w-16 !h-16 rounded-full overflow-hidden px-0 py-0 w-full sm:w-auto"
                  >
                    {selectedTexture ? (
                      <>
                        <img
                          src={TEXTURES.find((t) => t.id === selectedTexture)?.url}
                          alt="Selected texture"
                          className="w-8 h-8 object-cover rounded"
                        />

                      </>
                      ) : (
                        <ImageOff className="w-5 h-5 text-neutral-400" />
                      )}
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  sideOffset={8}
                  className="w-[90vw] sm:w-80 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl p-4"
                >
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    <Button
                      onClick={() => setSelectedTexture(null)}
                      variant={selectedTexture === null ? "default" : "outline"}
                      className={`aspect-square ${
                        selectedTexture === null
                          ? "bg-neutral-800 text-neutral-100"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-600"
                      }`}
                    >
                      <ImageOff className="w-5 h-5 text-neutral-400" />
                    </Button>
                    {TEXTURES.map((texture) => (
                      <Button
                        key={texture.id}
                        onClick={() => setSelectedTexture(texture.id)}
                        variant={selectedTexture === texture.id ? "default" : "outline"}
                        className={`aspect-square p-0 overflow-hidden ${
                          selectedTexture === texture.id
                            ? "ring-2 ring-neutral-400"
                            : "border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-850"
                        }`}
                      >
                        <img
                          src={texture.url}
                          alt={texture.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {selectedTexture && (
                <div className="flex-1">
                  <label className="text-sm font-medium block mb-1 text-neutral-300">
                    Strength: {textureWeight[0].toFixed(2)}
                  </label>
                  <Slider
                    value={textureWeight}
                    onValueChange={setTextureWeight}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full accent-neutral-400"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-neutral-300">
              Creativity: {creativity[0].toFixed(1)}
            </label>
            <Slider
              value={creativity}
              onValueChange={setCreativity}
              min={1}
              max={10}
              step={0.1}
              className="w-full accent-neutral-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-neutral-300">
              Quality: {quality[0].toFixed(2)}
            </label>
            <Slider
              value={quality}
              onValueChange={setQuality}
              min={0}
              max={1}
              step={0.01}
              className="w-full accent-neutral-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
