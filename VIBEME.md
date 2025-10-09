# VIBEME.md - Brewdream Project Context

> **Purpose**: High-level context for AI agents. Read this first to understand the project's architecture, patterns, and conventions before making changes. Update this file when making significant architectural changes.
>
> **Related Documents**:
> - [`PRD.md`](./PRD.md) - Product vision, requirements, and acceptance criteria (the "what" and "why")
> - **VIBEME.md** (this file) - Current implementation state, patterns, and conventions (the "how")

## 🎯 Project Mission

**Brewdream** (aka "Realtime AI Video Summit") is a mobile-first microsite for the Livepeer × Daydream Summit during Open Source AI Week. Attendees scan a QR code, create AI-stylized video clips (3-10s) using real-time AI effects, share them on X (Twitter), and receive coffee tickets as rewards.

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui component library
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Video**: WebRTC (camera) → Daydream AI (effects) → Livepeer (streaming/clipping)
- **Auth**: Supabase Auth with email OTP (magic links)

## 📐 Architecture Overview

```
User Flow:
1. Landing → Login (email OTP) → Capture → ClipView
2. Gallery (home) shows all created clips

Video Pipeline:
Camera → WebRTC → Daydream Stream (AI effects) → Livepeer (HLS playback)
                                                 ↓
                                            Clip creation (3-10s)
                                                 ↓
                                            Share + Coffee Ticket
```

## 🗂️ Project Structure

```
src/
├── pages/          # Route pages (Capture, ClipView, NotFound, Index)
├── components/     # Reusable components (Gallery, Landing, Login)
│   └── ui/         # shadcn/ui components (50+ components)
├── integrations/
│   └── supabase/   # Supabase client & types
├── hooks/          # Custom React hooks (use-mobile, use-toast)
└── lib/            # Utilities (cn helper)

supabase/
├── functions/      # Edge Functions (API proxy layer)
│   ├── daydream-stream/    # Create Daydream AI stream
│   ├── daydream-prompt/    # Update stream prompt/effects
│   ├── livepeer-clip/      # Create clip from stream
│   ├── generate-ticket/    # Generate coffee QR code
│   └── send-auth-email/    # Custom OTP email template
└── migrations/     # Database schema
```

## 🎨 Design System

**Theme**: Dark mode with vibrant gradients
- **Primary**: Purple (`hsl(280 100% 70%)`) - main brand color
- **Accent**: Cyan (`hsl(180 100% 50%)`) - secondary highlights
- **Accent Pink**: (`hsl(330 100% 70%)`) - tertiary accents
- **Background**: Near-black (`hsl(240 10% 3.9%)`)

**Visual Language**:
- Rounded corners (`--radius: 1rem`)
- Glow effects on primary elements (`--shadow-glow`)
- Gradient text for headings (`.gradient-text`)
- Smooth transitions (`--transition-smooth`)
- Square aspect ratios for video (512x512)

**Custom Classes** (defined in `src/index.css`):
- `.gradient-text` - Primary gradient text
- `.glow-primary` - Primary glow effect
- `.glow-strong` - Stronger glow
- `.transition-smooth` - Smooth cubic-bezier transitions

## 🔑 Key Concepts

### Hard Constraints (from PRD)
These are **non-negotiable** technical requirements:
- ✅ **No client-side API keys** - All Daydream/Livepeer calls via Supabase Edge Functions
- ✅ **WebRTC only** - Force low-latency mode (`lowLatency=force`), no HLS fallback
- ✅ **Browser WHIP publish** - Direct WebRTC to Daydream's `whip_url` (camera + mic)
- ✅ **Clips must be Livepeer Assets** - Use Create Clip API from playbackId
- ✅ **Mobile-first** - Primary target is event attendees on phones
- ✅ **Square aspect ratio** - 512×512 for all video (Daydream pipeline requirement)

### Database Schema
**4 main tables** (see `supabase/migrations/*.sql`, matches PRD data model exactly):
1. **users**: Email, twitter_handle (OTP auth)
2. **sessions**: Links user to stream (stream_id, playback_id, camera_type)
3. **clips**: Video clips with AI metadata (prompt, texture_id, texture_weight, t_index_list, duration_ms)
4. **tickets**: Coffee QR codes (code, redeemed flag)

