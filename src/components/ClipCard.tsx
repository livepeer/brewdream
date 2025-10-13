import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Eye, Heart, Play } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface Clip {
  id: string;
  asset_playback_id: string;
  prompt: string;
  created_at: string;
  duration_ms: number;
  likes_count?: number;
}

interface ClipCardProps {
  clip: Clip;
}

export function ClipCard({ clip }: ClipCardProps) {
  const [viewCount, setViewCount] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasLoadedViews = useRef(false);
  const isMobile = useIsMobile();

  const duration = clip.duration_ms / 1000;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);

  // Build direct MP4 URL
  const videoUrl = `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${clip.asset_playback_id}/static512p0.mp4`;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasLoadedViews.current) {
          hasLoadedViews.current = true;
          fetchViewCount();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchViewCount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-viewership', {
        body: { playbackId: clip.asset_playback_id }
      });

      if (error) {
        console.error('Error fetching view count:', error);
        setViewCount(0);
        return;
      }

      setViewCount(data?.viewCount || 0);
    } catch (error) {
      console.error('Error fetching view count:', error);
      setViewCount(0);
    }
  };
  return (
    <motion.div
      ref={cardRef}
      layoutId={`clip-${clip.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-2xl bg-card hover:shadow-lg hover:shadow-[0_0_15px_2px_theme(colors.neutral.700/0.4)] transition-all duration-300 hover:border-neutral-800 border border-neutral-900"
    >
      <Link to={`/clip/${clip.id}`} className="block">
        {/* Video */}
        <div className={`relative overflow-hidden ${isMobile ? 'aspect-[9/16]' : 'aspect-square'}`}>
          <video
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Play className="h-6 w-6 text-white" fill="white" />
              </div>
            </div>
          </div>

          {/* Duration badge */}
          <div className="absolute right-3 top-3 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-foreground">{clip.prompt}</h3>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              <span>{viewCount !== null ? viewCount : '...'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              <span>{clip.likes_count}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
