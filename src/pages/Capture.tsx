import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Camera, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

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
  { id: '1', url: '/textures/texture_1.jpg', name: 'Texture 1' },
  { id: '2', url: '/textures/texture_2.jpg', name: 'Texture 2' },
  { id: '3', url: '/textures/texture_3.jpg', name: 'Texture 3' },
  { id: '4', url: '/textures/texture_4.jpg', name: 'Texture 4' },
  { id: '5', url: '/textures/texture_5.jpg', name: 'Texture 5' },
  { id: '6', url: '/textures/texture_6.jpg', name: 'Texture 6' },
  { id: '7', url: '/textures/texture_7.jpg', name: 'Texture 7' },
  { id: '8', url: '/textures/texture_8.jpg', name: 'Texture 8' },
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

export default function Capture() {
  const [cameraType, setCameraType] = useState<'front' | 'back' | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [whipUrl, setWhipUrl] = useState<string | null>(null);
  const [autoStartChecked, setAutoStartChecked] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [selectedTexture, setSelectedTexture] = useState<string | null>(null);
  const [textureWeight, setTextureWeight] = useState([0.5]);
  const [creativity, setCreativity] = useState([5]);
  const [quality, setQuality] = useState([0.4]);

  const [recording, setRecording] = useState(false);
  const [recordStartTime, setRecordStartTime] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-start camera on desktop (non-mobile devices)
  useEffect(() => {
    if (!autoStartChecked && cameraType === null && !loading) {
      const shouldAutoStart = !hasMultipleCameras();
      if (shouldAutoStart) {
        setAutoStartChecked(true);
        // Desktop device - auto-start with default camera
        selectCamera('front');
      } else {
        setAutoStartChecked(true);
      }
    }
  }, [autoStartChecked, cameraType, loading]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login');
    }
  };

  const selectCamera = async (type: 'front' | 'back') => {
    setCameraType(type);
    const randomPrompt = type === 'front'
      ? FRONT_PROMPTS[Math.floor(Math.random() * FRONT_PROMPTS.length)]
      : BACK_PROMPTS[Math.floor(Math.random() * BACK_PROMPTS.length)];
    setPrompt(randomPrompt);

    await initializeStream(type);
  };

  const initializeStream = async (type: 'front' | 'back') => {
    setLoading(true);
    try {
      // Create Daydream stream
      const { data: streamData, error: streamError } = await supabase.functions.invoke('daydream-stream', {
        body: { pipeline_id: 'pip_SDXL-turbo' }
      });

      if (streamError) throw streamError;

      console.log('Stream created:', streamData);
      setStreamId(streamData.id);
      setPlaybackId(streamData.output_playback_id);
      setWhipUrl(streamData.whip_url);

      // Start WebRTC publishing
      await startWebRTCPublish(streamData.whip_url, type);

      // Save session to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (userData) {
          await supabase.from('sessions').insert({
            user_id: userData.id,
            stream_id: streamData.id,
            playback_id: streamData.output_playback_id,
            camera_type: type,
          });
        }
      }

      toast({
        title: 'Stream ready!',
        description: 'You can now start recording',
      });
    } catch (error: any) {
      console.error('Error initializing stream:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const startWebRTCPublish = async (whipUrl: string, type: 'front' | 'back') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: type === 'front' ? 'user' : 'environment',
          width: 512,
          height: 512,
        },
        audio: true,
      });

      if (sourceVideoRef.current) {
        sourceVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          });
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch(whipUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp,
      });

      if (!response.ok) throw new Error('WHIP publish failed');

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      console.log('WebRTC publishing started');
    } catch (error) {
      console.error('Error starting WebRTC publish:', error);
      throw error;
    }
  };

  const updatePrompt = async () => {
    if (!streamId) return;

    try {
      // Calculate t_index_list based on creativity and quality
      const tIndexList = calculateTIndexList(creativity[0], quality[0]);

      await supabase.functions.invoke('daydream-prompt', {
        body: {
          streamId,
          prompt,
          texture_weight: selectedTexture ? textureWeight[0] : 0,
          t_index_list: tIndexList,
        },
      });

      toast({
        title: 'Prompt updated!',
        description: 'The AI effect is now active',
      });
    } catch (error: any) {
      console.error('Error updating prompt:', error);
    }
  };

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

  const startRecording = () => {
    setRecording(true);
    setRecordStartTime(Date.now());
  };

  const stopRecording = async () => {
    if (!recordStartTime || !playbackId) return;

    const duration = Date.now() - recordStartTime;
    const clampedDuration = Math.max(3000, Math.min(10000, duration));

    setRecording(false);
    setLoading(true);

    try {
      // Create clip via Livepeer
      const { data: clipData, error: clipError } = await supabase.functions.invoke('livepeer-clip', {
        body: {
          playbackId,
          durationMs: clampedDuration,
        },
      });

      if (clipError) throw clipError;

      // Save clip to database
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id')
        .eq('stream_id', streamId)
        .single();

      if (sessionData) {
        const { data: clip } = await supabase.from('clips').insert({
          session_id: sessionData.id,
          asset_playback_id: clipData.playbackId,
          asset_url: clipData.downloadUrl,
          prompt,
          texture_id: selectedTexture,
          texture_weight: selectedTexture ? textureWeight[0] : null,
          t_index_list: calculateTIndexList(creativity[0], quality[0]),
          duration_ms: clampedDuration,
        }).select().single();

        if (clip) {
          toast({
            title: 'Clip created!',
            description: 'Redirecting to share...',
          });
          navigate(`/clip/${clip.id}`);
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error creating clip',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prompt && streamId) {
      const debounce = setTimeout(() => {
        updatePrompt();
      }, 500);
      return () => clearTimeout(debounce);
    }
  }, [prompt, selectedTexture, textureWeight, creativity, quality]);

  if (!cameraType) {
    // Show loading state while auto-starting on desktop
    if (loading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-8">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Starting camera...</p>
          </div>
        </div>
      );
    }

    // Camera selection screen (only shown on mobile/tablet devices)
    const showMultipleCameras = hasMultipleCameras();

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full text-center space-y-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">
              {showMultipleCameras ? 'Choose Camera' : 'Start Camera'}
            </h1>
            <p className="text-muted-foreground">
              {showMultipleCameras ? 'Select which camera to use' : 'Start your webcam to begin'}
            </p>
          </div>

          <div className="space-y-4">
            {showMultipleCameras ? (
              <>
                <Button
                  onClick={() => selectCamera('front')}
                  className="w-full h-20 bg-card border-2 border-border hover:border-primary transition-smooth"
                  variant="outline"
                >
                  <div className="flex items-center gap-4">
                    <Camera className="w-8 h-8 text-primary" />
                    <div className="text-left">
                      <div className="font-semibold">Front Camera</div>
                      <div className="text-sm text-muted-foreground">Selfie mode</div>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => selectCamera('back')}
                  className="w-full h-20 bg-card border-2 border-border hover:border-primary transition-smooth"
                  variant="outline"
                >
                  <div className="flex items-center gap-4">
                    <Camera className="w-8 h-8 text-accent" />
                    <div className="text-left">
                      <div className="font-semibold">Back Camera</div>
                      <div className="text-sm text-muted-foreground">Environment mode</div>
                    </div>
                  </div>
                </Button>
              </>
            ) : (
              <Button
                onClick={() => selectCamera('front')}
                className="w-full h-20 bg-gradient-to-r from-primary to-accent text-white glow-primary"
              >
                <div className="flex items-center gap-4">
                  <Camera className="w-8 h-8" />
                  <div className="text-left">
                    <div className="font-semibold text-lg">Start Webcam</div>
                    <div className="text-sm opacity-90">Begin recording</div>
                  </div>
                </div>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Main Video Output (Square 512x512) */}
        <div className="relative aspect-square bg-card rounded-3xl overflow-hidden border border-border">
          {playbackId ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              src={`https://lvpr.tv/?v=${playbackId}&lowLatency=force`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          )}

          {/* PiP Source Preview */}
          <div className="absolute bottom-4 right-4 w-24 h-24 rounded-2xl overflow-hidden border-2 border-white shadow-lg">
            <video
              ref={sourceVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="bg-card rounded-3xl p-6 border border-border space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Prompt</label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your AI effect..."
              className="bg-background border-border"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Texture</label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant={selectedTexture === null ? "default" : "outline"}
                onClick={() => setSelectedTexture(null)}
                className="aspect-square"
              >
                None
              </Button>
              {TEXTURES.map((texture) => (
                <Button
                  key={texture.id}
                  variant={selectedTexture === texture.id ? "default" : "outline"}
                  onClick={() => setSelectedTexture(texture.id)}
                  className="aspect-square p-0 overflow-hidden"
                >
                  <img src={texture.url} alt={texture.name} className="w-full h-full object-cover" />
                </Button>
              ))}
            </div>
          </div>

          {selectedTexture && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Texture Weight: {textureWeight[0].toFixed(2)}
              </label>
              <Slider
                value={textureWeight}
                onValueChange={setTextureWeight}
                min={0}
                max={1}
                step={0.01}
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">
              Creativity: {creativity[0].toFixed(1)}
            </label>
            <Slider
              value={creativity}
              onValueChange={setCreativity}
              min={1}
              max={10}
              step={0.1}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Quality: {quality[0].toFixed(2)}
            </label>
            <Slider
              value={quality}
              onValueChange={setQuality}
              min={0}
              max={1}
              step={0.01}
              className="w-full"
            />
          </div>
        </div>

        {/* Record Button */}
        <Button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={loading || !playbackId}
          className="w-full h-16 bg-gradient-to-r from-primary to-accent text-white glow-primary"
        >
          {recording ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
              Recording... ({recordStartTime ? ((Date.now() - recordStartTime) / 1000).toFixed(1) : 0}s)
            </span>
          ) : loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Hold to Record (3-10s)
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