**RLS Policies**: Public read for clips/sessions, authenticated write, users own their tickets

### Video Processing Flow

1. **Stream Creation** (`daydream-stream`):
   - Pipeline: `pip_SDXL-turbo` (fast AI processing)
   - Returns: `stream_id`, `output_playback_id`, `whip_url`

2. **WebRTC Publishing** (Capture.tsx):
   - Get user media (512x512, front/back camera)
   - Create RTCPeerConnection
   - WHIP protocol to publish to Daydream
   - PiP preview of source, main view shows AI output

3. **AI Effect Controls** (Capture.tsx):
   - **Prompt**: Text description of style
   - **Texture**: Optional image overlay (8 presets)
   - **Creativity** (1-10): Controls denoise strength via `t_index_list`
   - **Quality** (0-1): Number of diffusion steps (0.25=1 step, 1.0=4 steps)
   - **t_index_list**: `[6, 12, 18, 24]` scaled by creativity (formula: `2.62 - 0.132 * creativity`)

4. **Clip Creation** (`livepeer-clip`):
   - Record 3-10s (hold button)
   - Creates clip from last N seconds of stream
   - Polls asset until ready
   - Saves to database with metadata

5. **Share & Reward** (ClipView.tsx):
   - Share to X/Twitter with preset text
   - Generate unique coffee ticket code
   - Display ticket as large text + QR data

### Authentication Flow

- **Email OTP** (magic link):
  1. User enters email → `supabase.auth.signInWithOtp()`
  2. Custom email via `send-auth-email` function (Resend)
  3. User enters 6-digit code or clicks magic link
  4. Session stored in localStorage (Supabase client config)

### Routing

```typescript
/ (root)         → Gallery (all clips)
/start          → Landing (marketing page)
/login          → Login (email OTP)
/capture        → Capture (camera + AI controls)
/clip/:id       → ClipView (playback + share + ticket)
```

## 🛠️ Development Patterns

### Component Patterns
- **Functional components** with hooks (no class components)
- **shadcn/ui** for all UI primitives (button, input, dialog, etc.)
- **Controlled components** for forms (useState + onChange)
- **useEffect** for side effects (auth check, data loading, debouncing)

### State Management
- **Local state**: `useState` for component state
- **Server state**: Direct Supabase queries (no React Query usage despite being installed)
- **Refs**: For video elements and WebRTC connections

### Naming Conventions
- Components: `PascalCase` (e.g., `Gallery.tsx`)
- Files: `PascalCase` for components, `kebab-case` for utilities
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE` (e.g., `FRONT_PROMPTS`)
- CSS classes: `kebab-case` with Tailwind

### Error Handling
- Try/catch with toast notifications
- Console logging for debugging
- Graceful degradation (loading states, empty states)

### TypeScript Usage
- **Relaxed config** (`strict: false`, `noImplicitAny: false`)
- Types for props, state, and Supabase data
- `any` allowed for quick iteration
- Generated types from Supabase schema (`types.ts`)

## 🔌 External APIs

### Daydream API
- **Base URL**: `https://api.daydream.live`
- **Endpoints**:
  - `POST /v1/streams` - Create stream
  - `POST /beta/streams/:id/prompts` - Update prompt
- **Auth**: Bearer token (`DAYDREAM_API_KEY`)
- **Key fields**: `pipeline_id`, `prompt`, `texture_weight`, `t_index_list`

### Livepeer Studio API
- **Base URL**: `https://livepeer.studio/api`
- **Endpoints**:
  - `POST /clip` - Create clip from playback
  - `GET /asset/:id` - Check asset status
- **Auth**: Bearer token (`LIVEPEER_STUDIO_API_KEY`)
- **Playback**: `https://lvpr.tv/?v={playbackId}&lowLatency=force`

### Supabase Edge Functions
All functions have `verify_jwt: false` (public access)
- CORS enabled for all functions
- Service role key for server operations
- Error responses include hints for debugging

## 🎮 User Interactions

