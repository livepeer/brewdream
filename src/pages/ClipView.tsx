import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Twitter, Home, Coffee, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Clip {
  id: string;
  asset_playback_id: string;
  prompt: string;
  duration_ms: number;
  created_at: string;
  session_id: string;
}

export default function ClipView() {
  const { id } = useParams();
  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [generatingTicket, setGeneratingTicket] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadClip();
  }, [id]);

  const loadClip = async () => {
    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setClip(data);

      // Check if user owns this clip and if they have a ticket
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('user_id, id')
          .eq('id', data.session_id)
          .single();

        if (sessionData) {
          const { data: ticketData } = await supabase
            .from('tickets')
            .select('code')
            .eq('session_id', sessionData.id)
            .single();

          if (ticketData) {
            setTicketCode(ticketData.code);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading clip:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const shareToTwitter = () => {
    const url = window.location.href;
    const text = `Made this at #RealtimeAIVideo Summit by @livepeer @DaydreamLiveAI`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
  };

  const generateTicket = async () => {
    if (!clip) return;

    setGeneratingTicket(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ticket', {
        body: { sessionId: clip.session_id },
      });

      if (error) throw error;

      setTicketCode(data.code);
      toast({
        title: 'Coffee ticket generated!',
        description: 'Show this QR code at the coffee stand',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGeneratingTicket(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-4">Clip not found</h1>
        <Link to="/">
          <Button>
            <Home className="w-4 h-4 mr-2" />
            Back to Gallery
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Video Player */}
        <div className="relative aspect-square bg-card rounded-3xl overflow-hidden border border-border">
          <video
            autoPlay
            loop
            playsInline
            controls
            className="w-full h-full object-cover"
            src={`https://lvpr.tv/?v=${clip.asset_playback_id}`}
            poster={`https://lvpr.tv/?v=${clip.asset_playback_id}`}
          />
        </div>

        {/* Clip Info */}
        <div className="bg-card rounded-3xl p-6 border border-border">
          <h2 className="text-xl font-bold mb-2">{clip.prompt}</h2>
          <p className="text-sm text-muted-foreground">
            Duration: {(clip.duration_ms / 1000).toFixed(1)}s
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Created: {new Date(clip.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={shareToTwitter}
            className="w-full h-14 bg-primary text-primary-foreground glow-primary"
          >
            <Twitter className="w-5 h-5 mr-2" />
            Share on X
          </Button>

          {ticketCode ? (
            <div className="bg-card rounded-3xl p-6 border-2 border-primary text-center">
              <Coffee className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-bold mb-2">Your Coffee Ticket</h3>
              <div className="text-4xl font-mono font-bold tracking-wider text-primary mb-2">
                {ticketCode}
              </div>
              <p className="text-sm text-muted-foreground">
                Show this code at the coffee stand
              </p>
            </div>
          ) : (
            <Button
              onClick={generateTicket}
              disabled={generatingTicket}
              variant="outline"
              className="w-full h-14 border-2 border-border hover:border-primary"
            >
              {generatingTicket ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Coffee className="w-5 h-5 mr-2" />
              )}
              Get Coffee Ticket
            </Button>
          )}

          <Link to="/">
            <Button variant="outline" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Back to Gallery
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
