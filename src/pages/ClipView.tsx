import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Eye, Heart, Share2, Download, Twitter, Home, Coffee, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';

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
  const navigate = useNavigate();
  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [generatingTicket, setGeneratingTicket] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadClip();
    checkAuth();
  }, [id]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    } catch (error) {
      console.error('Error checking auth:', error);
    }
  };

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

  const handleLike = async () => {
    setIsLiked(!isLiked);
    // TODO: Implement like functionality with API route
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
    <div className="min-h-screen">
      <Header isAuthenticated={isAuthenticated} />

      <div className="container mx-auto px-6 py-8">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <motion.div
              layoutId={`clip-${clip.id}`}
              className="relative mb-6 overflow-hidden rounded-2xl bg-card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="relative aspect-[9/16] max-h-[80vh] w-full bg-black">
                <video
                  src={`https://lvpr.tv/?v=${clip.asset_playback_id}`}
                  poster={`https://lvpr.tv/?v=${clip.asset_playback_id}`}
                  controls
                  className="h-full w-full object-contain"
                  autoPlay
                  loop
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </motion.div>

            {/* Title and Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mb-6"
            >
              <h1 className="mb-3 text-3xl font-bold text-foreground">{clip.prompt}</h1>
              <p className="text-muted-foreground">
                Duration: {(clip.duration_ms / 1000).toFixed(1)}s • Created: {new Date(clip.created_at).toLocaleDateString()}
              </p>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex flex-wrap gap-3"
            >
              <Button variant={isLiked ? "default" : "outline"} size="lg" onClick={handleLike} className="gap-2">
                <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
                0
              </Button>

              <Button variant="outline" size="lg" className="gap-2 bg-transparent">
                <Eye className="h-5 w-5" />
                0
              </Button>

              <Button variant="outline" size="lg" onClick={shareToTwitter} className="gap-2 bg-transparent">
                <Share2 className="h-5 w-5" />
                Share
              </Button>

              <Button variant="outline" size="lg" className="gap-2 bg-transparent">
                <Download className="h-5 w-5" />
                Download
              </Button>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Coffee Ticket Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="bg-card rounded-2xl p-6 border border-border"
            >
              {ticketCode ? (
                <div className="text-center">
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
                <div className="text-center">
                  <Coffee className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-bold mb-4">Get Your Free Coffee</h3>
                  <Button
                    onClick={generateTicket}
                    disabled={generatingTicket}
                    className="w-full gap-2"
                  >
                    {generatingTicket ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Coffee className="w-5 h-5" />
                    )}
                    Generate Ticket
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Back to Gallery */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <Link to="/">
                <Button variant="outline" className="w-full gap-2">
                  <Home className="w-4 h-4" />
                  Back to Gallery
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