### Camera Selection (Capture.tsx)
- **Front camera**: Selfie mode, portrait prompts (Ghibli, anime, watercolor)
- **Back camera**: Environment mode, scene prompts (vaporwave, noir, isometric)
- Randomly assigns prompt based on camera type

### Recording Mechanics
- **Hold to record**: Mouse down/up or touch start/end
- **Duration**: 3-10s enforced (clamped client-side)
- **Real-time counter**: Shows elapsed time during recording
- **Button states**: Loading, Recording (with pulse), Ready

### Prompt Customization
- **Debounced updates**: 500ms delay on input change
- **Auto-apply**: Changes trigger immediate stream update
- **Texture overlay**: Optional, 8 presets, weight slider (0-1)
- **Creativity/Quality**: Abstract sliders that map to diffusion parameters

## 🎨 Styling Philosophy

### Tailwind First
- Utility classes in JSX (no separate CSS files except index.css)
- `cn()` helper for conditional classes (clsx + tailwind-merge)
- Responsive design with `md:` breakpoints

### Component Styling
- **Cards**: Rounded-3xl borders with subtle glows
- **Buttons**: Rounded-full for CTAs, rounded-md for utilities
- **Inputs**: Rounded-md, border-border, bg-card/background
- **Videos**: Square aspect ratio, rounded-3xl overflow-hidden

### Animations
- `transition-smooth` class for interactions
- Pulse animations for recording state
- Spin for loading states (Loader2 component)
- Scale on hover (1.05) for CTAs

## 📦 Dependencies Philosophy

### Installed vs Used
- **React Query**: Installed but not used (direct Supabase calls preferred)
- **shadcn/ui**: ~50 components installed, only ~10 actively used
- **Keep installed**: Allows quick iteration without npm install

### Version Strategy
- Latest stable versions (^X.Y.Z)
- React 18 ecosystem
- TypeScript 5.8+
- Vite 5.4+

## 🔐 Environment Variables

Required in `.env.local` (Vite):
```
VITE_SUPABASE_URL=https://....supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

Required in Supabase (Edge Functions):
```
DAYDREAM_API_KEY=dd_...
LIVEPEER_STUDIO_API_KEY=...
RESEND_API_KEY=re_...
SEND_EMAIL_HOOK_SECRET=...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 🚀 Deployment Context

- **Platform**: Lovable.dev (main deployment)
- **Build**: `npm run build` → `dist/`
- **Dev**: `npm run dev` → localhost:8080
- **Preview**: `npm run preview`

## 🧩 Code Patterns to Follow

### Adding a New Page
1. Create component in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Use existing UI components from `@/components/ui`
4. Follow dark theme color scheme

### Adding a New API Call
1. Create edge function in `supabase/functions/name/`
2. Add to `supabase/config.toml` with `verify_jwt: false`
3. Call via `supabase.functions.invoke('name', { body: {...} })`
4. Add CORS headers to function

### Updating Database Schema
1. Create migration in `supabase/migrations/`
2. Run `supabase db push` (or apply via Supabase dashboard)
3. Regenerate types: `supabase gen types typescript`
4. Update `src/integrations/supabase/types.ts`

### Adding UI Components
- Use shadcn/ui CLI: `npx shadcn@latest add [component]`
- Components go to `src/components/ui/`
- Import and use with custom classes

## 🎯 Key Business Logic

### T-Index Calculation (Creativity/Quality)
**Matches PRD § "Controls → parameter mapping"**

```typescript
// Quality [0..1] determines number of diffusion steps (defaults to 0.4)
quality < 0.25 → [6]              (1 step, fastest)
quality < 0.50 → [6, 12]          (2 steps)
quality < 0.75 → [6, 12, 18]      (3 steps)
quality ≥ 0.75 → [6, 12, 18, 24]  (4 steps, best quality)

// Creativity [1..10] scales the indices (defaults to 5)
// Higher creativity → lower indices → more stylization
scale = 2.62 - 0.132 * creativity
t_index = base_index * scale (clamped 0-50, rounded)

// Rationale (from PRD):
// - Higher/later indices bias refinement
// - Earlier indices increase stylization
// - Fallback: [4, 12, 20] if any value invalid
```

