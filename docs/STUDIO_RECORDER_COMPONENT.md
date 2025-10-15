# StudioRecorder Component

## Overview

`StudioRecorder` is a reusable React component that wraps any content containing video or canvas elements and handles the complete recording → Livepeer Studio upload → asset processing pipeline.

## Purpose

This component was created to:
- **Separate concerns**: Extract recording/upload logic from UI/business logic
- **Enable reusability**: Any Livepeer Studio user can integrate recording into their app
- **Simplify integration**: Wrap any video player or canvas, get Studio assets back

## API

### Handle Methods

```typescript
interface StudioRecorderHandle {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
}
```

### Props

```typescript
interface StudioRecorderProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: RecordingResult) => void;
  onError?: (error: Error) => void;
}

interface RecordingResult {
  assetId: string;
  playbackId: string;
  downloadUrl?: string;
  durationMs: number;
}

interface UploadProgress {
  phase: 'recording' | 'uploading' | 'processing' | 'complete';
  step?: string;
  progress?: number;
}
```

## Usage Example

```tsx
import { StudioRecorder, type StudioRecorderHandle } from '@/components/StudioRecorder';

function MyRecordingApp() {
  const recorderRef = useRef<StudioRecorderHandle>(null);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState('');

  const handleStart = async () => {
    setRecording(true);
    await recorderRef.current?.startRecording();
  };

  const handleStop = async () => {
    setRecording(false);
    await recorderRef.current?.stopRecording();
  };

  const handleComplete = (result) => {
    console.log('Asset created:', result.assetId, result.playbackId);
    // Save to your database, navigate to playback page, etc.
  };

  return (
    <div>
      <StudioRecorder
        ref={recorderRef}
        onProgress={(p) => setProgress(p.step || p.phase)}
        onComplete={handleComplete}
        onError={(e) => alert(e.message)}
      >
        {/* Any video player or canvas element */}
        <video src="..." autoPlay />
      </StudioRecorder>

      <button onClick={recording ? handleStop : handleStart}>
        {recording ? 'Stop' : 'Start'} Recording
      </button>
      {progress && <p>{progress}</p>}
    </div>
  );
}
```

## What It Does

1. **Finds recording source**: Searches children for `<video>` or `<canvas>` elements
2. **Captures stream**: Uses `captureStream()` API to record video/canvas content
3. **Records to blob**: Uses `MediaRecorder` to create WebM video file
4. **Uploads to Studio**: Sends blob to Livepeer Studio via resumable upload
5. **Polls for processing**: Waits for transcoding/processing to complete
6. **Returns asset info**: Provides assetId, playbackId, downloadUrl via callback

## What It Doesn't Do

- **No UI**: Component is headless, parent manages buttons/controls
- **No duration limits**: Parent enforces min/max recording time
- **No database operations**: Parent saves metadata to their database
- **No state props**: All state updates flow through callbacks

## Layout Behavior

The component wraps children in a `<div>` element. By default, this wrapper has:
- `className="w-full h-full"` (Tailwind: 100% width and height)
- `style={{ width: '100%', height: '100%' }}` (inline styles as fallback)

You can override these by passing your own `className` or `style` props:

```tsx
<StudioRecorder className="absolute inset-0" style={{ zIndex: 10 }}>
  {/* your video player */}
</StudioRecorder>
```

This ensures the wrapper doesn't interfere with your layout while still providing a container for finding video/canvas elements.

## Supported Elements

The component searches for recording sources in this order:
1. First `<video>` element in children
2. First `<canvas>` element in children (if no video found)

Both support the `captureStream()` API required for recording.

## Callback Flow

```
User calls startRecording()
  ↓
onRecordingStart() fires
  ↓
onProgress({ phase: 'recording' })
  ↓
User calls stopRecording()
  ↓
onRecordingStop() fires
  ↓
onProgress({ phase: 'uploading' })
  ↓
onProgress({ phase: 'processing', progress: 0.5 })
  ↓
onProgress({ phase: 'complete', progress: 1 })
  ↓
onComplete({ assetId, playbackId, downloadUrl, durationMs })
```

## Error Handling

The component handles these error cases:

- **No video/canvas found**: `onError('No video or canvas element found...')`
- **Browser not supported**: `onError('Video capture not supported...')`
- **Upload failed**: `onError('Upload failed: ...')`
- **Processing timeout**: `onError('Video processing timed out...')`

## Internal Implementation

The component uses:
- **VideoRecorder class** (`@/lib/recording.ts`): Low-level recording API
- **uploadToLivepeer function** (`@/lib/recording.ts`): Studio upload with polling
- **forwardRef + useImperativeHandle**: Exposes methods to parent
- **Internal refs**: Tracks recorder, timing, and processing state
- **Race condition guards**: Prevents concurrent recordings

## Browser Support

Requires browsers that support:
- `HTMLVideoElement.captureStream()` or `HTMLCanvasElement.captureStream()`
- `MediaRecorder` API with WebM support
- Modern `fetch()` API for uploads

Supported browsers:
- ✅ Chrome/Edge 51+
- ✅ Firefox 43+
- ✅ Safari 14.1+
- ⚠️ Mobile browsers (varies by device)

## Integration with Capture.tsx

The Brewdream `Capture.tsx` page uses `StudioRecorder` like this:

```tsx
<StudioRecorder
  ref={studioRecorderRef}
  onProgress={handleRecordingProgress}
  onComplete={handleRecordingComplete}
  onError={handleRecordingError}
>
  <div ref={playerContainerRef}>
    <Player.Root src={src} autoPlay lowLatency="force">
      <Player.Container>
        <Player.Video />
      </Player.Container>
    </Player.Root>
  </div>
</StudioRecorder>
```

The parent page handles:
- Recording button UI (hold-to-record on mobile, click-toggle on desktop)
- Duration enforcement (3-10 second limits)
- Auto-stop timer (10 seconds max)
- Database save (calls `saveClipToDatabase()` in `onComplete`)
- Progress UI (upload percentage, processing status)

## Files

- **Component**: `src/components/StudioRecorder.tsx` (194 lines)
- **Used by**: `src/pages/Capture.tsx`
- **Dependencies**: `src/lib/recording.ts` (VideoRecorder, uploadToLivepeer)

## Benefits

✅ **Reusable**: Works with any video player (Livepeer, native, custom)
✅ **Flexible**: Supports video and canvas elements
✅ **Type-safe**: Full TypeScript with exported interfaces
✅ **Callback-based**: Clean event-driven architecture
✅ **Headless**: No UI opinions, parent controls everything
✅ **Production-ready**: Error handling, race condition guards, cleanup

