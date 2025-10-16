import { useEffect, useState, RefObject } from "react";

/**
 * Continuously samples a <video> element and generates a dynamic gradient background.
 * Starts with a neutral gray gradient until video frames are available.
 */
export function useCinematicVideoGradient(
  videoContainerRef: RefObject<HTMLElement>
): React.CSSProperties {
  const [bgStyle, setBgStyle] = useState<React.CSSProperties>({
    background: "linear-gradient(135deg, #0a0a0a, #1a1a1a)", // neutral fallback
    transition: "background 600ms ease",
  });

  useEffect(() => {
    let raf = 0;
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const sample = () => {
      const video = videoContainerRef.current?.querySelector("video") as
        | HTMLVideoElement
        | null;
      if (!video || !ctx) {
        raf = requestAnimationFrame(sample);
        return;
      }

      // Wait until the video has enough data to draw a frame
      if (video.readyState < 2) {
        raf = requestAnimationFrame(sample);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;

      try {
        ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h).data;

        const avgRange = (y0: number, y1: number) => {
          let r = 0, g = 0, b = 0, c = 0;
          for (let y = y0; y < y1; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              r += img[i];
              g += img[i + 1];
              b += img[i + 2];
              c++;
            }
          }
          return [Math.round(r / c), Math.round(g / c), Math.round(b / c)] as const;
        };

        const c1 = avgRange(0, Math.floor(h / 3)); // top
        const c2 = avgRange(Math.floor(h / 3), Math.floor((2 * h) / 3)); // middle
        const c3 = avgRange(Math.floor((2 * h) / 3), h); // bottom

        const rgba = (c: readonly [number, number, number], a = 0.88) =>
          `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

        const bg =
          `radial-gradient(at 20% 15%, ${rgba(c1, 0.55)} 0%, transparent 60%),` +
          `radial-gradient(at 80% 85%, ${rgba(c3, 0.55)} 0%, transparent 60%),` +
          `linear-gradient(135deg, ${rgba(c1)}, ${rgba(c2)}, ${rgba(c3)})`;

        setBgStyle({
          background: bg,
          transition: "background 600ms ease",
        });
      } catch {
        // ignore if drawImage fails before video is ready
      }

      raf = requestAnimationFrame(sample);
    };

    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, [videoContainerRef]);

  return bgStyle;
}