### Clip Duration Enforcement
- UI: 3-10s range enforced by hold button
- Database: CHECK constraint (3000-10000 ms)
- Backend: Clamping in `stopRecording()`

### Ticket Generation
- Format: Random base36 string (8 chars, uppercase)
- QR Data: `DD-COFFEE-{code}`
- One ticket per session (users table relation)

## 🔄 State Flow Examples

### Capture Flow State
```
Initial: cameraType=null (camera selection screen)
  ↓ selectCamera('front'|'back')
Loading: initializing stream
  ↓ startWebRTCPublish()
Ready: playbackId set, showing AI output
  ↓ startRecording() (hold button)
Recording: recordStartTime set, counter running
  ↓ stopRecording() (release button)
Processing: creating clip via Livepeer
  ↓ navigate to /clip/:id
```

### Prompt Update Flow
```
User types → setState → useEffect (500ms debounce) → updatePrompt()
                                                      ↓
                                    supabase.functions.invoke('daydream-prompt')
                                                      ↓
                                          Daydream API updates stream
                                                      ↓
                                              Video effect changes
```

## 🎨 UI/UX Patterns

### Loading States
- **Spinner**: `<Loader2 className="animate-spin" />` for async operations
- **Skeleton**: Pulse animation for loading content
- **Disabled buttons**: During loading with loader icon

### Empty States
- Gallery: "No clips yet" with CTA button
- Clear messaging with next action

### Error Handling
- Toast notifications (bottom-right)
- Destructive variant for errors
- Console logging for debugging

### Responsive Design
- Mobile-first approach
- `md:` breakpoints for desktop enhancements
- Touch-friendly targets (min 44px)

## 🔧 Common Operations

### Reading Supabase Data
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', id)
  .single();
```

### Calling Edge Functions
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: 'value' }
});
```

### Toast Notifications
```typescript
toast({
  title: 'Success!',
  description: 'Operation completed',
  variant: 'destructive' // optional, for errors
});
```

### Navigation
```typescript
// Declarative
<Link to="/path">Link</Link>

// Programmatic
navigate('/path');
```

## 🚨 Critical Constraints

1. **Video Resolution**: 512x512 (square) - hardcoded for Daydream pipeline
2. **Clip Duration**: 3-10 seconds (UI + DB constraints)
3. **Camera Types**: Only 'front' | 'back' (no custom options)
4. **Public Access**: All RLS policies allow public reads for clips/sessions
5. **No Auth Required**: Edge functions have `verify_jwt: false` for simplicity
6. **Single Stream**: User can only have one active stream at a time

## 📝 Coding Conventions

### TypeScript
- Types are **guides, not gates** (strict mode disabled)
- Use `any` for quick iteration, refine later if needed
- Interface for component props, type for data models
- Generated types from Supabase are source of truth

### React Patterns
- Functional components only (no classes)
- Hooks for state and effects
- Avoid premature optimization
- Keep components flat (minimal nesting)

### File Organization
- One component per file
- Co-locate related utilities
- Index exports for public APIs
- Keep shadcn/ui components unmodified

### CSS
- Tailwind utilities inline
- CSS variables for design tokens
- Avoid custom CSS files
- Use `cn()` for conditional classes

## 🔄 Update Triggers

**When to update VIBEME.md**:
- [ ] New major features (e.g., add recording playback)
- [ ] Architecture changes (e.g., add state management library)
- [ ] New API integrations (e.g., add payment system)
- [ ] Database schema changes (new tables/fields)
- [ ] Design system updates (new colors, patterns)
- [ ] Workflow changes (new user flows)

**Do NOT update for**:
- Minor bug fixes
- Copy/text changes
- Individual component updates
- CSS tweaks
- Dependency version bumps

## 🎯 Agent Guidance

### When receiving high-level prompts:

