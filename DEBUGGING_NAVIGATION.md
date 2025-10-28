# Navigation Issue Debugging Guide

## The Problem
- User finishes recording a clip
- Toast appears: "Clip created! Redirecting to your clip..."
- Navigation to `/clip/{id}` doesn't happen
- Browser console shows: "Throttling navigation to prevent the browser from hanging"

## What I've Added

### Console Logging in Capture.tsx
Look for these logs when recording:
1. `handleUploadDone called` - When upload finishes
2. `handleRecordingComplete called` - When full processing completes
3. `saveRecordingToClip called` - When we try to save and navigate
4. `Clip saved to database, navigating to: /clip/xxx` - Just before navigate()
5. `Calling navigate() now` - Right before the navigate call
6. `navigate() called` - Right after the navigate call

### Console Logging in useUser.ts
Look for these logs:
1. `[useUser] Effect running` - When hook mounts/re-runs
2. `[useUser] syncUser called` - When auth sync happens
3. `[useUser] Auth state changed: {event}` - When auth state changes
4. `[useUser] Navigating to login` - If redirecting to login

## How to Debug

### Step 1: Record a clip and watch console
1. Start recording
2. Stop recording (after 3s)
3. Watch the console logs
4. Note the sequence of events

### Step 2: Check for navigation throttling
Look for:
- Is `navigate()` being called multiple times rapidly?
- Is `[useUser]` running repeatedly?
- Are there auth state changes happening?

### Step 3: Identify the blocker
- If you see "Calling navigate() now" but no actual navigation, something is blocking it
- If you see multiple rapid navigate calls, we have a loop
- If you see auth state changes, they might be interfering

## Expected Flow (Normal)
1. User stops recording
2. Video uploads to Livepeer
3. `handleUploadDone` called → `saveRecordingToClip` → `navigate('/clip/xxx')`
4. ClipView page loads
5. Video processes in background
6. Eventually `handleRecordingComplete` called → skipped (clipSavedRef is true)

## Fixes Applied
1. **Race condition guard**: Set `clipSavedRef.current = true` BEFORE calling async saveRecordingToClip
2. **Double-callback prevention**: Check flag in both handleUploadDone and handleRecordingComplete  
3. **Error handling**: Reset flag on error so user can retry
4. **Logging**: Added extensive console.logs to trace execution

## Next Steps
Run the app, record a clip, and paste the console logs here to see what's happening.
