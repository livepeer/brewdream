# Local Download Toggle

**Last Updated**: 2025-10-12  
**Location**: `src/pages/Capture.tsx:179,734-759,806-813`

## What

Toggle to download recorded video clips to browser's downloads folder. Independent of Livepeer upload. Starts ON by default.

**UI**: Controls panel, below Quality slider

## How

```typescript
// State: starts ON
const [downloadToLocalEnabled, setDownloadToLocalEnabled] = useState(true);

// Downloads blob with ISO timestamp filename
const downloadBlobToLocal = (blob: Blob, timestamp: number) => {
  const filename = `brewdream-clip-${new Date(timestamp).toISOString().replace(/[:.]/g, '-').slice(0, -5)}.webm`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
};

// In stopRecording() - downloads BEFORE Livepeer upload
if (downloadToLocalEnabled) {
  downloadBlobToLocal(blob, timestamp);
}
```

**Filename**: `brewdream-clip-2025-10-12T15-30-45.webm` (ISO 8601, sortable)

## Why

- **Starts ON**: Dev convenience, local backup
- **Before upload**: Instant feedback, works even if upload fails
- **Uses blob**: No waiting for Livepeer processing

## Search Terms

local download, browser download, save video, download clip, dev toggle, save to disk, webm download

## Troubleshooting

- **Not downloading**: Check browser allows downloads, verify console for errors
- **Wrong filename**: Check system clock/timezone
- **Toggle doesn't persist**: By design - always starts ON (add localStorage if needed)

## Testing

1. Record clip → verify downloads to folder
2. Toggle OFF → verify no download
3. Works: Chrome, Firefox, Safari

## Related

- [RECORDING_IMPLEMENTATION.md](./RECORDING_IMPLEMENTATION.md) - Recording flow
- [DOCUMENTATION_GUIDELINES.md](./DOCUMENTATION_GUIDELINES.md) - Doc standards
