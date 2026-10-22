import { DownloadIcon, LayersIcon, TrashIcon } from './Icons';

interface Props {
  stats: {
    total: number;
    selected: number;
    changed: number;
    images: number;
    conflicts: number;
    totalSizeLabel: string;
  };
  isProcessing: boolean;
  progress: number;
  doneCount: number;
  folderName: string;
  onDownloadZip: () => void;
  onDownloadEach: () => void;
  onClear: () => void;
}

export function ActionBar({
  stats,
  isProcessing,
  progress,
  doneCount,
  folderName,
  onDownloadZip,
  onDownloadEach,
  onClear,
}: Props) {
  if (stats.total === 0) return null;

  return (
    <div className="sticky bottom-0 z-30 -mx-4 px-4 pb-4 pt-2 sm:mx-0 sm:px-0">
      <div className="rounded-3xl border border-white/15 bg-[#0c1a14]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
        {isProcessing && (
          <div className="h-1 bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
            <span className="inline-flex items-center gap-1.5 text-white/80 font-medium">
              <LayersIcon size={14} className="text-emerald-400" />
              {stats.selected} selected
            </span>
            <span>{stats.changed} will rename</span>
            <span>{stats.images} images</span>
            <span>{stats.totalSizeLabel}</span>
            {folderName && (
              <span className="truncate max-w-[10rem] text-emerald-300/80">
                📁 {folderName}
              </span>
            )}
            {stats.conflicts > 0 && (
              <span className="text-red-300 font-medium">
                {stats.conflicts} name conflicts
              </span>
            )}
            {isProcessing && (
              <span className="text-emerald-300">
                Processing {doneCount}… {progress}%
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={isProcessing || stats.selected === 0}
              onClick={onDownloadZip}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition hover:brightness-110"
            >
              <DownloadIcon size={18} />
              {isProcessing ? 'Building ZIP…' : 'Download renamed ZIP'}
            </button>
            <button
              type="button"
              disabled={isProcessing || stats.selected === 0}
              onClick={onDownloadEach}
              className="sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition hover:bg-white/15"
            >
              Save each file
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClear}
              className="sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-red-300/90 hover:bg-red-500/10 transition"
              title="Clear all"
            >
              <TrashIcon size={18} />
              <span className="sm:hidden">Clear</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
