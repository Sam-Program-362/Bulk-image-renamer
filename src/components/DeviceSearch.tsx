import { useCallback, useEffect, useRef, useState } from 'react';
import { formatBytes } from '../types';
import {
  isNative,
  loadDeviceFiles,
  mediaPreviewUrl,
  searchDeviceMedia,
  type DeviceMediaItem,
  type MediaFilter,
} from '../native/deviceMedia';
import { CheckIcon, ImageIcon, PlusIcon, SearchIcon } from './Icons';

interface Props {
  /** Adds loaded files to the rename queue (same as picking them). */
  onFiles: (files: File[], folderName?: string) => void;
}

const FILTERS: { id: MediaFilter; label: string }[] = [
  { id: 'all', label: 'All media' },
  { id: 'images', label: 'Images' },
  { id: 'gif', label: 'GIF' },
  { id: 'jpg', label: 'JPG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WEBP' },
  { id: 'videos', label: 'Videos' },
  { id: 'mp4', label: 'MP4' },
];

/**
 * Android-only: search photos & videos already on the device by title /
 * file name (backed by the native MediaStore plugin), then send any
 * selection into the normal bulk-rename queue. Renders nothing on web.
 */
export function DeviceSearch({ onFiles }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [results, setResults] = useState<DeviceMediaItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string, f: MediaFilter) => {
    setSearching(true);
    setError(null);
    try {
      const items = await searchDeviceMedia(q, f);
      setResults(items);
      setSelected(new Set());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Search failed. Check that photo/video permission is allowed.'
      );
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Initial browse (most recent media) once the panel mounts on Android.
  useEffect(() => {
    if (isNative()) void runSearch('', 'all');
  }, [runSearch]);

  useEffect(() => {
    if (!isNative()) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void runSearch(query, filter), 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, filter, runSearch]);

  if (!isNative()) return null;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addSelected = async () => {
    const chosen = (results ?? []).filter((i) => selected.has(i.id));
    if (chosen.length === 0) return;
    setAdding(true);
    setError(null);
    try {
      const files = await loadDeviceFiles(chosen);
      if (files.length === 0) {
        setError('Could not read the selected files from the device.');
      } else {
        onFiles(files, 'Device media');
        setSelected(new Set());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load selected files.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.06] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 bg-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-emerald-300" />
          <h3 className="text-sm font-semibold text-white">
            Search on this device
          </h3>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-2 py-0.5">
            Android
          </span>
        </div>
        <p className="text-xs text-white/45">
          Find images, GIFs and videos (JPG, PNG, MP4, …) anywhere on your
          phone by title — then rename them in bulk.
        </p>

        <div className="relative">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, e.g. vacation or IMG_20…"
            className="w-full rounded-xl bg-black/30 border border-white/10 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-400/50"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                filter === f.id
                  ? 'bg-emerald-500 border-emerald-400 text-white'
                  : 'bg-black/30 border-white/10 text-white/55'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="px-4 py-3 text-xs text-red-300 bg-red-500/10 border-b border-red-400/20">
          {error}
        </p>
      )}

      <div className="max-h-[46vh] overflow-y-auto overscroll-contain">
        {searching && results === null ? (
          <p className="px-4 py-10 text-center text-sm text-white/40">Searching device…</p>
        ) : results !== null && results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-white/40">
            {query
              ? `No media titled “${query}” found on this device`
              : 'No photos or videos found on this device'}
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-2">
            {(results ?? []).map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`relative aspect-square rounded-xl overflow-hidden border text-left transition ${
                    isSelected
                      ? 'border-emerald-400 ring-2 ring-emerald-400/60'
                      : 'border-white/10'
                  }`}
                >
                  {item.kind === 'video' ? (
                    <video
                      src={mediaPreviewUrl(item)}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={mediaPreviewUrl(item)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {item.kind === 'video' && (
                    <span className="absolute top-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      ▶ VIDEO
                    </span>
                  )}
                  {item.mimeType === 'image/gif' && (
                    <span className="absolute top-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      GIF
                    </span>
                  )}
                  <span
                    className={`absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-md border ${
                      isSelected
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : 'border-white/40 bg-black/40'
                    }`}
                  >
                    {isSelected && <CheckIcon size={12} />}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1">
                    <span className="block truncate text-[10px] font-medium text-white">
                      {item.displayName}
                    </span>
                    <span className="block text-[9px] text-white/50">
                      {formatBytes(item.size)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="px-4 py-3 border-t border-white/10 bg-white/5">
          <button
            type="button"
            disabled={adding}
            onClick={() => void addSelected()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 active:scale-[0.98] transition hover:bg-emerald-400 disabled:opacity-60"
          >
            <PlusIcon size={18} />
            {adding
              ? 'Loading files…'
              : `Add ${selected.size} selected to rename queue`}
          </button>
        </div>
      )}
    </section>
  );
}
