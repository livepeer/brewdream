import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from './Header';
import { ClipCard } from './ClipCard';
import { FloatingFAB } from './FloatingFAB';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';

interface Clip {
  id: string;
  asset_playback_id: string;
  prompt: string;
  created_at: string;
  duration_ms: number;
  likes_count?: number;
}

export function Gallery() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const PAGE_SIZE = isMobile ? 10 : 16;

  useEffect(() => {
    loadClips();
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreClips();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, page]);

  const loadClips = async () => {
    try {
      const { data, error } = await supabase
        .from('clips')
        .select(`
          *,
          likes_count:clip_likes(count)
        `)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;

      const fetchedClips = (data || []).map(clip => ({
        ...clip,
        likes_count: clip.likes_count?.[0]?.count || 0
      }));
      setClips(fetchedClips);
      setHasMore(fetchedClips.length === PAGE_SIZE);
      setPage(1);
    } catch (error) {
      console.error('Error loading clips:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreClips = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const startRange = page * PAGE_SIZE;
      const endRange = startRange + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('clips')
        .select(`
          *,
          likes_count:clip_likes(count)
        `)
        .order('created_at', { ascending: false })
        .range(startRange, endRange);

      if (error) throw error;

      const fetchedClips = (data || []).map(clip => ({
        ...clip,
        likes_count: clip.likes_count?.[0]?.count || 0
      }));

      if (fetchedClips.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setClips((prev) => [...prev, ...fetchedClips]);
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error('Error loading more clips:', error);
    } finally {
      setLoadingMore(false);
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
              <h1 className="text-balance mb-6 bg-gradient-to-r from-foreground via-foreground/80 to-foreground/40 bg-clip-text text-5xl font-extrabold text-transparent md:text-6xl">Brew your dream</h1>
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
              Brew your dream
            </h1>
            <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
              Create a clip and show it at the booth to win a{" "}
              <strong className="font-bold text-foreground">free coffee</strong>.
              Share your creativity and get rewarded!
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 relative z-10">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-screen top-0 bg-gradient-to-t from-neutral-950 h-screen via-neutral-900 to-transparent opacity-30 blur-3xl" />

            {clips.map((clip) => (
              <div key={clip.id}>
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

          {/* Infinite Scroll Trigger */}
          {hasMore && clips.length > 0 && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {loadingMore && (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </main>

      <FloatingFAB isAuthenticated={isAuthenticated} />
    </div>
  );
}
