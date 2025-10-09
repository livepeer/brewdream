import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Eye, Heart, Play } from 'lucide-react';
import { useState } from 'react';

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
  const [imageError, setImageError] = useState(false);
  const duration = clip.duration_ms / 1000;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);

  // Placeholder video URLs to cycle through when image fails
  const placeholderVideos = [
    'https://cdn.prod.website-files.com/6882746ed4d70bc6cf8b898b%2F68d46b391a14d2b9d7bb8f17_clean_output%20%281%29-transcode.mp4',
    'https://cdn.prod.website-files.com/6882746ed4d70bc6cf8b898b%2F68d543ab54b9553253cae922_Feedback1-transcode.mp4',
    'https://cdn.prod.website-files.com/6882746ed4d70bc6cf8b898b%2F68d562b83269d4d9fabdc28c_SD-Webcam-2a-transcode.mp4',
    'https://cdn.prod.website-files.com/6882746ed4d70bc6cf8b898b%2F68d412f81128450e5615d225_Jellyfish%20-%201x1%20%281%29-transcode.mp4'
  ];

// Simple deterministic hash → number between 0 and placeholderVideos.length - 1
const hashToIndex = (str: string, length: number) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % length;
  }
  return hash;
};

const placeholderVideoIndex = hashToIndex(clip.id, placeholderVideos.length);
const fallbackVideo = placeholderVideos[placeholderVideoIndex];
  return (
    <motion.div
      layoutId={`clip-${clip.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-2xl bg-card hover:shadow-lg hover:shadow-[0_0_15px_2px_theme(colors.neutral.700/0.4)] transition-all duration-300 hover:border-neutral-800 border border-neutral-900"
    >
      <Link to={`/clip/${clip.id}`} className="block">
        {/* Poster Image/Video */}
        <div className="relative aspect-[9/16] overflow-hidden">
          {!imageError ? (
            <img
              src={`https://lvpr.tv/?v=${clip.asset_playback_id}`}
              alt={clip.prompt}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <video
              src={fallbackVideo}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}

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
