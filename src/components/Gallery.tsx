import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from './Header';
import { ClipCard } from './ClipCard';
import { FloatingFAB } from './FloatingFAB';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadClips();
    checkAuth();
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

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    } catch (error) {
      console.error('Error checking auth:', error);
    }
  };

  if (loading) {
      return (
        <div className="min-h-screen">
          <Header isAuthenticated={isAuthenticated} />
    
          <main className="flex-1">
            <div className="container mx-auto px-6 py-16">
            <div className="mb-16 text-center">
              <p className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Powered by Daydream
              </p>
              <h1 className="text-balance mb-6 bg-gradient-to-r from-foreground via-foreground/80 to-foreground/40 bg-clip-text text-5xl font-extrabold text-transparent md:text-6xl">Create your <br /> brewdream</h1>
              <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
                Create a clip and show it at the booth to win a{" "}
                <strong className="font-bold text-foreground">free coffee</strong>. Share your creativity and get
                rewarded!
              </p>
            </div>
              {/* Masonry Grid Skeleton */}
              <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="mb-6 break-inside-avoid">
                    <div className="h-[500px] w-full animate-pulse rounded-xl bg-card" />
                  </div>
                ))}
              </div>
            </div>
          </main>
    
        </div>
      );
  } 
  return (
<div className="relative min-h-screen overflow-hidden bg-neutral-950">
  {/* Radial fade overlay */}
  <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgb(0_0_0/.7)_100%)]" />

      <Header isAuthenticated={isAuthenticated} />
  
      <main className="flex-1 relative z-10 ">
      <div className="absolute inset-0 -z-10">
      <div className="absolute top-0 right-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_center,theme(colors.orange.400/30),transparent_70%)] blur-3xl" />
      <div className="absolute top-40 left-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_center,theme(colors.pink.400/30),transparent_70%)] blur-3xl" />
      <div className="absolute top-80 right-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_center,theme(colors.purple.400/25),transparent_70%)] blur-3xl" />
    </div>

        <div className="container mx-auto px-6 py-16">
          <div className="mb-16 text-center">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Powered by <img src="/dd-logo.png" alt="Daydream" className="inline-block h-[2em] w-auto align-baseline mx-[2px] pl-2 pt-3" /> Daydream
            </p>
            <h1 className="text-balance mb-6 bg-gradient-to-r from-foreground via-foreground/80 to-foreground/40 bg-clip-text text-5xl font-extrabold text-transparent md:text-6xl">
              Create your <br />
           
              brewdream
            </h1>
            <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
              Create a clip and show it at the booth to win a{" "}
              <strong className="font-bold text-foreground">free coffee</strong>.
              Share your creativity and get rewarded!
            </p>
          </div>
  
          {/* Masonry Grid */}
          <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4 relative z-10">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-screen top-0 bg-gradient-to-t from-neutral-950 h-screen via-neutral-900 to-transparent opacity-30 blur-3xl" />

            {clips.map((clip) => (
              <div key={clip.id} className="mb-6 break-inside-avoid">
                <ClipCard clip={clip} />
              </div>
            ))}
          </div>
  
          {/* Empty State */}
          {clips.length === 0 && (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="text-center">
                <p className="text-lg text-muted-foreground">
                  No clips found. Run the database setup scripts to add sample data.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
  
      <FloatingFAB isAuthenticated={isAuthenticated} />
    </div>
  );
}