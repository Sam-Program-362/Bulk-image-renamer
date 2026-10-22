import { mediaPreviewUrl, type DeviceMediaItem } from '../native/deviceMedia';
import { XIcon } from './Icons';

/** Full-screen in-app viewer for a device image / GIF / video. */
export function MediaViewer({
  item,
  onClose,
}: {
  item: DeviceMediaItem | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const url = mediaPreviewUrl(item);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {item.displayName}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:scale-95 transition"
        >
          <XIcon size={18} />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {item.kind === 'video' ? (
          <video
            src={url}
            className="max-h-full max-w-full rounded-lg"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img src={url} alt={item.displayName} className="max-h-full max-w-full object-contain" />
        )}
      </div>
    </div>
  );
}
