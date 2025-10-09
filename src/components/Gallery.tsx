import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';

interface Clip {
  id: string;
  asset_playback_id: string;
  prompt: string;
  created_at: string;
  duration_ms: number;
}

export function Gallery() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClips();
  }, []);

  const loadClips = async () => {
    try {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClips(data || []);
    } catch (error) {
      console.error('Error loading clips:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading gallery...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 gradient-text">DD Coffee Clip</h1>
          <p className="text-muted-foreground">Realtime AI Video Gallery</p>
        </div>

        {clips.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">No clips yet. Be the first to create one!</p>
            <Link 
              to="/start" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium glow-primary hover:scale-105 transition-smooth"
            >
              Create Your Clip
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {clips.map((clip) => (
              <Link
                key={clip.id}
                to={`/clip/${clip.id}`}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-card border border-border hover:border-primary transition-smooth"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                  <img
                    src={`https://lvpr.tv/?v=${clip.asset_playback_id}`}
                    alt={clip.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-smooth flex items-end p-4">
                  <div className="w-full">
                    <p className="text-sm font-medium line-clamp-2 mb-2">{clip.prompt}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <PlayCircle className="w-4 h-4" />
                      <span>{(clip.duration_ms / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            to="/start"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full font-medium glow-primary hover:scale-105 transition-smooth"
          >
            Create Your Clip
          </Link>
        </div>
      </div>
    </div>
  );
}
