# Pull Request: Integrate Daydream Realtime Streaming

## 🎯 Summary

This PR integrates Daydream's realtime video-to-video AI streaming into clip-and-brew with:
- ✅ Server-side stream creation (no client secrets)
- ✅ In-browser WHIP publishing (camera+mic)
- ✅ WebRTC-only playback via iframe
- ✅ Real-time StreamDiffusion prompt updates

## 🔐 Security

**All API keys are server-side only:**
- `DAYDREAM_API_KEY` stored in Supabase Edge Function secrets
- All Daydream API calls proxied through edge functions
- Client receives only essential data: `{id, output_playback_id, whip_url}`
- No credentials exposed to browser

## 📋 Changes

### Created Files
1. **`/src/lib/daydream.ts`** - Core Daydream client helpers
   - `createDaydreamStream()` - Stream creation
   - `startWhipPublish()` - WHIP protocol implementation
   - `updateDaydreamPrompts()` - StreamDiffusion prompt updates

2. **`/DAYDREAM_INTEGRATION.md`** - Full technical documentation
3. **`/DAYDREAM_IMPLEMENTATION_SUMMARY.md`** - Implementation overview

### Modified Files

#### Server (Supabase Edge Functions)
1. **`/supabase/functions/daydream-stream/index.ts`**
   - Added default `pipeline_id: 'pip_qpUgXycjWF6YMeSL'` (StreamDiffusion)
   - Returns only essential fields for security
   - Enhanced error handling

2. **`/supabase/functions/daydream-prompt/index.ts`**
   - Accepts full StreamDiffusion prompt body
   - Validates `streamId` presence
   - Forwards complete params to Daydream API

#### Client
3. **`/src/pages/Capture.tsx`**
   - Integrated Daydream helper functions
   - Replaced video element with iframe for WebRTC playback
   - Updated prompt format to full StreamDiffusion spec
   - Added controlnets with `conditioning_scale: 0` (prevents reloads)

4. **`/src/App.tsx`**
   - Removed unused Livepeer React imports

5. **`/.env.local.example`**
   - Removed `VITE_DAYDREAM_API_KEY` (was client-accessible)
   - Added server-side API key documentation
   - Security notes about Supabase secrets

### Removed
- Uninstalled `@livepeer/react` (not needed for iframe playback)

## 🏗️ Architecture

```
Client (Browser)
    ↓
Supabase Edge Functions ← DAYDREAM_API_KEY (server secret)
    ↓
Daydream API
    ↓
Stream: {id, output_playback_id, whip_url}
    ↓
Client: WHIP Publish (WebRTC) → Daydream
Client: Playback (iframe) ← lvpr.tv
```

## 🎨 Features

### 1. Stream Creation
```typescript
const stream = await createDaydreamStream();
// Returns: {id, output_playback_id, whip_url}
```

### 2. WHIP Publishing
- Non-trickle ICE gathering
- Proper offer/answer SDP exchange
- Camera + microphone tracks

### 3. WebRTC Playback
```tsx
<iframe 
  src={`https://lvpr.tv/?v=${playbackId}&lowLatency=force`}
  // Forces WebRTC-only, no HLS fallback
/>
```

### 4. StreamDiffusion Prompts
```typescript
await updateDaydreamPrompts(streamId, {
  prompt: "cyberpunk portrait, neon lights",
  negative_prompt: "blurry, low quality",
  t_index_list: [6, 12, 18],
  seed: 42,
  // + 5 controlnets with conditioning_scale
});
```

## ✅ Testing

### Build Status
```bash
✓ npm run build - PASSING
✓ 2195 modules transformed
✓ No errors or warnings
```

### Manual Test Flow
1. Navigate to `/capture`
2. Camera auto-starts (desktop) or select (mobile)
3. Stream creates → AI output visible
4. Change prompt → Effect updates in real-time
5. Hold record → Clip created

### Verified
- [x] Stream creation returns valid data
- [x] WHIP publish establishes WebRTC
- [x] Source video shows in PiP
- [x] AI output plays via WebRTC iframe
- [x] Prompt updates work in real-time
- [x] No API keys in client
- [x] Build succeeds

## 🚀 Deployment

### Prerequisites
Set the API key in Supabase:
```bash
supabase secrets set DAYDREAM_API_KEY=your-key-here
```

### Environment Variables
**Client (`.env.local`):**
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

**Server (Supabase Secrets):**
```bash
DAYDREAM_API_KEY=...  # Set via CLI
```

## 📊 API Endpoints

### POST `/daydream-stream` (Edge Function)
**Request:**
```json
{ "pipeline_id": "pip_qpUgXycjWF6YMeSL" }
```
**Response:**
```json
{
  "id": "stream_abc123",
  "output_playback_id": "playback_xyz",
  "whip_url": "https://..."
}
```

### POST `/daydream-prompt` (Edge Function)
**Request:**
```json
{
  "streamId": "stream_abc123",
  "model_id": "streamdiffusion",
  "pipeline": "live-video-to-video",
  "params": {
    "prompt": "...",
    "t_index_list": [6, 12, 18],
    "controlnets": [...]
  }
}
```

## 🔍 Code Quality

- ✅ TypeScript strict types
- ✅ Comprehensive error handling
- ✅ Proper async/await patterns
- ✅ Security-first design
- ✅ Well-documented functions
- ✅ Clean separation of concerns

## 📝 Documentation

- Full integration guide: `DAYDREAM_INTEGRATION.md`
- Implementation summary: `DAYDREAM_IMPLEMENTATION_SUMMARY.md`
- Inline code documentation in `src/lib/daydream.ts`

## 🎯 Acceptance Criteria

✅ All requirements met:
- ✅ Create Daydream stream via server (no client secrets)
- ✅ In-browser WHIP publish (camera+mic)
- ✅ WebRTC-only playback (iframe with `lowLatency=force`)
- ✅ StreamDiffusion prompt updates with controlnets
- ✅ Security: API keys server-side only
- ✅ CORS: Proper headers in edge functions
- ✅ Build: No errors

## 🔮 Future Work (Out of Scope)

Deferred to future PRs:
- Livepeer Studio clipping/asset upload
- Canvas source support
- Service worker playback header extraction
- Advanced controlnet UI controls
- Weighted prompt blending
- Multi-user rooms with SSE

---

**Ready to merge:** ✅ Yes
**Breaking changes:** ❌ No
**Requires migration:** ❌ No (just set env secret)
