import { useEffect, useState } from 'react';
import { formatBytes } from '../types';
import {
  copyDeviceMedia,
  deleteDeviceMedia,
  getDeviceMediaDetails,
  mediaPreviewUrl,
  openDeviceMedia,
  renameDeviceMedia,
  type CopyDestination,
  type DeviceMediaDetails,
  type DeviceMediaItem,
} from '../native/deviceMedia';
import {
  CopyIcon,
  ExternalIcon,
  EyeIcon,
  InfoIcon,
  MoveIcon,
  RenameIcon,
  TrashIcon,
  XIcon,
} from './Icons';

type SheetView = 'menu' | 'info' | 'rename' | 'copy' | 'move' | 'delete';

interface Props {
  item: DeviceMediaItem;
  onClose: () => void;
  /** Called after the item changed on the device (rename/copy/move/delete). */
  onChanged: (message: string) => void;
  onView: (item: DeviceMediaItem) => void;
}

const DESTINATIONS: { id: CopyDestination; label: string; hint: string }[] = [
  { id: 'library', label: 'Bulk Rename album', hint: 'Pictures / Movies › Bulk Rename' },
  { id: 'download', label: 'Downloads', hint: 'Download › Bulk Rename' },
  { id: 'same', label: 'Same folder', hint: 'Copy next to the original' },
];

function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' };
}

