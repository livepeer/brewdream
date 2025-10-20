import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import * as Player from "@livepeer/react/player";

interface DaydreamOutputPlayerProps {
  playbackUrl?: string | null;
  showSlowLoadingMessage?: boolean;
  style?: React.CSSProperties;
}

export function DaydreamOutputPlayer({
  playbackUrl,
  showSlowLoadingMessage = false,
  style = {}
}: DaydreamOutputPlayerProps) {
  // Construct src object internally
  const src = useMemo(() => {
    if (!playbackUrl) return null;

    return [
      {
        type: "webrtc" as const,
        src: playbackUrl,
        mime: "video/h264" as const,
        width: 512,
        height: 512,
      },
    ];
  }, [playbackUrl]);

  if (!playbackUrl) {
    return (
      <div className={"w-full h-full flex items-center justify-center"} style={style}>
        <Loader2 className="w-12 h-12 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <Player.Root src={src} autoPlay lowLatency="force">
      <Player.Container
        className="w-full h-full"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        <Player.Video
          className="w-full h-full"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <Player.LoadingIndicator>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/50 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-sm text-neutral-300 text-center px-4 min-h-[20px]">
              {showSlowLoadingMessage &&
                "Hang tight! Stream loading can take up to 30 seconds..."}
            </p>
          </div>
        </Player.LoadingIndicator>
      </Player.Container>
    </Player.Root>
  );
}