1. **Read VIBEME.md first** for context
2. **Check existing patterns** before inventing new ones
3. **Reuse UI components** from shadcn/ui library
4. **Follow dark theme** with purple/cyan accents
5. **Use Supabase** for all backend operations
6. **Add error handling** with toast notifications
7. **Test with TypeScript** (but don't let types block you)
8. **Update VIBEME.md** if you make architectural changes

### Common Agent Tasks:

**"Add a new field to clips"**:
→ Update migration → Regenerate types → Update ClipView/Capture → Update VIBEME

**"Change the UI of X"**:
→ Check design system colors → Use existing shadcn components → Follow responsive patterns

**"Add analytics"**:
→ Create new edge function → Update relevant pages → Add to supabase config

**"Fix video not loading"**:
→ Check WebRTC flow → Verify API keys → Check CORS → Look at console logs

## 🌟 Project Vibe

This is a **fast-moving event app** - prioritize:
- ✅ **Working over perfect**: Ship features quickly
- ✅ **Visual polish**: Users see gradients and glows everywhere
- ✅ **Clear feedback**: Loading states, toasts, error messages
- ✅ **Mobile-first**: Summit attendees use phones
- ✅ **Fun UX**: Playful interactions, smooth animations

Avoid:
- ❌ Over-engineering (no complex state management)
- ❌ Premature optimization (readability > performance)
- ❌ Extensive validation (trust the user, handle errors gracefully)
- ❌ Long forms (keep interactions quick and simple)

## 📚 Reference Quick Links

- **Daydream Docs**: Pipeline configs, prompt formats, texture handling
- **Livepeer Docs**: Clip API, asset statuses, playback URLs
- **Supabase Docs**: RLS policies, edge function patterns, auth flows
- **shadcn/ui Docs**: Component APIs, styling patterns

## 🔗 VIBEME ↔ PRD Cross-Reference

**How to use these documents together:**
- **PRD.md** = Product vision, requirements, acceptance criteria → Read for "what to build"
- **VIBEME.md** = Current state, patterns, conventions → Read for "how it's built"

**Section mapping:**

| VIBEME Section | PRD Section | Notes |
|----------------|-------------|-------|
| Hard Constraints | "Hard constraints" | Technical non-negotiables |
| Database Schema | "Data model (Supabase Postgres)" | Exact table structure match |
| T-Index Calculation | "Controls → parameter mapping" | Algorithm implementation |
| Video Processing Flow | "Daydream / playback / clipping" | WHIP, WebRTC, clip creation |
| Routing | "Screens & components" | Page structure |
| Camera Selection | "Defaults (front/back)" | Prompt selection logic |
| External APIs | "Edge Functions (Supabase)" | API proxy patterns |
| Acceptance Criteria | "Acceptance criteria" | Feature checklist |
| Red-team notes | "Red-team notes" | Known edge cases |

**When PRD and VIBEME diverge:**
1. PRD describes the **intended design** (source of truth for features)
2. VIBEME describes **current implementation** (source of truth for code patterns)
3. If implemented differently than PRD, note it in VIBEME with rationale
4. Update both docs when making architectural changes

## 📋 Implementation Status vs PRD

**Fully implemented (✅):**
- Email OTP auth (no X OAuth as per PRD optional clause)
- Camera selector (front/back) with permission prompts
- Live output (1:1 square) with PiP source preview
- Prompt, Texture+Weight, Creativity, Quality controls
- Hold-to-record (3-10s) → Livepeer asset creation
- Share to X with default copy
- Coffee QR display and DB storage
- Gallery home with square grid

**Partially implemented (⚠️):**
- Texture system: 8 slots defined, but actual texture images are placeholders
- Ticket email: Function exists but may not be fully wired up
- Clip page: Shows video but QR visibility logic may need refinement

**Not yet implemented (❌):**
- `/ticket/:code` dedicated route (ticket only shows on clip page)
- Actual QR code rendering (shows code text, not QR image)
- Email delivery of ticket (function exists but integration TBD)

**Deviations from PRD (📝):**
- Gallery shows video player instead of thumbnails (simpler, works for POC)
- No X OAuth (per PRD: "optional if trivial; otherwise require email")
- Ticket route simplified (QR shown on clip page only)

---

**Last Updated**: 2025-10-09 (Updated with PRD alignment)
**Project Status**: Active development for Livepeer × Daydream Summit (Brewdream)
**Maintainer Note**: Keep this file concise but comprehensive. Every section should answer "what do I need to know to work on this?" Always check PRD for feature requirements before implementing.