function formatDuration(ms?: number): string | undefined {
  if (!ms) return undefined;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/** Bottom sheet with the Management-mode actions for one device item. */
export function ManageSheet({ item, onClose, onChanged, onView }: Props) {
  const [view, setView] = useState<SheetView>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<DeviceMediaDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const { base, ext } = splitName(item.displayName);
  const [newBase, setNewBase] = useState(base);
  const [destination, setDestination] = useState<CopyDestination>('library');

  useEffect(() => {
    if (view !== 'info' || details || detailsLoading) return;
    setDetailsLoading(true);
    getDeviceMediaDetails(item)
      .then(setDetails)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load info.'))
      .finally(() => setDetailsLoading(false));
  }, [view, details, detailsLoading, item]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const doRename = () =>
    run(async () => {
      const clean = newBase.trim().replace(/[<>:\"/\\|?*\u0000-\u001f]/g, '');
      if (!clean) {
        setError('Please enter a name.');
        return;
      }
      const result = await renameDeviceMedia(item, `${clean}${ext}`);
      onChanged(`Renamed to ${result.displayName}`);
    });

  const doDelete = () =>
    run(async () => {
      await deleteDeviceMedia(item);
      onChanged(`Deleted ${item.displayName}`);
    });

  const doCopy = (move: boolean) =>
    run(async () => {
      const result = await copyDeviceMedia(item, destination, move);
      if (result.warning) {
        onChanged(result.warning);
      } else if (move) {
        onChanged(`Moved to ${result.item.displayName}`);
      } else {
        onChanged(`Copied as ${result.item.displayName}`);
      }
    });

  const actionButton =
    'flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-4 text-xs font-semibold text-white active:scale-95 transition disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative max-h-[86dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#0c1a14] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        {/* Header */}
        <div className="mb-3 flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {item.kind === 'video' ? (
              <video src={mediaPreviewUrl(item)} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <img src={mediaPreviewUrl(item)} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{item.displayName}</p>
            <p className="text-[11px] text-white/40">
              {formatBytes(item.size)} · {item.mimeType}
              {formatDuration(item.duration) ? ` · ${formatDuration(item.duration)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:scale-95 transition"
          >
            <XIcon size={16} />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {view === 'menu' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className={actionButton} onClick={() => onView(item)}>
                <EyeIcon size={22} className="text-emerald-300" /> View
              </button>
              <button type="button" className={actionButton} onClick={() => setView('info')}>
                <InfoIcon size={22} className="text-sky-300" /> Info
              </button>
              <button type="button" className={actionButton} onClick={() => setView('rename')}>
                <RenameIcon size={22} className="text-amber-300" /> Rename
              </button>
              <button type="button" className={actionButton} onClick={() => setView('copy')}>
                <CopyIcon size={22} className="text-teal-300" /> Copy
              </button>
              <button type="button" className={actionButton} onClick={() => setView('move')}>
                <MoveIcon size={22} className="text-violet-300" /> Move
              </button>
              <button type="button" className={actionButton} onClick={() => setView('delete')}>
                <TrashIcon size={22} className="text-red-300" /> Delete
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await openDeviceMedia(item);
                })
              }
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-white/80 active:scale-[0.99] transition disabled:opacity-50"
            >
              <ExternalIcon size={16} /> Open in another app
            </button>
            <p className="mt-3 text-center text-[11px] text-white/35">
              Renaming or deleting files from other apps may ask for system approval.
            </p>
          </>
        )}

        {view === 'info' && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">File info</h4>
            {detailsLoading || !details ? (
              <p className="py-6 text-center text-sm text-white/40">Loading info…</p>
            ) : (
              <dl className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.03] px-3">
                {(
                  [
                    ['Name', details.displayName],
                    ['Title', details.title ?? '—'],
                    ['Type', `${details.kind} · ${details.mimeType}`],
                    ['Size', formatBytes(details.size)],
                    [
                      'Dimensions',
                      details.width && details.height ? `${details.width} × ${details.height}` : '—',
                    ],
                    ['Duration', formatDuration(details.duration) ?? '—'],
                    ['Album', details.album ?? '—'],
                    ['Folder', details.relativePath ?? details.path ?? '—'],
                    ['Modified', new Date(details.dateModified).toLocaleString()],
                    ['Added', new Date(details.dateAdded).toLocaleString()],
                    ['Media ID', details.id],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex gap-3 py-2 text-xs">
                    <dt className="w-24 shrink-0 font-semibold text-white/40">{label}</dt>
                    <dd className="min-w-0 break-all text-white/85">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <BackButton onClick={() => setView('menu')} />
          </div>
        )}

        {view === 'rename' && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">Rename</h4>
            <div className="flex items-center gap-2">
              <input
                value={newBase}
                onChange={(e) => setNewBase(e.target.value)}
                autoFocus
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
              />
              {ext && <span className="shrink-0 text-sm text-white/40">{ext}</span>}
            </div>
            <ConfirmRow
              busy={busy}
              confirmLabel={busy ? 'Renaming…' : 'Rename'}
              onCancel={() => setView('menu')}
              onConfirm={() => void doRename()}
            />
          </div>
        )}

        {(view === 'copy' || view === 'move') && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-white">
              {view === 'copy' ? 'Copy to…' : 'Move to…'}
            </h4>
            <div className="space-y-2">
              {DESTINATIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDestination(d.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    destination === d.id
                      ? 'border-emerald-400/50 bg-emerald-500/15'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      destination === d.id ? 'border-emerald-400 bg-emerald-500' : 'border-white/30'
                    }`}
                  >
                    {destination === d.id && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{d.label}</span>
                    <span className="block text-[11px] text-white/40">{d.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {view === 'move' && (
              <p className="mt-2 text-[11px] text-amber-200/70">
                Move = copy there, then delete the original (system may ask for approval).
              </p>
            )}
            <ConfirmRow
              busy={busy}
              confirmLabel={busy ? 'Working…' : view === 'copy' ? 'Copy' : 'Move'}
              onCancel={() => setView('menu')}
              onConfirm={() => void doCopy(view === 'move')}
            />
          </div>
        )}

        {view === 'delete' && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-red-300">Delete this file?</h4>
            <p className="text-xs leading-relaxed text-white/50">
              <span className="text-white/85">{item.displayName}</span> will be permanently
              removed from this device. This can't be undone from the app.
            </p>
            <ConfirmRow
              busy={busy}
              danger
              confirmLabel={busy ? 'Deleting…' : 'Delete permanently'}
              onCancel={() => setView('menu')}
              onConfirm={() => void doDelete()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] transition"
    >
      Back
    </button>
  );
}

function ConfirmRow({
  busy,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-3 flex gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99] transition"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg active:scale-[0.99] transition disabled:opacity-60 ${
          danger
            ? 'bg-red-500 shadow-red-900/30 hover:bg-red-400'
            : 'bg-emerald-500 shadow-emerald-900/30 hover:bg-emerald-400'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
