import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Eye, Heart, Play } from 'lucide-react';

interface Clip {
  id: string;
  asset_playback_id: string;
  prompt: string;
  created_at: string;
  duration_ms: number;
}

interface ClipCardProps {
  clip: Clip;
}

export function ClipCard({ clip }: ClipCardProps) {
  const duration = clip.duration_ms / 1000;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);

  return (
    <motion.div
      layoutId={`clip-${clip.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-2xl bg-card"
    >
      <Link to={`/clip/${clip.id}`} className="block">
        {/* Poster Image */}
        <div className="relative aspect-[9/16] overflow-hidden">
          <img
            src={`https://lvpr.tv/?v=${clip.asset_playback_id}`}
            alt={clip.prompt}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
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
              <span>0</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              <span>0</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
